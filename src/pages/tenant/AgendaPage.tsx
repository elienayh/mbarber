import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Scissors,
  X,
  Repeat,
  Lock,
} from "lucide-react";
import { formatCurrency, formatPhone } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Appointment {
  id: string;
  barberId: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  time: string;
  durationMinutes: number;
  priceCents: number;
  status: "scheduled" | "confirmed" | "in_progress" | "completed" | "canceled";
  isRecurrent?: boolean;
}

interface Barber {
  id: string;
  name: string;
  nickname: string | null;
  color: string;
}

interface ServiceOption {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
}

export const AgendaPage: React.FC = () => {
  const { tenant } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBarber, setNewBarber] = useState("");
  const [newService, setNewService] = useState("");
  const [newTime, setNewTime] = useState("15:00");
  const [isRecurrent, setIsRecurrent] = useState(false);

  const dateLabel = useMemo(() => {
    return new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }, [selectedDate]);

  useEffect(() => {
    if (!tenant?.id) return;

    const loadAgenda = async () => {
      setLoading(true);
      setError(null);
      const start = `${selectedDate}T00:00:00`;
      const end = `${selectedDate}T23:59:59`;

      const [{ data: professionalsData, error: professionalsError }, { data: servicesData, error: servicesError }, { data: appointmentsData, error: appointmentsError }] = await Promise.all([
        (supabase.from("professionals") as any)
          .select("id, name, nickname, color_hex")
          .eq("tenant_id", tenant.id)
          .eq("is_active", true)
          .order("display_order"),
        (supabase.from("services") as any)
          .select("id, name, price_cents, duration_minutes")
          .eq("tenant_id", tenant.id)
          .eq("is_active", true)
          .order("name"),
        (supabase.from("appointments") as any)
          .select("id, professional_id, start_time, duration_minutes, price_cents, status, customers(name, phone), services(name)")
          .eq("tenant_id", tenant.id)
          .gte("start_time", start)
          .lte("start_time", end)
          .neq("status", "canceled")
          .order("start_time"),
      ]);

      if (professionalsError || servicesError || appointmentsError) {
        setError("Não foi possível carregar a agenda.");
        setLoading(false);
        return;
      }

      const loadedBarbers = (professionalsData || []).map((professional: any) => ({
        id: professional.id,
        name: professional.name,
        nickname: professional.nickname,
        color: professional.color_hex || "#f59e0b",
      }));
      const loadedServices = (servicesData || []) as ServiceOption[];

      setBarbers(loadedBarbers);
      setServices(loadedServices);
      setNewBarber((current) => current || loadedBarbers[0]?.id || "");
      setNewService((current) => current || loadedServices[0]?.id || "");
      setAppointments((appointmentsData || []).map((appointment: any) => ({
        id: appointment.id,
        barberId: appointment.professional_id,
        customerName: appointment.customers?.name || "Cliente",
        customerPhone: appointment.customers?.phone || "",
        serviceName: appointment.services?.name || "Serviço",
        time: new Date(appointment.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        durationMinutes: appointment.duration_minutes,
        priceCents: appointment.price_cents,
        status: appointment.status,
      })));
      setLoading(false);
    };

    loadAgenda();
  }, [selectedDate, tenant?.id]);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const service = services.find((item) => item.id === newService);
    if (!tenant?.id || !newCustomer || !newTime || !newBarber || !service) return;

    const { data: customer, error: customerError } = await (supabase.from("customers") as any)
      .upsert({ tenant_id: tenant.id, name: newCustomer, phone: newPhone.replace(/\D/g, "") }, { onConflict: "tenant_id,phone" })
      .select("id")
      .single();

    if (customerError || !customer) {
      setError("Não foi possível salvar o cliente.");
      return;
    }

    const startTime = `${selectedDate}T${newTime}:00`;
    const { error: appointmentError } = await (supabase.from("appointments") as any).insert({
      tenant_id: tenant.id,
      customer_id: customer.id,
      professional_id: newBarber,
      service_id: service.id,
      start_time: startTime,
      end_time: new Date(new Date(startTime).getTime() + service.duration_minutes * 60000).toISOString(),
      duration_minutes: service.duration_minutes,
      price_cents: service.price_cents,
      commission_rate: 0,
      commission_cents: 0,
      status: "scheduled",
      origin: "backoffice",
    });

    if (appointmentError) {
      setError(appointmentError.message);
      return;
    }

    setIsNewModalOpen(false);
    setNewCustomer("");
    setNewPhone("");
    setError(null);
    setSelectedDate(selectedDate);
  };

  const timeSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "13:00", "13:30", "14:00", "14:30", "15:00",
    "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
    "18:30", "19:00", "19:30"
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto h-full flex flex-col">
      {/* Agenda Header Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const date = new Date(`${selectedDate}T12:00:00`);
              date.setDate(date.getDate() - 1);
              setSelectedDate(date.toISOString().slice(0, 10));
            }}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Dia anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold text-sm text-slate-800">
            <CalendarIcon className="w-4 h-4 text-amber-500" />
            <span className="capitalize">{dateLabel}</span>
          </div>
          <button
            onClick={() => {
              const date = new Date(`${selectedDate}T12:00:00`);
              date.setDate(date.getDate() + 1);
              setSelectedDate(date.toISOString().slice(0, 10));
            }}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Próximo dia"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-md shadow-amber-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Carregando agenda...</div>
      )}

      {/* Multi-Barber Agenda Grid */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        {/* Barber Headers */}
        <div
          className="grid border-b border-slate-200 bg-slate-50 font-bold text-xs text-slate-700"
          style={{ gridTemplateColumns: `minmax(90px, 0.8fr) repeat(${Math.max(barbers.length, 1)}, minmax(160px, 1fr))` }}
        >
          <div className="p-3 border-r border-slate-200 text-slate-400 flex items-center justify-center">
            Horário
          </div>
          {barbers.map((barber) => (
            <div key={barber.id} className="p-3 border-r last:border-r-0 border-slate-200 flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: barber.color }}
              />
              <div>
                <span className="font-bold text-slate-900 text-sm">{barber.name}</span>
                <span className="text-slate-400 font-normal ml-1">({barber.nickname})</span>
              </div>
            </div>
          ))}
        </div>

        {/* Time Grid Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {timeSlots.map((slot) => (
            <div
              key={slot}
              className="grid min-h-[56px] hover:bg-slate-50/50"
              style={{ gridTemplateColumns: `minmax(90px, 0.8fr) repeat(${Math.max(barbers.length, 1)}, minmax(160px, 1fr))` }}
            >
              {/* Time column */}
              <div className="p-2 border-r border-slate-100 text-xs font-bold text-slate-400 flex items-center justify-center">
                {slot}
              </div>

              {/* Barber columns */}
              {barbers.map((barber) => {
                const app = appointments.find(
                  (a) => a.barberId === barber.id && a.time === slot
                );

                return (
                  <div
                    key={barber.id}
                    className="p-1.5 border-r last:border-r-0 border-slate-100 relative flex items-center"
                  >
                    {app && (
                      <div
                        className="w-full h-full rounded-xl p-2 text-xs border shadow-sm flex flex-col justify-between transition cursor-pointer hover:shadow"
                        style={{
                          backgroundColor: `${barber.color}15`,
                          borderColor: barber.color,
                        }}
                      >
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span className="truncate">{app.customerName}</span>
                          {app.isRecurrent && (
                            <span title="Recorrente"><Repeat className="w-3 h-3 text-purple-600 shrink-0" /></span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate">{app.serviceName}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* New Appointment Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Novo Agendamento</h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo"
                  value={newCustomer}
                  onChange={(e) => setNewCustomer(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Barbeiro</label>
                  <select
                    value={newBarber}
                    onChange={(e) => setNewBarber(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-amber-500 bg-white"
                  >
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Horário</label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Serviço</label>
                <select
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-amber-500 bg-white"
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({formatCurrency(service.price_cents)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Recurrence Switch */}
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-purple-700" />
                  <div>
                    <div className="text-xs font-bold text-purple-950">Agendamento Recorrente</div>
                    <div className="text-[11px] text-purple-700">Repetir semanalmente por 4 semanas</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isRecurrent}
                  onChange={(e) => setIsRecurrent(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-md shadow-amber-500/20"
                >
                  Salvar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
