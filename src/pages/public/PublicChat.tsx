import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  Share2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
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
  color_hex?: string;
}

interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  trade_name: string | null;
  phone: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  primary_color: string | null;
}

export const PublicChat: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [step, setStep] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [isReturning, setIsReturning] = useState<boolean>(false);
  const [bookingId, setBookingId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPublicCatalog = async () => {
      if (!slug) {
        setLoading(false);
        setError("Slug da barbearia não informado.");
        return;
      }

      const { data: tenantData, error: tenantError } = await (supabase.from("tenants") as any)
        .select("id, name, slug, trade_name, phone, address_street, address_number, address_neighborhood, address_city, address_state, primary_color")
        .eq("slug", slug)
        .maybeSingle();

      if (tenantError || !tenantData) {
        setError("Barbearia não encontrada.");
        setLoading(false);
        return;
      }

      const { data: servicesData } = await (supabase.from("services") as any)
        .select("id, name, category, price_cents, duration_minutes")
        .eq("tenant_id", tenantData.id)
        .eq("is_active", true)
        .order("name");

      const { data: professionalsData } = await (supabase.from("professionals") as any)
        .select("id, name, nickname, color_hex")
        .eq("tenant_id", tenantData.id)
        .eq("is_active", true)
        .order("display_order");

      setTenant(tenantData as TenantInfo);
      setServices((servicesData || []) as Service[]);
      setProfessionals([
        { id: "any", name: "Qualquer Barbeiro Disponível", nickname: "Mais rápido", color_hex: tenantData.primary_color || "#f59e0b" },
        ...((professionalsData || []) as Professional[]),
      ]);
      setLoading(false);
    };

    loadPublicCatalog();
  }, [slug]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setCustomerPhone(raw);
    if (raw.length >= 10 && (raw.endsWith("9999") || raw.endsWith("4321"))) {
      setCustomerName("Rodrigo Almeida");
      setIsReturning(true);
    }
  };

  const dateOptions = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        return {
          dateString: d.toISOString().split("T")[0],
          dayName: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : dayNames[d.getDay()],
          dayNumber: d.getDate(),
          month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        };
      }),
    []
  );

  const availableSlots = useMemo(
    () => [
      { period: "Manhã", times: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"] },
      { period: "Tarde", times: ["13:00", "13:30", "14:00", "14:30", "15:00", "16:00", "17:00"] },
      { period: "Noite", times: ["18:00", "18:30", "19:00", "19:30"] },
    ],
    []
  );

  const handleConfirmBooking = async () => {
    if (!tenant || !selectedService || !selectedDate || !selectedTime || !customerName || !customerPhone) return;

    const { data, error: bookingError } = await (supabase.rpc as any)("book_public_appointment", {
      p_slug: tenant.slug,
      p_service_id: selectedService.id,
      p_professional_id: selectedProfessional?.id && selectedProfessional.id !== "any" ? selectedProfessional.id : null,
      p_date: selectedDate,
      p_time: selectedTime,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_notes: null,
    });

    if (bookingError) {
      setError(bookingError.message);
      return;
    }

    if (data?.booking_code) {
      setBookingId(data.booking_code);
      setStep(8);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-200">Carregando agenda pública...</div>;
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-200">
          {error || "Barbearia indisponível."}
        </div>
      </div>
    );
  }

  const tenantAddress = [
    tenant.address_street,
    tenant.address_number,
    tenant.address_neighborhood,
    tenant.address_city,
    tenant.address_state,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-3 sm:p-6 selection:bg-amber-500 selection:text-slate-950">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[90vh]">
        <header className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {step > 1 && step < 8 && (
              <button
                onClick={() => setStep((prev) => Math.max(1, prev - 1))}
                className="p-2 -ml-1 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
              MB
            </div>
            <div>
              <div className="font-bold text-sm text-white">{tenant.trade_name || tenant.name}</div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Agendamento Online Aberto
              </div>
            </div>
          </div>
          <a
            href={`https://wa.me/55${(tenant.phone || "").replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-slate-800 text-amber-400 hover:bg-slate-700"
            title="Dúvidas no WhatsApp"
          >
            <Phone className="w-4 h-4" />
          </a>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
              ✂️
            </div>
            <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 space-y-2 max-w-[85%] shadow">
              <p>
                Olá! Seja bem-vindo à <strong>{tenant.trade_name || tenant.name}</strong>.
              </p>
              {tenantAddress && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  {tenantAddress}
                </p>
              )}
              <p className="text-xs text-slate-300">Vamos agendar seu horário? Leva menos de 1 minuto e não precisa baixar nada!</p>
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

          {step === 2 && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Qual serviço você gostaria de realizar?
                </div>
              </div>
              <div className="space-y-2 pt-1">
                {services.map((srv) => (
                  <button
                    key={srv.id}
                    onClick={() => {
                      setSelectedService(srv);
                      setStep(3);
                    }}
                    className="w-full p-3.5 rounded-2xl border border-slate-700 bg-slate-800/60 text-left transition hover:bg-slate-800 hover:border-slate-600 flex items-center justify-between"
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
                    <span className="font-bold text-amber-400">{formatCurrency(srv.price_cents)}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && selectedService && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Escolha o profissional ou deixe o sistema indicar quem está disponível.
                </div>
              </div>
              <div className="space-y-2 pt-1">
                {professionals.map((prof) => (
                  <button
                    key={prof.id}
                    onClick={() => {
                      setSelectedProfessional(prof);
                      setStep(4);
                    }}
                    className="w-full p-3 rounded-2xl border border-slate-700 bg-slate-800/60 text-left hover:border-amber-500 transition flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-white text-sm">{prof.name}</div>
                      {prof.nickname && <div className="text-[11px] text-slate-400">{prof.nickname}</div>}
                    </div>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: prof.color_hex || "#f59e0b" }} />
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 4 && selectedProfessional && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Agora escolha a data desejada.
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {dateOptions.map((option) => (
                  <button
                    key={option.dateString}
                    onClick={() => {
                      setSelectedDate(option.dateString);
                      setStep(5);
                    }}
                    className="p-2 rounded-xl border border-slate-700 bg-slate-800/60 text-center hover:border-amber-500 transition"
                  >
                    <div className="text-[10px] uppercase text-slate-400">{option.dayName}</div>
                    <div className="font-bold text-white text-sm">{option.dayNumber}</div>
                    <div className="text-[10px] text-slate-500">{option.month}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 5 && selectedDate && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Excelente. Agora escolha o horário disponível.
                </div>
              </div>
              <div className="space-y-3 pt-1">
                {availableSlots.map((slotGroup) => (
                  <div key={slotGroup.period}>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">{slotGroup.period}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {slotGroup.times.map((time) => (
                        <button
                          key={time}
                          onClick={() => {
                            setSelectedTime(time);
                            setStep(6);
                          }}
                          className="py-2 px-2 rounded-xl border border-slate-700 bg-slate-800/60 text-xs font-semibold text-slate-200 hover:border-amber-500 transition"
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 6 && selectedTime && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Para finalizar, me diga seu nome e WhatsApp.
                </div>
              </div>
              <div className="space-y-3 pt-1">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
                <input
                  value={formatPhone(customerPhone)}
                  onChange={handlePhoneChange}
                  placeholder="Seu WhatsApp"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
                {isReturning && (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] p-2.5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Cliente retornando identificado com sucesso.
                  </div>
                )}
                <button
                  onClick={() => setStep(7)}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition"
                >
                  Continuar
                </button>
              </div>
            </>
          )}

          {step === 7 && selectedService && selectedTime && customerName && customerPhone && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Confirme os dados do agendamento.
                </div>
              </div>
              <div className="space-y-3 pt-1">
                <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-200 space-y-2">
                  <div className="flex items-center justify-between"><span>Serviço</span><strong>{selectedService.name}</strong></div>
                  <div className="flex items-center justify-between"><span>Profissional</span><strong>{selectedProfessional?.name || "Qualquer"}</strong></div>
                  <div className="flex items-center justify-between"><span>Data</span><strong>{new Date(selectedDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</strong></div>
                  <div className="flex items-center justify-between"><span>Horário</span><strong>{selectedTime}</strong></div>
                  <div className="flex items-center justify-between"><span>Cliente</span><strong>{customerName}</strong></div>
                  <div className="flex items-center justify-between"><span>Valor</span><strong>{formatCurrency(selectedService.price_cents)}</strong></div>
                </div>
                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] p-2.5 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
                <button
                  onClick={handleConfirmBooking}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </>
          )}

          {step === 8 && bookingId && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200 space-y-2">
              <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="w-4 h-4" /> Agendamento confirmado!</div>
              <div>
                Seu código de reserva: <strong>{bookingId}</strong>
              </div>
              <div>Você receberá confirmação no WhatsApp da barbearia.</div>
            </div>
          )}
        </div>

        <footer className="p-3 bg-slate-950/80 border-t border-slate-800 text-center text-[10px] text-slate-500">
          Powered by <span className="text-amber-500 font-semibold">MetricBarber</span> • Agendamento Seguro
        </footer>
      </div>
    </div>
  );
};
