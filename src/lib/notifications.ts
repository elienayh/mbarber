import { playNotificationChime } from "./audioAlert";
import { supabase, isSupabaseConfigured } from "./supabase";

export interface PushNotificationPayload {
  id: string;
  tenantId: string;
  title: string;
  message: string;
  customerName: string;
  customerPhone?: string;
  serviceName: string;
  barberName: string;
  barberId?: string;
  date: string;
  time: string;
  priceCents: number;
  source: "chat" | "web";
  createdAt: string;
  read: boolean;
}

/**
 * Registra o Service Worker para suporte a Notificações Push em background
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch (err) {
    console.warn("Falha ao registrar Service Worker:", err);
    return null;
  }
}

/**
 * Dispara uma notificação nativa do navegador (Desktop / Mobile)
 */
export async function showBrowserNotification(
  payload: PushNotificationPayload,
  playSound = true
): Promise<void> {
  if (playSound) {
    playNotificationChime();
  }

  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  const title = payload.title || "✂️ Novo Agendamento Recebido!";
  const body =
    payload.message ||
    `${payload.customerName} agendou ${payload.serviceName} com ${payload.barberName} para ${payload.time}.`;

  try {
    // 1. Tentar via Service Worker Registration (mais confiável em segundo plano e mobile)
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, {
          body,
          icon: "/barber-hero.jpg",
          badge: "/barber-hero.jpg",
          tag: `booking-${payload.id}`,
          renotify: true,
          requireInteraction: true,
          data: {
            url: "/agenda",
            appointmentId: payload.id,
            tenantId: payload.tenantId,
          },
        });
        return;
      }
    }

    // 2. Fallback: Construtor clássico de Notification
    const notif = new Notification(title, {
      body,
      icon: "/barber-hero.jpg",
      tag: `booking-${payload.id}`,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
      if (window.location.pathname !== "/agenda") {
        window.location.href = "/agenda";
      }
    };
  } catch (err) {
    console.warn("Não foi possível disparar notificação nativa:", err);
  }
}

/**
 * Dispara um novo agendamento para todos os barbeiros conectados em tempo real
 * (via Supabase Realtime, BroadcastChannel entre abas, e armazenamento local)
 */
export async function broadcastNewAppointment(
  data: Omit<PushNotificationPayload, "id" | "createdAt" | "read" | "title" | "message">
): Promise<PushNotificationPayload> {
  const sourceLabel = data.source === "chat" ? "via Chat Online" : "via Painel Web";
  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fullPayload: PushNotificationPayload = {
    ...data,
    id: notificationId,
    title: `✂️ Novo Agendamento (${sourceLabel})`,
    message: `${data.customerName} reservou ${data.serviceName} com ${data.barberName} para ${data.date} às ${data.time}.`,
    createdAt: new Date().toISOString(),
    read: false,
  };

  // 1. Salvar no histórico local do tenant
  try {
    const key = `mb_notifications_${data.tenantId}`;
    const raw = localStorage.getItem(key);
    const list: PushNotificationPayload[] = raw ? JSON.parse(raw) : [];
    list.unshift(fullPayload);
    // Guarda até 50 notificações recentes
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  } catch (err) {
    console.warn("Erro ao persistir notificação local:", err);
  }

  // 2. Transmitir via BroadcastChannel (sincroniza instantaneamente todas as abas abertas da barbearia)
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(`mb_channel_${data.tenantId}`);
      bc.postMessage({ type: "NEW_APPOINTMENT", payload: fullPayload });
      bc.close();
    } catch (err) {
      console.warn("BroadcastChannel error:", err);
    }
  }

  // 3. Transmitir via Supabase Realtime Broadcast (sincroniza diferentes dispositivos e computadores dos barbeiros)
  if (isSupabaseConfigured && data.tenantId) {
    try {
      const realtimeChannel = supabase.channel(`tenant_${data.tenantId}_realtime`);
      await realtimeChannel.send({
        type: "broadcast",
        event: "new_appointment",
        payload: fullPayload,
      });
    } catch (err) {
      console.warn("Supabase Realtime Broadcast error:", err);
    }
  }

  // 4. Disparar evento DOM para a aba atual caso esteja na mesma janela
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("mb:new_appointment", { detail: fullPayload }));
    } catch {}
  }

  return fullPayload;
}
