import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Scissors,
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Sparkles,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  Check,
} from "lucide-react";

interface ServiceOption {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  description: string;
}

interface BarberOption {
  id: string;
  name: string;
  specialty: string;
  avatarText: string;
}

const FICTITIOUS_SERVICES: ServiceOption[] = [
  {
    id: "serv_1",
    name: "Corte Degradê na Régua",
    durationMinutes: 45,
    priceCents: 4500,
    description: "Fade perfeito, alinhamento navalhado e finalização com pomada modeladora.",
  },
  {
    id: "serv_2",
    name: "Barboterapia com Toalha Quente",
    durationMinutes: 35,
    priceCents: 3500,
    description: "Esfoliação facial, vapor de ozônio, toalha quente, navalha e óleo hidratante.",
  },
  {
    id: "serv_3",
    name: "Combo Cabelo + Barba Completa",
    durationMinutes: 65,
    priceCents: 7000,
    description: "Nosso combo mais pedido: corte completo com degradê e barba alinhada.",
  },
  {
    id: "serv_4",
    name: "Pezinho & Acabamento na Navalha",
    durationMinutes: 20,
    priceCents: 2000,
    description: "Contorno do corte, costeletas e nuca alinhados na lâmina.",
  },
];

const FICTITIOUS_BARBERS: BarberOption[] = [
  {
    id: "any",
    name: "Qualquer Barbeiro Disponível",
    specialty: "Primeiro horário livre com qualquer profissional",
    avatarText: "⚡",
  },
  {
    id: "barb_1",
    name: "Marcos 'Navalha' Silva",
    specialty: "Especialista em Degradê e Freestyle",
    avatarText: "MS",
  },
  {
    id: "barb_2",
    name: "Lucas Ferreira",
    specialty: "Mestre Barbeiro & Visagismo Clássico",
    avatarText: "LF",
  },
  {
    id: "barb_3",
    name: "Gabriel Santos",
    specialty: "Especialista em Barboterapia & Cuidados com a Barba",
    avatarText: "GS",
  },
];

const FICTITIOUS_SLOTS = {
  Manhã: ["09:00", "09:45", "10:30", "11:15"],
  Tarde: ["13:30", "14:15", "15:00", "16:00", "17:00"],
  Noite: ["18:00", "18:45", "19:30"],
};

export const SimulationChat: React.FC = () => {
  const navigate = useNavigate();

  // Passos: 1 = Identificação, 2 = Serviço, 3 = Profissional, 4 = Data/Horário, 5 = Resumo, 6 = Sucesso
  const [step, setStep] = useState<number>(1);

  const [customerName, setCustomerName] = useState<string>("Rodrigo Almeida");
  const [customerPhone, setCustomerPhone] = useState<string>("(11) 98765-4321");
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(FICTITIOUS_SERVICES[0]);
  const [selectedBarber, setSelectedBarber] = useState<BarberOption | null>(FICTITIOUS_BARBERS[1]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("15:00");
  const [bookingCode, setBookingCode] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Gerador de datas (próximos 7 dias)
  const dateOptions = useMemo(() => {
    const days: { dateString: string; dayNumber: number; dayName: string; month: string }[] = [];
    const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      days.push({
        dateString: `${yyyy}-${mm}-${dd}`,
        dayNumber: d.getDate(),
        dayName: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : DAY_NAMES[d.getDay()],
        month: MONTH_NAMES[d.getMonth()],
      });
    }
    return days;
  }, []);

  // Inicializar data padrão no primeiro dia
  React.useEffect(() => {
    if (dateOptions.length > 0 && !selectedDate) {
      setSelectedDate(dateOptions[0].dateString);
    }
  }, [dateOptions, selectedDate]);

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (raw.length > 11) raw = raw.slice(0, 11);
    let formatted = raw;
    if (raw.length > 2) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    }
    if (raw.length > 7) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    }
    setCustomerPhone(formatted);
  };

  const handleProceedFromStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setFormError("Informe seu nome para continuar a simulação.");
      return;
    }
    if (customerPhone.replace(/\D/g, "").length < 10) {
      setFormError("Informe um número de WhatsApp válido.");
      return;
    }
    setFormError(null);
    setStep(2);
  };

  const handleConfirmSimulation = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setBookingCode(`SIM-${randomNum}`);
    setStep(6);
  };

  const handleRestartSimulation = () => {
    setStep(1);
    setCustomerName("Rodrigo Almeida");
    setCustomerPhone("(11) 98765-4321");
    setSelectedService(FICTITIOUS_SERVICES[0]);
    setSelectedBarber(FICTITIOUS_BARBERS[1]);
    setSelectedTime("15:00");
    setBookingCode("");
    setFormError(null);
  };

  const effectiveBarberName =
    selectedBarber?.id === "any" ? "Marcos 'Navalha' Silva (Encaixe Automático)" : selectedBarber?.name || "Marcos 'Navalha' Silva";

  const selectedDateLabel = useMemo(() => {
    const found = dateOptions.find((d) => d.dateString === selectedDate);
    return found ? `${found.dayName}, ${found.dayNumber} de ${found.month}` : selectedDate;
  }, [dateOptions, selectedDate]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-accent selection:text-slate-950">
      {/* Header com Aviso Explicativo de Simulação */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              to="/"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Voltar para a Página Inicial"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent text-slate-950 flex items-center justify-center font-black text-sm">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-sm text-white block">
                  Simulação de Agendamento
                </span>
                <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block -mt-0.5">
                  Ambiente Demonstrativo (Sem Vínculo Real)
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRestartSimulation}
            className="text-xs text-slate-400 hover:text-accent flex items-center gap-1 transition px-2.5 py-1.5 rounded-lg hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reiniciar</span>
          </button>
        </div>
      </header>

      {/* Banner de Esclarecimento */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-xs text-amber-300">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Esta é uma <strong>simulação interativa</strong> com dados e horários fictícios.
            Nenhum agendamento real será gravado.
          </span>
        </div>
      </div>

      {/* Chat Container Central */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
          {/* Top Mockup Header da Barbearia Demonstrativa */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent text-slate-950 font-black text-base flex items-center justify-center shadow-md">
                MB
              </div>
              <div>
                <h2 className="font-bold text-base text-white">Barbearia Modelo MBarber</h2>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Chat Online (Modo Simulação)</span>
                </div>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
              Passo {step} de 5
            </span>
          </div>

          {/* PASSO 1: IDENTIFICAÇÃO DO CLIENTE */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3.5 text-xs sm:text-sm text-slate-200 leading-relaxed shadow max-w-[88%]">
                  Olá! Bem-vindo à barbearia. Para simularmos o agendamento, como você gostaria de se identificar?
                </div>
              </div>

              <form onSubmit={handleProceedFromStep1} className="space-y-3.5 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Seu Nome (ou nome fictício)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Rodrigo Almeida"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    WhatsApp para confirmação (simulação)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      placeholder="(11) 98765-4321"
                      value={customerPhone}
                      onChange={handlePhoneChange}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Nenhuma mensagem real será enviada. O número é usado apenas na simulação.
                  </span>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                >
                  <span>Continuar para Serviços</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* PASSO 2: ESCOLHER SERVIÇO */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3.5 text-xs sm:text-sm text-slate-200 leading-relaxed shadow max-w-[88%]">
                  Prazer, <strong className="text-white">{customerName}</strong>! Qual serviço você deseja agendar hoje?
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                {FICTITIOUS_SERVICES.map((serv) => {
                  const isSelected = selectedService?.id === serv.id;
                  return (
                    <button
                      key={serv.id}
                      type="button"
                      onClick={() => {
                        setSelectedService(serv);
                        setStep(3);
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-accent/10 border-accent text-white"
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          <span>{serv.name}</span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1">{serv.description}</p>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-accent" />
                            {serv.durationMinutes} min
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-extrabold text-accent block">
                          {formatCurrency(serv.priceCents)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">Selecionar →</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
              </div>
            </div>
          )}

          {/* PASSO 3: ESCOLHER BARBEIRO */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3.5 text-xs sm:text-sm text-slate-200 leading-relaxed shadow max-w-[88%]">
                  Ótima escolha: <strong className="text-white">{selectedService?.name}</strong>! Você tem preferência por algum barbeiro?
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                {FICTITIOUS_BARBERS.map((barber) => {
                  const isSelected = selectedBarber?.id === barber.id;
                  return (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => {
                        setSelectedBarber(barber);
                        setStep(4);
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-accent/10 border-accent text-white"
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-accent font-bold text-xs flex items-center justify-center shrink-0">
                          {barber.avatarText}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white">{barber.name}</div>
                          <div className="text-xs text-slate-400">{barber.specialty}</div>
                        </div>
                      </div>
                      <span className="text-xs text-accent font-semibold shrink-0">Escolher →</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar aos Serviços
                </button>
              </div>
            </div>
          )}

          {/* PASSO 4: ESCOLHER DATA E HORÁRIO */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3.5 text-xs sm:text-sm text-slate-200 leading-relaxed shadow max-w-[88%]">
                  Agora escolha o melhor dia e horário para o atendimento com{" "}
                  <strong className="text-white">{selectedBarber?.name}</strong>:
                </div>
              </div>

              {/* Seletor Horizontal de Dias */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Escolha o Dia:</label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {dateOptions.map((item) => {
                    const isPicked = selectedDate === item.dateString;
                    return (
                      <button
                        key={item.dateString}
                        type="button"
                        onClick={() => setSelectedDate(item.dateString)}
                        className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                          isPicked
                            ? "bg-accent text-slate-950 font-bold border-accent shadow-md shadow-accent/20"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <span className="text-[10px] uppercase">{item.dayName}</span>
                        <span className="text-sm font-black">{item.dayNumber}</span>
                        <span className="text-[9px] opacity-80">{item.month}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seletor de Horários Fictícios por Período */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Horários Livres para {selectedDateLabel}:
                </label>

                {Object.entries(FICTITIOUS_SLOTS).map(([period, times]) => (
                  <div key={period} className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      {period}
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {times.map((time) => {
                        const isPicked = selectedTime === time;
                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => {
                              setSelectedTime(time);
                              setStep(5);
                            }}
                            className={`py-2 px-2 rounded-xl text-xs font-semibold border transition text-center shadow-sm ${
                              isPicked
                                ? "bg-accent text-slate-950 font-bold border-accent shadow-md shadow-accent/20"
                                : "bg-slate-950 border-slate-800 text-slate-200 hover:border-accent hover:bg-slate-800"
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar aos Barbeiros
                </button>
              </div>
            </div>
          )}

          {/* PASSO 5: RESUMO E CONFIRMAÇÃO DA SIMULAÇÃO */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3.5 text-xs sm:text-sm text-slate-200 leading-relaxed shadow max-w-[88%]">
                  Perfeito! Confira o resumo do agendamento antes de confirmar:
                </div>
              </div>

              {/* Card de Resumo */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Serviço:</span>
                  <strong className="text-white text-sm">{selectedService?.name}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Profissional:</span>
                  <span className="text-slate-200 font-semibold">{effectiveBarberName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Data e Horário:</span>
                  <span className="text-accent font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {selectedDateLabel} às {selectedTime}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Cliente (WhatsApp):</span>
                  <span className="text-slate-200">
                    {customerName} • {customerPhone}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm">
                  <span className="text-slate-400">Valor Estimado:</span>
                  <span className="font-extrabold text-emerald-400">
                    {selectedService ? formatCurrency(selectedService.priceCents) : "R$ 0,00"}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  Ao clicar no botão abaixo, simularemos a finalização e exibiremos a mensagem enviada
                  ao barbeiro.
                </span>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmSimulation}
                  className="w-full py-3.5 rounded-xl bg-accent hover-bg-accent text-slate-950 font-extrabold text-sm transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar Agendamento (Simulação)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="w-full py-2 text-xs text-slate-400 hover:text-white text-center"
                >
                  ← Alterar data ou horário
                </button>
              </div>
            </div>
          )}

          {/* PASSO 6: TELA DE SUCESSO COM MENSAGEM PARA O BARBEIRO */}
          {step === 6 && (
            <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
              {/* Card de Confirmação do Cliente */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 space-y-3">
                <div className="flex items-center gap-2.5 text-base font-bold text-emerald-300">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <span>Agendamento Simulado com Sucesso!</span>
                </div>
                <p className="text-xs text-emerald-200/90 leading-relaxed">
                  Esta simulação reproduz com exatidão a experiência do seu cliente final e da sua equipe.
                </p>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-xs space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Código da Reserva:</span>
                    <strong className="font-mono text-accent">{bookingCode}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Data e Hora:</span>
                    <strong className="text-white">
                      {selectedDateLabel} às {selectedTime}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Serviço:</span>
                    <strong className="text-white">{selectedService?.name}</strong>
                  </div>
                </div>
              </div>

              {/* CARD DE DESTAQUE: MENSAGEM PARA O BARBEIRO (CONFORME SOLICITADO) */}
              <div className="p-5 rounded-2xl bg-slate-950 border-2 border-accent/40 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-accent font-bold text-sm">
                  <Bell className="w-5 h-5 text-accent animate-bounce" />
                  <span>Mensagem para o Barbeiro</span>
                  <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-semibold ml-auto">
                    Notificação do Sistema
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-slate-200 space-y-2 leading-relaxed">
                  <p className="font-semibold text-white">
                    🔔 Olá, {effectiveBarberName}!
                  </p>
                  <p>
                    O cliente <strong className="text-accent">{customerName}</strong> acabou de agendar
                    o serviço <strong className="text-white">{selectedService?.name}</strong> para{" "}
                    <strong className="text-emerald-400">
                      {selectedDateLabel} às {selectedTime}
                    </strong>.
                  </p>
                  <p className="text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                    📲 O horário já foi reservado na sua agenda e você receberá uma notificação em
                    tempo real no seu celular e no painel do MBarber.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                  <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    O sistema bloqueia este horário automaticamente para evitar qualquer marcação duplicada.
                  </span>
                </div>
              </div>

              {/* Ações pós-simulação */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleRestartSimulation}
                  className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Fazer Outra Simulação</span>
                </button>

                <Link
                  to="/auth/register"
                  className="w-full py-3.5 rounded-xl bg-accent hover-bg-accent text-slate-950 font-extrabold text-sm transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                >
                  <Scissors className="w-4 h-4" />
                  <span>Criar Minha Barbearia Grátis</span>
                </Link>

                <Link
                  to="/"
                  className="w-full py-2 text-xs text-slate-400 hover:text-white text-center block"
                >
                  Voltar para a Página Inicial
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
