import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Share2,
  Sparkles,
  User,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatCurrency, formatPhone } from "@/lib/utils";
import { MapLocationViewer } from "@/components/MapLocationViewer";
import { broadcastNewAppointment } from "@/lib/notifications";

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
  avatar_url?: string | null;
  work_schedule?: any;
}

interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  trade_name: string | null;
  phone: string | null;
  logo_url?: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code?: string | null;
  primary_color: string | null;
  settings?: any;
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
  const [bookingId, setBookingId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotsErrorMessage, setSlotsErrorMessage] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingErrorMessage, setBookingErrorMessage] = useState<string | null>(null);

  // Estados para identificação inicial por telefone (Fonte Primária)
  const [phoneInput, setPhoneInput] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("mb_chat_last_phone");
      return saved ? formatPhone(saved) : "";
    } catch {
      return "";
    }
  });
  const [phoneSearching, setPhoneSearching] = useState(false);
  const [customerFound, setCustomerFound] = useState<boolean | null>(null);
  const [lookupAttempted, setLookupAttempted] = useState(false);
  const [customerTotalVisits, setCustomerTotalVisits] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    const loadPublicCatalog = async () => {
      if (!slug) {
        setLoading(false);
        setError("Slug da barbearia não informado.");
        return;
      }

      const cleanSlug = slug.toLowerCase().trim();

      // 1. Identificar o tenant exclusivamente a partir do slug da URL
      const { data: dbTenant, error: tenantErr } = await (supabase.from("tenants") as any)
        .select(
          "id, slug, name, trade_name, phone, logo_url, address_street, address_number, address_neighborhood, address_city, address_state, address_zip_code, settings, primary_color, status"
        )
        .eq("slug", cleanSlug)
        .maybeSingle();

      if (tenantErr) {
        console.error("Erro ao buscar tenant por slug no Supabase:", tenantErr);
        setError("Erro ao carregar dados da barbearia. Tente novamente mais tarde.");
        setLoading(false);
        return;
      }

      if (!dbTenant) {
        setError("Barbearia não encontrada. Verifique o link e tente novamente.");
        setLoading(false);
        return;
      }

      // 2. Carregar exclusivamente os serviços reais do tenant
      const { data: dbServices, error: servicesErr } = await (supabase.from("services") as any)
        .select("id, name, category, price_cents, duration_minutes, is_active")
        .eq("tenant_id", dbTenant.id)
        .eq("is_active", true)
        .order("name");

      if (servicesErr) {
        console.warn("Aviso ao buscar serviços reais do tenant:", servicesErr);
      }

      // 3. Carregar exclusivamente os profissionais reais do tenant
      const { data: dbPros, error: prosErr } = await (supabase.from("professionals") as any)
        .select("id, name, nickname, color_hex, avatar_url, is_active")
        .eq("tenant_id", dbTenant.id)
        .eq("is_active", true)
        .order("name");

      if (prosErr) {
        console.warn("Aviso ao buscar profissionais reais do tenant:", prosErr);
      }

      const realServices: Service[] = (dbServices || []).filter((s: any) => s.is_active !== false);
      const realProfessionals: Professional[] = (dbPros || []).filter((p: any) => p.is_active !== false);

      setTenant(dbTenant as TenantInfo);
      setServices(realServices);

      // Disponibilizar "Qualquer Barbeiro Disponível" apenas se existirem profissionais reais
      if (realProfessionals.length > 0) {
        setProfessionals([
          {
            id: "any",
            name: "Qualquer Barbeiro Disponível",
            nickname: "Primeiro horário livre",
            color_hex: dbTenant.primary_color || "var(--accent)",
          },
          ...realProfessionals,
        ]);
      } else {
        setProfessionals([]);
      }

      setLoading(false);
    };

    loadPublicCatalog();
  }, [slug]);

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length <= 2) {
      formatted = digits ? `(${digits}` : "";
    } else if (digits.length <= 6) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    } else if (digits.length <= 10) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    } else {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    setPhoneInput(formatted);
    if (lookupAttempted) {
      setLookupAttempted(false);
      setCustomerFound(null);
    }
  };

  const handlePhoneLookup = async (phoneToTest?: string) => {
    const raw = (phoneToTest !== undefined ? phoneToTest : phoneInput).replace(/\D/g, "");
    if (raw.length < 10) {
      setError("Por favor, informe seu WhatsApp com DDD (ex: 11 99999-8888).");
      return;
    }

    setPhoneSearching(true);
    setError(null);
    setCustomerPhone(raw);
    try {
      localStorage.setItem("mb_chat_last_phone", raw);
    } catch {}

    let foundName: string | null = null;
    let visits = 0;

    // 1. Tentar RPC Supabase 'find_customer_by_phone'
    if (isSupabaseConfigured && slug) {
      try {
        const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("find_customer_by_phone", {
          p_slug: slug,
          p_phone: raw,
        });
        if (!rpcErr && rpcData?.found && rpcData?.name) {
          foundName = rpcData.name;
          visits = rpcData.total_appointments || 0;
        }
      } catch (err) {
        console.warn("RPC find_customer_by_phone error:", err);
      }
    }

    // 2. Tentar busca direta na tabela 'customers'
    if (!foundName && isSupabaseConfigured && tenant?.id) {
      try {
        const { data: directCust } = await (supabase.from("customers") as any)
          .select("name, total_appointments")
          .eq("tenant_id", tenant.id)
          .or(`phone.eq.${raw},phone.eq.55${raw}`)
          .order("last_appointment_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (directCust?.name) {
          foundName = directCust.name;
          visits = directCust.total_appointments || 0;
        }
      } catch (err) {
        console.warn("Direct customers query fallback error:", err);
      }
    }

    // 3. Fallback: procurar no cache de clientes da barbearia
    if (!foundName && tenant?.id) {
      try {
        const localClientsRaw = localStorage.getItem(`mb_clients_${tenant.id}`);
        if (localClientsRaw) {
          const list = JSON.parse(localClientsRaw);
          if (Array.isArray(list)) {
            const match = list.find((c: any) => c.phone.replace(/\D/g, "") === raw);
            if (match?.name) {
              foundName = match.name;
              visits = match.total_appointments || 0;
            }
          }
        }
      } catch {}
    }

    // 4. Fallback: buscar nos agendamentos recentes salvos localmente
    if (!foundName && tenant?.id) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(`mb_appointments_${tenant.id}`)) {
            const aptsRaw = localStorage.getItem(k);
            if (aptsRaw) {
              const apts = JSON.parse(aptsRaw);
              if (Array.isArray(apts)) {
                const match = apts.find((a: any) => (a.phone || "").replace(/\D/g, "") === raw && a.client);
                if (match?.client) {
                  foundName = match.client;
                  visits = apts.filter((a: any) => (a.phone || "").replace(/\D/g, "") === raw).length;
                  break;
                }
              }
            }
          }
        }
      } catch {}
    }

    setPhoneSearching(false);
    setLookupAttempted(true);

    if (foundName) {
      setCustomerName(foundName);
      setNameInput(foundName);
      setCustomerFound(true);
      setCustomerTotalVisits(visits);
      setIsEditingName(false);
    } else {
      setCustomerFound(false);
      setCustomerName("");
      setNameInput("");
      setCustomerTotalVisits(0);
      setIsEditingName(true);
    }
  };

  const confirmCustomName = () => {
    if (nameInput.trim().length < 2) {
      setError("Por favor, digite seu nome (mínimo 2 letras).");
      return;
    }
    setCustomerName(nameInput.trim());
    setError(null);
    setStep(2);
  };

  const resetPhoneLookup = () => {
    setLookupAttempted(false);
    setCustomerFound(null);
    setPhoneInput("");
    setCustomerPhone("");
    setCustomerName("");
    setNameInput("");
    setIsEditingName(false);
    setError(null);
  };

  const dateOptions = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
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

  const [availableSlots, setAvailableSlots] = useState<{ period: string; times: string[] }[]>([]);

  useEffect(() => {
    if (!tenant || !selectedService || !selectedDate || !selectedProfessional) return;
    const loadSlots = async () => {
      setSlotsLoading(true);
      setSlotsErrorMessage(null);

      // Bloqueios de horário reais cadastrados para este tenant
      let activeBlocks: any[] = [];
      try {
        const startOfDay = `${selectedDate}T00:00:00`;
        const endOfDay = `${selectedDate}T23:59:59`;
        const { data: dbBlocks, error: blocksErr } = await (supabase.from("schedule_blocks") as any)
          .select("id, professional_id, start_time, end_time, is_all_day, title")
          .eq("tenant_id", tenant.id)
          .gte("end_time", startOfDay)
          .lte("start_time", endOfDay);

        if (blocksErr) {
          console.warn("Aviso ao buscar schedule_blocks:", blocksErr);
        } else if (dbBlocks && Array.isArray(dbBlocks)) {
          activeBlocks = dbBlocks;
        }
      } catch (err) {
        console.warn("Erro ao consultar schedule_blocks:", err);
      }

      // Verifica se há dia inteiro bloqueado para este profissional ou todos
      const isDayBlocked = activeBlocks.some(
        (b) =>
          b.is_all_day &&
          (!b.professional_id || selectedProfessional.id === "any" || b.professional_id === selectedProfessional.id)
      );

      if (isDayBlocked) {
        setAvailableSlots([]);
        setSlotsLoading(false);
        return;
      }

      // Verifica horário próprio de trabalho e dia de folga do barbeiro (se existir configuração personalizada)
      const sched = (selectedProfessional as any).work_schedule;
      if (selectedProfessional.id !== "any" && sched) {
        if (sched.followBarbershopHours === false && Array.isArray(sched.workDays)) {
          const dayOfWeek = new Date(`${selectedDate}T12:00:00`).getDay();
          if (!sched.workDays.includes(dayOfWeek)) {
            setAvailableSlots([]);
            setSlotsLoading(false);
            return;
          }
        }
      }

      const getTimeFromTimestamp = (isoOrTime: string | null | undefined, fallback: string): string => {
        if (!isoOrTime) return fallback;
        if (isoOrTime.includes("T")) {
          const timePart = isoOrTime.split("T")[1];
          return timePart ? timePart.slice(0, 5) : fallback;
        }
        return isoOrTime.slice(0, 5);
      };

      const isSlotAllowed = (timeStr: string) => {
        // 1. Checa intervalo de almoço do barbeiro se configurado
        if (selectedProfessional.id !== "any" && sched && sched.hasLunchBreak !== false) {
          const lStart = sched.lunchStart || "12:00";
          const lEnd = sched.lunchEnd || "13:00";
          if (timeStr >= lStart && timeStr < lEnd) {
            return false;
          }
        }

        // 2. Checa bloqueios específicos da agenda
        const isBlocked = activeBlocks.some((b) => {
          const matchesBarber =
            !b.professional_id || selectedProfessional.id === "any" || b.professional_id === selectedProfessional.id;
          if (!matchesBarber) return false;
          if (b.is_all_day) return true;
          const bStart = getTimeFromTimestamp(b.start_time, "00:00");
          const bEnd = getTimeFromTimestamp(b.end_time, "23:59");
          return timeStr >= bStart && timeStr < bEnd;
        });
        if (isBlocked) return false;

        return true;
      };

      const profIdParam =
        selectedProfessional.id === "any" || !selectedProfessional.id ? null : selectedProfessional.id;

      const { data, error: slotsError } = await (supabase.rpc as any)("get_available_slots", {
        p_tenant_id: tenant.id,
        p_professional_id: profIdParam,
        p_service_id: selectedService.id,
        p_date: selectedDate,
      });

      if (slotsError) {
        console.error("Erro na RPC get_available_slots:", slotsError);
        setSlotsErrorMessage("Falha técnica ao consultar os horários. Tente novamente mais tarde.");
        setAvailableSlots([]);
        setSlotsLoading(false);
        return;
      }

      const groups = new Map<string, string[]>();
      (data || [])
        .filter((slot: { is_available: boolean; slot_time: string }) => slot.is_available && isSlotAllowed(slot.slot_time.slice(0, 5)))
        .forEach((slot: { slot_time: string }) => {
          const time = slot.slot_time.slice(0, 5);
          const hour = Number(time.slice(0, 2));
          const period = hour < 12 ? "Manhã" : hour < 18 ? "Tarde" : "Noite";
          groups.set(period, [...(groups.get(period) || []), time]);
        });

      setAvailableSlots(Array.from(groups, ([period, times]) => ({ period, times })));
      setSlotsLoading(false);
    };

    loadSlots();
  }, [tenant, selectedService, selectedDate, selectedProfessional]);

  const handleConfirmBooking = async () => {
    if (bookingLoading) return;
    if (!tenant || !selectedService || !selectedDate || !selectedTime || customerName.trim().length < 2 || customerPhone.length < 8) {
      setBookingErrorMessage("Informe seu nome e um WhatsApp válido para confirmar.");
      return;
    }
    setBookingLoading(true);
    setBookingErrorMessage(null);

    const { data, error: bookingError } = await (supabase.rpc as any)("book_public_appointment", {
      p_slug: tenant.slug,
      p_service_id: selectedService.id,
      p_professional_id: selectedProfessional?.id && selectedProfessional.id !== "any" ? selectedProfessional.id : null,
      p_date: selectedDate,
      p_time: selectedTime,
      p_customer_name: customerName.trim(),
      p_customer_phone: customerPhone.trim(),
      p_notes: null,
    });

    if (bookingError) {
      console.error("Erro na RPC book_public_appointment:", bookingError);
      const msg = bookingError.message || "";
      if (
        msg.includes("prevent_barber_double_booking") ||
        msg.includes("exclusion") ||
        msg.includes("23P01") ||
        msg.includes("indisponível") ||
        msg.includes("conflict")
      ) {
        setBookingErrorMessage("Este horário acabou de ser reservado por outro cliente. Por favor, selecione outro horário.");
        setStep(4);
      } else {
        setBookingErrorMessage(msg || "Não foi possível concluir o agendamento. Tente novamente.");
      }
      setBookingLoading(false);
      return;
    }

    if (data?.booking_code) {
      try {
        const aptKey = `mb_appointments_${tenant.id}_${selectedDate}`;
        const existingAptsRaw = localStorage.getItem(aptKey);
        const existingApts = existingAptsRaw ? JSON.parse(existingAptsRaw) : [];
        const newApt = {
          id: data.booking_id || `apt_${Date.now()}`,
          time: selectedTime,
          client: customerName,
          phone: customerPhone,
          service: selectedService.name,
          serviceId: selectedService.id,
          barber: selectedProfessional.name,
          barberId: selectedProfessional.id,
          priceCents: selectedService.price_cents,
          status: "confirmed",
        };
        localStorage.setItem(aptKey, JSON.stringify([...existingApts, newApt]));
      } catch {}

      setBookingId(data.booking_code);
      setStep(6);

      // Disparar Notificação Push em Tempo Real para a Barbearia
      broadcastNewAppointment({
        tenantId: tenant.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        serviceName: selectedService.name,
        barberName: selectedProfessional.name,
        barberId: selectedProfessional.id,
        date: selectedDate,
        time: selectedTime,
        priceCents: selectedService.price_cents,
        source: "chat",
      });

      // Salva/atualiza o cliente na lista de clientes do tenant para visibilidade imediata
      try {
        const clientKey = `mb_clients_${tenant.id}`;
        const rawClients = localStorage.getItem(clientKey);
        const currentClients = rawClients ? JSON.parse(rawClients) : [];
        const cleanPhone = customerPhone.replace(/\D/g, "");
        const existingIdx = currentClients.findIndex((c: any) => c.phone.replace(/\D/g, "") === cleanPhone);
        if (existingIdx >= 0) {
          currentClients[existingIdx] = {
            ...currentClients[existingIdx],
            name: customerName,
            total_appointments: (currentClients[existingIdx].total_appointments || 0) + 1,
            total_spent_cents: (currentClients[existingIdx].total_spent_cents || 0) + (selectedService?.price_cents || 0),
            last_appointment_at: new Date().toISOString(),
          };
        } else {
          currentClients.push({
            id: `cust_${Date.now()}`,
            name: customerName,
            phone: cleanPhone,
            total_appointments: 1,
            total_spent_cents: selectedService?.price_cents || 0,
            last_appointment_at: new Date().toISOString(),
            notes: null,
          });
        }
        localStorage.setItem(clientKey, JSON.stringify(currentClients));
      } catch {}
    }
    setBookingLoading(false);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-3 sm:p-6 selection:bg-accent selection:text-slate-950">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[90vh]">
        <header className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {step > 1 && step < 6 && (
              <button
                onClick={() => setStep((prev) => Math.max(1, prev - 1))}
                className="p-2 -ml-1 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-accent text-slate-950 font-black flex items-center justify-center text-sm shadow-md overflow-hidden shrink-0 border border-accent/40">
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.trade_name || tenant.name} className="w-full h-full object-cover" />
              ) : (
                (tenant.trade_name || tenant.name || "MB").slice(0, 2).toUpperCase()
              )}
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
            className="p-2 rounded-xl bg-slate-800 text-accent hover:bg-slate-700"
            title="Dúvidas no WhatsApp"
          >
            <Phone className="w-4 h-4" />
          </a>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
              ✂️
            </div>
            <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 space-y-2 max-w-[85%] shadow">
              <p>
                Olá! Seja bem-vindo à <strong>{tenant.trade_name || tenant.name}</strong>.
              </p>
              {tenantAddress && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-accent" />
                  {tenantAddress}
                </p>
              )}
              <p className="text-xs text-slate-300">
                Para começar seu agendamento, digite seu <strong>WhatsApp com DDD</strong> abaixo. Se você já cortou com a gente, localizaremos seu cadastro na hora!
              </p>
            </div>
          </div>

          {step === 1 && (
            <div className="pt-2 space-y-4 animate-in fade-in duration-300">
              {/* Formulário de Identificação Inicial por WhatsApp */}
              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Seu WhatsApp / Celular:
                  </label>
                  {lookupAttempted && (
                    <button
                      type="button"
                      onClick={resetPhoneLookup}
                      className="text-[11px] text-slate-400 hover:text-accent underline"
                    >
                      Trocar número
                    </button>
                  )}
                </div>
                
                <div className="relative">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={handlePhoneInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !phoneSearching) {
                        e.preventDefault();
                        handlePhoneLookup();
                      }
                    }}
                    placeholder="(11) 99999-8888"
                    disabled={phoneSearching || (lookupAttempted && customerFound === true && !isEditingName)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 font-medium tracking-wide transition disabled:opacity-75"
                  />
                  {phoneSearching && (
                    <div className="absolute right-3.5 top-3.5 text-accent animate-spin">
                      <Loader2 className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {!lookupAttempted && (
                  <button
                    type="button"
                    onClick={() => handlePhoneLookup()}
                    disabled={phoneSearching || phoneInput.replace(/\D/g, "").length < 10}
                    className="w-full py-3.5 px-4 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {phoneSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Buscando Cadastro...</span>
                      </>
                    ) : (
                      <>
                        <span>Buscar Cadastro e Continuar</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}

                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Mensagem do Chat quando Cliente é Encontrado no Banco */}
              {lookupAttempted && customerFound && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                      ✂️
                    </div>
                    <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3.5 text-sm text-slate-200 space-y-1.5 max-w-[88%] shadow border border-emerald-500/30">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                        <Sparkles className="w-4 h-4" />
                        <span>Cadastro Identificado!</span>
                      </div>
                      <p className="leading-relaxed">
                        Que bom ter você de volta, <strong>{customerName}</strong>! 🎉
                      </p>
                      {customerTotalVisits > 0 && (
                        <p className="text-xs text-slate-400">
                          Identificamos {customerTotalVisits} atendimento(s) anterior(es) no seu histórico.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card de Confirmação do Cliente */}
                  <div className="rounded-2xl border border-slate-700 bg-slate-800/90 p-4 space-y-3 shadow-xl">
                    {!isEditingName ? (
                      <>
                        <div className="space-y-1 text-xs text-slate-300">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Nome:</span>
                            <strong className="text-white text-sm">{customerName}</strong>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">WhatsApp:</span>
                            <span className="text-emerald-400 font-medium">{formatPhone(customerPhone)}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setStep(2);
                          }}
                          className="w-full py-3 px-4 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                        >
                          <span>Sim, sou eu! Escolher Serviço</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>

                        <div className="flex justify-between items-center pt-1 text-xs">
                          <button
                            type="button"
                            onClick={() => setIsEditingName(true)}
                            className="text-slate-400 hover:text-accent underline transition"
                          >
                            Alterar meu nome
                          </button>
                          <button
                            type="button"
                            onClick={resetPhoneLookup}
                            className="text-slate-400 hover:text-white transition"
                          >
                            Trocar número
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-slate-300">
                          Atualizar seu nome para este agendamento:
                        </label>
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          placeholder="Seu nome completo"
                          className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingName(false)}
                            className="w-1/3 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-xs font-semibold hover:bg-slate-700"
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            onClick={confirmCustomName}
                            className="w-2/3 py-2.5 rounded-xl bg-accent text-slate-950 font-bold text-xs hover-bg-accent transition"
                          >
                            Confirmar e Continuar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mensagem do Chat quando NÃO Encontra (Novo Cliente) */}
              {lookupAttempted && customerFound === false && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                      ✂️
                    </div>
                    <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3.5 text-sm text-slate-200 space-y-1.5 max-w-[88%] shadow border border-slate-700">
                      <p className="leading-relaxed">
                        Não encontramos agendamentos anteriores para o número <strong>{formatPhone(customerPhone)}</strong>.
                      </p>
                      <p className="text-xs text-slate-400">
                        Como podemos te chamar?
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-800/90 p-4 space-y-3 shadow-xl">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Seu Nome Completo:
                      </label>
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmCustomName();
                          }
                        }}
                        placeholder="Ex: Carlos Eduardo"
                        className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={confirmCustomName}
                      disabled={nameInput.trim().length < 2}
                      className="w-full py-3.5 px-4 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span>Continuar e Escolher Serviço</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={resetPhoneLookup}
                        className="text-xs text-slate-400 hover:text-white transition"
                      >
                        ← Digitar outro número de WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  {customerName ? (
                    <p>Qual serviço você gostaria de agendar hoje, <strong>{customerName.split(" ")[0]}</strong>?</p>
                  ) : (
                    <p>Qual serviço você gostaria de realizar?</p>
                  )}
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
                          <Clock className="w-3 h-3 text-accent" />
                          {srv.duration_minutes} min
                        </span>
                        <span>•</span>
                        <span className="text-slate-300 font-medium">{srv.category}</span>
                      </div>
                    </div>
                    <span className="font-bold text-accent">{formatCurrency(srv.price_cents)}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && selectedService && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Escolha o profissional ou deixe o sistema indicar quem está disponível.
                </div>
              </div>
              <div className="space-y-2.5 pt-1">
                {professionals.map((prof) => (
                  <button
                    key={prof.id}
                    onClick={() => {
                      setSelectedProfessional(prof);
                      if (!selectedDate && dateOptions.length > 0) {
                        setSelectedDate(dateOptions[0].dateString);
                      }
                      setSelectedTime("");
                      setStep(4);
                    }}
                    className="w-full p-3 rounded-2xl border border-slate-700 bg-slate-800/70 text-left hover:border-accent hover:bg-slate-800 transition flex items-center justify-between group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 flex items-center justify-center font-black text-white text-sm shadow transition group-hover:scale-105"
                        style={{
                          borderColor: prof.color_hex || "var(--accent)",
                          backgroundColor: prof.color_hex || "var(--accent)",
                        }}
                      >
                        {prof.avatar_url ? (
                          <img src={prof.avatar_url} alt={prof.name} className="w-full h-full object-cover" />
                        ) : prof.id === "any" ? (
                          <span className="text-lg">✨</span>
                        ) : (
                          prof.name.slice(0, 2).toUpperCase()
                        )}
                      </div>

                      <div>
                        <div className="font-bold text-white text-sm group-hover:text-accent transition">
                          {prof.name}
                        </div>
                        {prof.nickname && <div className="text-xs text-slate-400 mt-0.5">{prof.nickname}</div>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: prof.color_hex || "var(--accent)" }}
                        title="Cor de identificação"
                      />
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-accent transition" />
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 4 && selectedProfessional && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Escolha o dia e o horário desejado. Ao tocar em qualquer dia, os horários disponíveis aparecem logo abaixo:
                </div>
              </div>

              {/* Mini resumo do serviço e profissional escolhidos */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <div className="flex items-center gap-1.5 truncate max-w-[55%]">
                  <span className="text-slate-400">Serviço:</span>
                  <span className="font-semibold text-white truncate">{selectedService?.name}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate max-w-[45%]">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: selectedProfessional.color_hex || "var(--accent)" }}
                  />
                  <span className="text-slate-300 font-medium truncate">{selectedProfessional.name}</span>
                </div>
              </div>

              {/* Seletor de Dias (Horizontal fluido) */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between text-xs px-0.5">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-accent" />
                    Selecione o Dia:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Toque para ver os horários
                  </span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth">
                  {dateOptions.map((option) => {
                    const isSelected = selectedDate === option.dateString;
                    return (
                      <button
                        key={option.dateString}
                        type="button"
                        onClick={() => {
                          setSelectedDate(option.dateString);
                          setSelectedTime("");
                        }}
                        className={`flex-shrink-0 min-w-[70px] py-2.5 px-2 rounded-2xl border text-center transition-all duration-200 ${
                          isSelected
                            ? "bg-accent text-slate-950 font-bold border-accent shadow-lg shadow-accent/25 ring-2 ring-accent/40 scale-[1.03]"
                            : "border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <div className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? "text-slate-950" : "text-slate-400"}`}>
                          {option.dayName}
                        </div>
                        <div className={`text-lg font-black my-0.5 ${isSelected ? "text-slate-950" : "text-white"}`}>
                          {option.dayNumber}
                        </div>
                        <div className={`text-[10px] font-medium ${isSelected ? "text-slate-900" : "text-slate-400"}`}>
                          {option.month}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horários Logo Abaixo do Dia Selecionado */}
              {selectedDate && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs px-0.5">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-accent" />
                      Horários disponíveis para:
                    </span>
                    <span className="text-[11px] text-accent font-bold">
                      {(() => {
                        const opt = dateOptions.find((d) => d.dateString === selectedDate);
                        return opt ? `${opt.dayName}, ${opt.dayNumber} de ${opt.month}` : selectedDate;
                      })()}
                    </span>
                  </div>

                  {slotsLoading && (
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/40 text-center flex items-center justify-center gap-2 text-xs text-slate-400">
                      <Loader2 className="w-4 h-4 text-accent animate-spin" />
                      <span>Consultando horários disponíveis com o barbeiro...</span>
                    </div>
                  )}

                  {!slotsLoading && slotsErrorMessage && (
                    <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-center text-xs text-red-300 space-y-1">
                      <p className="font-semibold">Erro ao consultar horários.</p>
                      <p className="text-[11px] text-slate-400">{slotsErrorMessage}</p>
                    </div>
                  )}

                  {!slotsLoading && !slotsErrorMessage && availableSlots.length === 0 && (
                    <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-center text-xs text-amber-300 space-y-1">
                      <p className="font-semibold">Nenhum horário livre nesta data.</p>
                      <p className="text-[11px] text-slate-400">
                        O barbeiro pode estar de folga ou com a agenda lotada. Toque em outro dia acima para consultar.
                      </p>
                    </div>
                  )}

                  {!slotsLoading && availableSlots.map((slotGroup) => (
                    <div key={slotGroup.period} className="space-y-1.5">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold px-1">
                        {slotGroup.period}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {slotGroup.times.map((time) => {
                          const isPicked = selectedTime === time;
                          return (
                            <button
                              key={time}
                              type="button"
                              onClick={() => {
                                setSelectedTime(time);
                                setStep(5);
                              }}
                              className={`py-2 px-2 rounded-xl text-xs font-semibold border transition text-center shadow-sm flex items-center justify-center ${
                                isPicked
                                  ? "bg-accent text-slate-950 font-bold border-accent shadow-md shadow-accent/20"
                                  : "border-slate-700 bg-slate-800/80 text-slate-200 hover:border-accent hover:bg-slate-750 hover:text-white"
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
              )}
            </>
          )}

          {step === 5 && selectedTime && (
            <>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-accent text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                  ✂️
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-slate-200 max-w-[85%] shadow">
                  Excelente escolha! Revise os detalhes e preencha seus dados para finalizar:
                </div>
              </div>

              {/* Card de Resumo do Agendamento */}
              <div className="p-3.5 rounded-2xl border border-slate-700 bg-slate-800/70 text-xs space-y-2.5">
                <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
                  <span className="text-slate-400">Serviço:</span>
                  <span className="font-bold text-white text-sm">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Profissional:</span>
                  <span className="font-semibold text-slate-200">{selectedProfessional?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Data e Horário:</span>
                  <div className="flex items-center gap-1.5 font-bold text-accent">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {(() => {
                        const opt = dateOptions.find((d) => d.dateString === selectedDate);
                        return opt ? `${opt.dayName}, ${opt.dayNumber} de ${opt.month}` : selectedDate;
                      })()}{" "}
                      às {selectedTime}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Valor:</span>
                  <span className="font-bold text-emerald-400">
                    {selectedService ? formatCurrency(selectedService.price_cents) : "A consultar"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="w-full mt-1 py-1.5 text-[11px] text-accent hover:underline text-center"
                >
                  ← Trocar dia ou horário
                </button>
              </div>

              <div className="space-y-3 pt-1">
                {/* Card de Identificação do Cliente (Já identificado no Início do Chat) */}
                <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-accent" />
                      Identificação do Cliente
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-accent text-[11px] hover:underline font-semibold"
                    >
                      Alterar
                    </button>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Nome:</span>
                    <strong className="text-white">{customerName}</strong>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">WhatsApp:</span>
                    <strong className="text-emerald-400">{formatPhone(customerPhone)}</strong>
                  </div>
                </div>

                {(bookingErrorMessage || error) && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] p-2.5 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{bookingErrorMessage || error}</span>
                  </div>
                )}

                <button
                  onClick={handleConfirmBooking}
                  disabled={bookingLoading}
                  className="w-full py-3.5 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                >
                  {bookingLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirmando Reserva...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar Agendamento</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 6 && bookingId && (
            <div className="space-y-4 pt-1">
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200 space-y-3 shadow-lg">
                <div className="flex items-center gap-2.5 font-bold text-base text-emerald-300">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <span>Agendamento Confirmado!</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/20 text-xs space-y-2 text-slate-200">
                  <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800">
                    <span>Código da Reserva:</span>
                    <strong className="text-accent font-mono text-sm font-bold">#{bookingId}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Serviço:</span>
                    <strong className="text-white">{selectedService?.name}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Profissional:</span>
                    <strong className="text-white">{selectedProfessional?.name || "Qualquer Barbeiro"}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Data e Horário:</span>
                    <strong className="text-emerald-300">
                      {new Date(selectedDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} às {selectedTime}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Cliente:</span>
                    <strong className="text-white">{customerName}</strong>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Valor Estimado:</span>
                    <strong className="text-white font-bold">{selectedService ? formatCurrency(selectedService.price_cents) : "A consultar"}</strong>
                  </div>
                </div>
              </div>

              {/* Endereço e Localização no Mapa */}
              {tenantAddress && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-1">
                    <MapPin className="w-3.5 h-3.5 text-accent" />
                    <span>Como Chegar à Barbearia</span>
                  </div>

                  {typeof tenant.settings?.latitude === "number" && typeof tenant.settings?.longitude === "number" ? (
                    <MapLocationViewer
                      latitude={tenant.settings.latitude}
                      longitude={tenant.settings.longitude}
                      title={tenant.trade_name || tenant.name}
                      addressText={tenantAddress}
                    />
                  ) : (
                    <div className="p-3.5 rounded-xl border border-slate-700 bg-slate-800/80 text-xs text-slate-200 space-y-2">
                      <div className="font-semibold flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-accent shrink-0" />
                        <span>{tenantAddress}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${tenantAddress}, Brasil`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold flex items-center gap-1 text-[11px]"
                        >
                          <Navigation className="w-3 h-3 text-accent" />
                          <span>Abrir no Google Maps</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botões de Ação Final */}
              <div className="space-y-2 pt-1">
                {(() => {
                  const lat = tenant.settings?.latitude;
                  const lng = tenant.settings?.longitude;
                  const mapsUrl = (lat && lng)
                    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenantAddress || "Barbearia")}`;

                  const message = encodeURIComponent(
                    `✂️ *Agendamento Confirmado!*\n` +
                    `💈 *Barbearia:* ${tenant.trade_name || tenant.name}\n` +
                    `📋 *Código:* #${bookingId}\n` +
                    `✂️ *Serviço:* ${selectedService?.name}\n` +
                    `👤 *Profissional:* ${selectedProfessional?.name || "Equipe"}\n` +
                    `📅 *Data:* ${new Date(selectedDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} às ${selectedTime}\n` +
                    `👤 *Cliente:* ${customerName}\n` +
                    `📍 *Endereço:* ${tenantAddress || "Ver no link abaixo"}\n` +
                    `🗺️ *Localização no Mapa:* ${mapsUrl}\n\n` +
                    `Aguardamos você!`
                  );

                  const targetPhone = (tenant.phone || "").replace(/\D/g, "") || customerPhone;
                  const waUrl = `https://wa.me/55${targetPhone}?text=${message}`;

                  return (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Salvar Comprovante no WhatsApp</span>
                    </a>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setSelectedService(null);
                    setSelectedProfessional(null);
                    setSelectedDate("");
                    setSelectedTime("");
                    setBookingId("");
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Fazer Outro Agendamento
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="p-3 bg-slate-950/80 border-t border-slate-800 text-center text-[10px] text-slate-500">
          Powered by <span className="text-accent font-semibold">MetricBarber</span> • Agendamento Seguro
        </footer>
      </div>
    </div>
  );
};
