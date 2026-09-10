import React from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationContext";
import { Scissors, X, Calendar, MessageCircle, Clock, CheckCircle2, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const NotificationToast: React.FC = () => {
  const { activeToast, dismissToast, markAsRead } = useNotifications();

  if (!activeToast) return null;

  const handleOpenAgenda = () => {
    markAsRead(activeToast.id);
    dismissToast();
  };

  const whatsappPhone = activeToast.customerPhone?.replace(/\D/g, "");
  const whatsappUrl = whatsappPhone
    ? `https://wa.me/55${whatsappPhone}?text=${encodeURIComponent(
        `Olá ${activeToast.customerName}! Confirmamos o seu agendamento de ${activeToast.serviceName} com ${activeToast.barberName} para ${activeToast.date} às ${activeToast.time}. Qualquer dúvida estamos à disposição!`
      )}`
    : null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md w-full sm:w-96 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border-2 border-accent p-4 relative overflow-hidden backdrop-blur-md">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/15 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
            </span>
            <div className="flex items-center gap-1.5 font-bold text-sm text-accent">
              <Scissors className="w-4 h-4" />
              <span>Novo Agendamento!</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {activeToast.source === "chat" ? "Via Chat" : "Via Web"}
            </span>
            <button
              onClick={dismissToast}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Dispensar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-1.5 mb-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-extrabold text-base text-white truncate">{activeToast.customerName}</span>
            <span className="text-xs font-bold text-accent shrink-0">
              {formatCurrency(activeToast.priceCents || 0)}
            </span>
          </div>

          <div className="text-xs text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="truncate">{activeToast.serviceName}</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>{activeToast.time}</span>
            </div>
            <span>•</span>
            <div className="truncate">Barbeiro: <strong className="text-slate-200">{activeToast.barberName}</strong></div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
          <Link
            to="/agenda"
            onClick={handleOpenAgenda}
            className="flex-1 py-2 px-3 rounded-xl bg-accent hover:bg-accent/90 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Ver na Agenda</span>
          </Link>

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shrink-0"
              title="Confirmar via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
