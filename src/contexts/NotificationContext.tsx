import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import {
  PushNotificationPayload,
  registerServiceWorker,
  showBrowserNotification,
  broadcastNewAppointment,
} from "@/lib/notifications";
import { playNotificationChime } from "@/lib/audioAlert";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface NotificationContextType {
  notifications: PushNotificationPayload[];
  unreadCount: number;
  permission: NotificationPermission;
  isPushSupported: boolean;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  activeToast: PushNotificationPayload | null;
  dismissToast: () => void;
  requestPermission: () => Promise<boolean>;
  sendTestNotification: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenant } = useAuth();
  const [notifications, setNotifications] = useState<PushNotificationPayload[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("mb_sound_enabled");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  const [activeToast, setActiveToast] = useState<PushNotificationPayload | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPushSupported = typeof window !== "undefined" && "Notification" in window;

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    try {
      localStorage.setItem("mb_sound_enabled", String(enabled));
    } catch {}
  };

  // Carregar notificações salvas do tenant
  useEffect(() => {
    if (!tenant?.id) {
      setNotifications([]);
      return;
    }

    try {
      const key = `mb_notifications_${tenant.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
        }
      }
    } catch (err) {
      console.warn("Erro ao carregar notificações do tenant:", err);
    }
  }, [tenant?.id]);

  // Registrar o Service Worker ao inicializar
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Manipular chegada de nova notificação
  const handleIncomingNotification = useCallback(
    (notif: PushNotificationPayload) => {
      // Evita duplicatas pelo ID
      setNotifications((prev) => {
        if (prev.some((item) => item.id === notif.id)) return prev;
        const updated = [notif, ...prev].slice(0, 50);
        if (tenant?.id) {
          try {
            localStorage.setItem(`mb_notifications_${tenant.id}`, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });

      // Disparar som de alerta caso ativado
      if (soundEnabled) {
        playNotificationChime();
      }

      // Disparar notificação nativa do sistema operacional (Desktop / Mobile)
      showBrowserNotification(notif, false);

      // Exibir banner flutuante in-app
      setActiveToast(notif);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => {
        setActiveToast(null);
      }, 9000);
    },
    [soundEnabled, tenant?.id]
  );

  // Assinar canais em tempo real (Supabase, BroadcastChannel e eventos de janela)
  useEffect(() => {
    if (!tenant?.id) return;

    // 1. Canal Local entre abas do navegador (BroadcastChannel)
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel(`mb_channel_${tenant.id}`);
        bc.onmessage = (event) => {
          if (event.data?.type === "NEW_APPOINTMENT" && event.data?.payload) {
            handleIncomingNotification(event.data.payload);
          }
        };
      } catch (err) {
        console.warn("Falha ao abrir BroadcastChannel:", err);
      }
    }

    // 2. Evento DOM personalizado disparado no mesmo contexto
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PushNotificationPayload>;
      if (customEvent.detail && customEvent.detail.tenantId === tenant.id) {
        handleIncomingNotification(customEvent.detail);
      }
    };
    window.addEventListener("mb:new_appointment", handleCustomEvent);

    // 3. Supabase Realtime: escuta eventos broadcast e inserções diretas na tabela
    let channel: any = null;
    if (isSupabaseConfigured) {
      try {
        channel = supabase.channel(`tenant_${tenant.id}_realtime`)
          .on("broadcast", { event: "new_appointment" }, (payload: any) => {
            if (payload?.payload) {
              handleIncomingNotification(payload.payload);
            }
          })
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "appointments",
              filter: `tenant_id=eq.${tenant.id}`,
            },
            async (payload: any) => {
              const newRecord = payload.new;
              if (newRecord) {
                // Monta o payload a partir do registro do banco
                const notificationPayload: PushNotificationPayload = {
                  id: `notif_db_${newRecord.id}`,
                  tenantId: tenant.id,
                  title: "✂️ Novo Agendamento Recebido!",
                  message: `Agendamento confirmado para ${new Date(newRecord.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
                  customerName: "Cliente",
                  serviceName: "Serviço",
                  barberName: "Barbeiro",
                  date: new Date(newRecord.start_time).toISOString().split("T")[0],
                  time: new Date(newRecord.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                  priceCents: newRecord.price_cents || 0,
                  source: "chat",
                  createdAt: new Date().toISOString(),
                  read: false,
                };
                handleIncomingNotification(notificationPayload);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("Erro ao subscrever canal Supabase Realtime:", err);
      }
    }

    return () => {
      if (bc) {
        bc.close();
      }
      window.removeEventListener("mb:new_appointment", handleCustomEvent);
      if (channel && isSupabaseConfigured) {
        supabase.removeChannel(channel);
      }
    };
  }, [tenant?.id, handleIncomingNotification]);

  // Solicitar permissão de Notificação Push ao navegador
  const requestPermission = async (): Promise<boolean> => {
    if (!isPushSupported) {
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        // Disparar confirmação de ativação com o chime
        if (soundEnabled) {
          playNotificationChime();
        }
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready.catch(() => null);
          if (reg) {
            reg.showNotification("🎉 Notificações Push Ativadas!", {
              body: "Você receberá alertas em tempo real a cada novo agendamento realizado pelo chat ou painel.",
              icon: "/barber-hero.jpg",
              badge: "/barber-hero.jpg",
            });
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn("Erro ao solicitar permissão de notificações:", err);
      return false;
    }
  };

  // Disparar uma notificação de teste para demonstração imediata ao barbeiro
  const sendTestNotification = async () => {
    if (!tenant) return;

    const testPayload: PushNotificationPayload = {
      id: `test_${Date.now()}`,
      tenantId: tenant.id,
      title: "✂️ Teste de Notificação Push",
      message: "Marcos Oliveira agendou Barba Terapia com Carlos Barber para hoje às 16:30.",
      customerName: "Marcos Oliveira",
      customerPhone: "11999998888",
      serviceName: "Barba Terapia & Toalha Quente",
      barberName: "Carlos Barber",
      date: new Date().toISOString().split("T")[0],
      time: "16:30",
      priceCents: 4500,
      source: "chat",
      createdAt: new Date().toISOString(),
      read: false,
    };

    handleIncomingNotification(testPayload);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, read: true } : item));
      if (tenant?.id) {
        try {
          localStorage.setItem(`mb_notifications_${tenant.id}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((item) => ({ ...item, read: true }));
      if (tenant?.id) {
        try {
          localStorage.setItem(`mb_notifications_${tenant.id}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
    if (tenant?.id) {
      try {
        localStorage.removeItem(`mb_notifications_${tenant.id}`);
      } catch {}
    }
  };

  const dismissToast = () => {
    setActiveToast(null);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        permission,
        isPushSupported,
        soundEnabled,
        setSoundEnabled,
        activeToast,
        dismissToast,
        requestPermission,
        sendTestNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications deve ser usado dentro de um NotificationProvider");
  }
  return context;
}
