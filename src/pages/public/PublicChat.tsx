import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Scissors,
  User,
  Calendar as CalendarIcon,
  Clock,
  Phone,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  MapPin,
  CalendarPlus,
  Share2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { formatCurrency, formatPhone } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  duration_minutes: number;
}

interface Professional {
  id: string;
  name: string;
  nickname?: string;
  avatar_url?: string;
  color_hex: string;
}

export const PublicChat: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  // Tenant public data
  const tenant = {
    name: "Barbearia Vintage Club",
    slug: slug || "vintage-barber",
    phone: "(11) 98765-4321",
    address: "Rua Augusta, 1420 - Consolação, São Paulo - SP",
    primary_color: "#f59e0b",
  };

  // Mock catalog for the tenant
  const services: Service[] = [
    { id: "s1", name: "Corte Tradicional / Degradê", category: "Cabelo", price_cents: 4500, duration_minutes: 30 },
    { id: "s2", name: "Barba Terapia com Toalha Quente", category: "Barba", price_cents: 3500, duration_minutes: 30 },
    { id: "s3", name: "Combo Cabelo + Barba Completa", category: "Combos", price_cents: 7000, duration_minutes: 50 },
    { id: "s4", name: "Acabamento / Pezinho / Sobrancelha", category: "Acabamento", price_cents: 2000, duration_minutes: 20 },
  ];

  const professionals: Professional[] = [
    { id: "any", name: "Qualquer Barbeiro Disponível", nickname: "Mais Rápido", color_hex: "#f59e0b" },
    { id: "p1", name: "João 'Navalha' Silva", nickname: "Especialista em Degradê", color_hex: "#3b82f6" },
    { id: "p2", name: "Carlos Barbeiro", nickname: "Mestre da Barboterapia", color_hex: "#10b981" },
    { id: "p3", name: "Lucas Ferreira", nickname: "Cortes Modernos e Freestyle", color_hex: "#8b5cf6" },
  ];

  // Steps: 1: welcome, 2: service, 3: professional, 4: date, 5: time, 6: identification, 7: confirmation, 8: success
  const [step, setStep] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [isReturning, setIsReturning] = useState<boolean>(false);
  const [bookingId, setBookingId] = useState<string>("");

  // Check returning customer on phone input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    setCustomerPhone(val);
    if (val.length >= 10) {
      // Simulating returning customer detection
      if (val.endsWith("9999") || val.endsWith("4321")) {
        setCustomerName("Rodrigo Almeida");
        setIsReturning(true);
      }
    }
  };

  // Generate date options (next 7 days)
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return {
      dateString: d.toISOString().split("T")[0],
      dayName: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : dayNames[d.getDay()],
      dayNumber: d.getDate(),
      month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    };
  });

  // Time slots available for selected date
  const availableSlots = [
    { period: "Manhã", times: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"] },
    { period: "Tarde", times: ["13:00", "13:30", "14:00", "14:30", "15:00", "16:00", "17:00"] },
    { period: "Noite", times: ["18:00", "18:30", "19:00", "19:30"] },
  ];

  const handleConfirmBooking = () => {
    // Generate an authentic booking reference
    const ref = "MB-" + Math.floor(100000 + Math.random() * 900000);
    setBookingId(ref);
    setStep(8);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-3 sm:p-6 selection:bg-amber-500 selection:text-slate-950">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[90vh]">
        {/* Chat Header */}
        <header className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {step > 1 && step < 8 && (
              <button
                onClick={() => setStep(step - 1)}
                className="p-2 -ml-1 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
              MB
            </div>
            <div>
              <div className="font-bold text-sm text-white">{tenant.name}</div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Agendamento Online Aberto
              </div>
            </div>
          </div>
          <a
            href={`https://wa.me/55${tenant.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-slate-800 text-amber-400 hover:bg-slate-700"
            title="Dúvidas no WhatsApp"
          >
            <Phone className="w-4 h-4" />
          </a>
        </header>

        {/* Chat Conversation Content */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* STEP 1: WELCOME */}
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
              ✂️
            </div>
            <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 space-y-2 max-w-[85%] shadow">
              <p>
                Olá! Seja bem-vindo à <strong>{tenant.name}</strong>.
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                {tenant.address}
              </p>
              <p className="text-xs text-slate-300">
                Vamos agendar seu horário? Leva menos de 1 minuto e não precisa baixar nada!
              </p>
            </div>
          </div>

          {step === 1 && (
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => setStep(2)}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <span>Escolher Serviço e Agendar</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: SELECT SERVICE */}
          {step >= 2 && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Qual serviço você gostaria de realizar?
                </div>
              </div>

              {step === 2 ? (
                <div className="space-y-2 pt-1">
                  {services.map((srv) => (
                    <button
                      key={srv.id}
                      onClick={() => {
                        setSelectedService(srv);
                        setStep(3);
                      }}
                      className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${
                        selectedService?.id === srv.id
                          ? "bg-amber-500/10 border-amber-500 text-white"
                          : "bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm text-white">{srv.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {srv.duration_minutes} min
                          </span>
                          <span>•</span>
                          <span className="text-slate-300 font-medium">{srv.category}</span>
                        </div>
                      </div>
                      <div className="font-bold text-amber-400 text-sm">{formatCurrency(srv.price_cents)}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="bg-amber-500 text-slate-950 font-bold rounded-2xl rounded-tr-none px-4 py-2 text-sm">
                    {selectedService?.name} ({formatCurrency(selectedService?.price_cents || 0)})
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 3: SELECT PROFESSIONAL */}
          {step >= 3 && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Com qual profissional você deseja cortar?
                </div>
              </div>

              {step === 3 ? (
                <div className="space-y-2 pt-1">
                  {professionals.map((pro) => (
                    <button
                      key={pro.id}
                      onClick={() => {
                        setSelectedProfessional(pro);
                        setStep(4);
                      }}
                      className="w-full p-3 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:bg-slate-800 hover:border-slate-600 text-left transition flex items-center gap-3"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white"
                        style={{ backgroundColor: pro.color_hex }}
                      >
                        {pro.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-white">{pro.name}</div>
                        <div className="text-xs text-slate-400">{pro.nickname}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="bg-amber-500 text-slate-950 font-bold rounded-2xl rounded-tr-none px-4 py-2 text-sm">
                    {selectedProfessional?.name}
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 4: SELECT DATE */}
          {step >= 4 && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Para qual dia você prefere?
                </div>
              </div>

              {step === 4 ? (
                <div className="pt-1">
                  <div className="grid grid-cols-4 gap-2">
                    {dateOptions.map((opt) => (
                      <button
                        key={opt.dateString}
                        onClick={() => {
                          setSelectedDate(opt.dateString);
                          setStep(5);
                        }}
                        className="p-3 rounded-2xl bg-slate-800 border border-slate-700 hover:border-amber-500 text-center transition flex flex-col items-center"
                      >
                        <span className="text-[11px] font-semibold text-amber-400 uppercase">{opt.dayName}</span>
                        <span className="text-lg font-black text-white">{opt.dayNumber}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{opt.month}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="bg-amber-500 text-slate-950 font-bold rounded-2xl rounded-tr-none px-4 py-2 text-sm">
                    {selectedDate}
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 5: SELECT TIME */}
          {step >= 5 && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Escolha um horário livre disponível:
                </div>
              </div>

              {step === 5 ? (
                <div className="space-y-3 pt-1">
                  {availableSlots.map((group) => (
                    <div key={group.period}>
                      <div className="text-xs font-semibold text-slate-400 mb-1.5">{group.period}</div>
                      <div className="grid grid-cols-3 gap-2">
                        {group.times.map((time) => (
                          <button
                            key={time}
                            onClick={() => {
                              setSelectedTime(time);
                              setStep(6);
                            }}
                            className="py-2.5 px-3 rounded-xl bg-slate-800/80 border border-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-xs font-bold transition text-slate-200"
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="bg-amber-500 text-slate-950 font-bold rounded-2xl rounded-tr-none px-4 py-2 text-sm">
                    {selectedTime}
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 6: IDENTIFICATION */}
          {step >= 6 && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Para finalizar, qual é o seu WhatsApp e Nome para enviarmos a confirmação?
                </div>
              </div>

              {step === 6 ? (
                <div className="space-y-3 pt-1 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Seu WhatsApp (com DDD)</label>
                    <input
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={formatPhone(customerPhone)}
                      onChange={handlePhoneChange}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {isReturning && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <div>Bom te ver de novo, <strong>{customerName}</strong>!</div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Seu Nome Completo</label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos Silva"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    disabled={!customerName || customerPhone.length < 10}
                    onClick={() => setStep(7)}
                    className="w-full py-3 px-4 rounded-xl bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/20"
                  >
                    Revisar Agendamento
                  </button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="bg-amber-500 text-slate-950 font-bold rounded-2xl rounded-tr-none px-4 py-2 text-sm">
                    {customerName} ({formatPhone(customerPhone)})
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 7: REVIEW & CONFIRM */}
          {step === 7 && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 space-y-3">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Resumo do Agendamento
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between pb-2 border-b border-slate-700">
                    <span className="text-slate-400">Serviço:</span>
                    <span className="font-semibold text-white">{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-700">
                    <span className="text-slate-400">Profissional:</span>
                    <span className="font-semibold text-white">{selectedProfessional?.name}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-700">
                    <span className="text-slate-400">Data e Horário:</span>
                    <span className="font-semibold text-white">
                      {selectedDate} às {selectedTime}
                    </span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-700">
                    <span className="text-slate-400">Cliente:</span>
                    <span className="font-semibold text-white">{customerName}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-300 font-bold">Total a pagar no local:</span>
                    <span className="text-lg font-black text-amber-400">
                      {formatCurrency(selectedService?.price_cents || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="w-1/3 py-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-sm transition"
                >
                  Alterar
                </button>
                <button
                  onClick={handleConfirmBooking}
                  className="w-2/3 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Confirmar Horário
                </button>
              </div>
            </div>
          )}

          {/* STEP 8: SUCCESS */}
          {step === 8 && (
            <div className="space-y-4 pt-2 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">Agendamento Confirmado!</h3>
                <p className="text-xs text-slate-400 mt-1">Código da Reserva: {bookingId}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 text-left text-xs space-y-2">
                <p className="text-slate-300">
                  Enviamos os dados para seu WhatsApp <strong>{formatPhone(customerPhone)}</strong>.
                </p>
                <p className="text-slate-400">
                  📍 Te esperamos em: <strong>{tenant.address}</strong>
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
                    tenant.name + " - " + (selectedService?.name || "")
                  )}&dates=20261012T143000Z/20261012T151500Z&details=${encodeURIComponent(
                    "Agendamento no MetricBarber: " + bookingId
                  )}&location=${encodeURIComponent(tenant.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Adicionar ao Google Calendar
                </a>

                <a
                  href={`https://wa.me/55${customerPhone}?text=${encodeURIComponent(
                    `Olá! Meu agendamento na ${tenant.name} está confirmado para ${selectedDate} às ${selectedTime} (${bookingId}).`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <Share2 className="w-4 h-4" />
                  Abrir no WhatsApp
                </a>

                <button
                  onClick={() => {
                    setStep(1);
                    setSelectedService(null);
                    setSelectedProfessional(null);
                  }}
                  className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 transition"
                >
                  Fazer outro agendamento
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chat Footer */}
        <footer className="p-3 bg-slate-950/80 border-t border-slate-800 text-center text-[10px] text-slate-500">
          Powered by <span className="text-amber-500 font-semibold">MetricBarber</span> • Agendamento Seguro
        </footer>
      </div>
    </div>
  );
};
