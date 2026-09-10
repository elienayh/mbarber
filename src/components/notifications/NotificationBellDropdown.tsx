import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  Bell,
  Check,
  CheckCheck,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Scissors,
  Trash2,
  ExternalLink,
  MessageCircle,
  AlertCircle,
  Play,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const NotificationBellDropdown: React.FC = () => {
  const {
    notifications,
    unreadCount,
    permission,
    isPushSupported,
    soundEnabled,
    setSoundEnabled,
    requestPermission,
    sendTestNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [requestingPerm, setRequestingPerm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleRequestPush = async () => {
    setRequestingPerm(true);
    await requestPermission();
    setRequestingPerm(false);
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return "Agora mesmo";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `há ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `há ${diffHours} h`;
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch {
      return "recente";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do Sino */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus:outline-none"
        title="Notificações em Tempo Real"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-black shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Menu Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-slate-800">
          {/* Cabeçalho */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-accent" />
              <span className="font-bold text-sm">Notificações da Barbearia</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-accent text-slate-950 font-black text-[10px]">
                  {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Botão de Som */}
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1.5 rounded-lg text-xs transition ${
                  soundEnabled
                    ? "text-accent hover:bg-slate-800"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
                title={soundEnabled ? "Som de alerta ativado (clique para silenciar)" : "Som desativado (clique para ativar)"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Marcar todas como lidas */}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-accent hover:bg-slate-800 transition"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Banner de Permissão Push do Navegador */}
          {isPushSupported && permission !== "granted" && (
            <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <div className="font-bold text-amber-900">Ativar Notificações no Navegador?</div>
                <p className="text-amber-700 mt-0.5">
                  Receba alertas na tela do seu computador ou celular mesmo com a aba fechada.
                </p>
                <button
                  type="button"
                  onClick={handleRequestPush}
                  disabled={requestingPerm}
                  className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition text-xs shadow-xs"
                >
                  {requestingPerm ? "Solicitando..." : "Permitir Notificações Push"}
                </button>
              </div>
            </div>
          )}

          {/* Banner de Confirmação quando Ativo */}
          {permission === "granted" && (
            <div className="px-3.5 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Notificações push ativadas</span>
              </div>
              <button
                type="button"
                onClick={sendTestNotification}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1"
              >
                <Play className="w-3 h-3" />
                Testar Alerta
              </button>
            </div>
          )}

          {/* Lista de Notificações */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-700">Nenhuma notificação ainda</div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Novos agendamentos via chat ou painel aparecerão aqui em tempo real.
                </p>
                <button
                  type="button"
                  onClick={sendTestNotification}
                  className="mt-3 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                >
                  Simular Novo Agendamento
                </button>
              </div>
            ) : (
              notifications.map((item) => {
                const whatsappPhone = item.customerPhone?.replace(/\D/g, "");
                return (
                  <div
                    key={item.id}
                    onClick={() => markAsRead(item.id)}
                    className={`p-3.5 transition cursor-pointer hover:bg-slate-50 ${
                      !item.read ? "bg-accent/5 border-l-4 border-accent" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-extrabold text-sm text-slate-900 truncate">
                        {item.customerName}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item.source === "chat" ? "Chat" : "Web"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 font-medium mt-1 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-accent shrink-0" />
                      <span className="truncate">{item.serviceName}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{item.date} às <strong>{item.time}</strong></span>
                        <span>•</span>
                        <span>{item.barberName}</span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(item.priceCents || 0)}
                      </span>
                    </div>

                    {/* Ações Rápidas */}
                    <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100">
                      <Link
                        to="/agenda"
                        onClick={() => {
                          markAsRead(item.id);
                          setIsOpen(false);
                        }}
                        className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
                      >
                        <span>Abrir Agenda</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>

                      {whatsappPhone && (
                        <a
                          href={`https://wa.me/55${whatsappPhone}?text=${encodeURIComponent(
                            `Olá ${item.customerName}! Seu agendamento de ${item.serviceName} com ${item.barberName} está confirmado para ${item.date} às ${item.time}. Te aguardamos!`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1 ml-auto"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé */}
          {notifications.length > 0 && (
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={clearNotifications}
                className="text-slate-500 hover:text-red-600 flex items-center gap-1 transition text-[11px]"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpar histórico</span>
              </button>

              <Link
                to="/agenda"
                onClick={() => setIsOpen(false)}
                className="font-bold text-accent hover:underline text-[11px]"
              >
                Ver agenda completa →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
