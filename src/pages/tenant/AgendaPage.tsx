import React, { useState } from "react";
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

export const AgendaPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState("Hoje - Quinta, 5 de Setembro");

  const barbers = [
    { id: "b1", name: "João Silva", nickname: "Navalha", color: "#3b82f6" },
    { id: "b2", name: "Carlos Barbeiro", nickname: "Mestre", color: "#10b981" },
    { id: "b3", name: "Lucas Ferreira", nickname: "Freestyle", color: "#8b5cf6" },
  ];

  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      id: "1",
      barberId: "b1",
      customerName: "Rodrigo Almeida",
      customerPhone: "11988887777",
      serviceName: "Corte Degradê",
      time: "09:30",
      durationMinutes: 30,
      priceCents: 4500,
      status: "completed",
    },
    {
      id: "2",
      barberId: "b1",
      customerName: "Felipe Rodrigues",
      customerPhone: "11977776666",
      serviceName: "Barboterapia",
      time: "11:00",
      durationMinutes: 30,
      priceCents: 3500,
      status: "confirmed",
      isRecurrent: true,
    },
    {
      id: "3",
      barberId: "b2",
      customerName: "Guilherme Santos",
      customerPhone: "11966665555",
      serviceName: "Combo Cabelo + Barba",
      time: "10:30",
      durationMinutes: 50,
      priceCents: 7000,
      status: "in_progress",
    },
    {
      id: "4",
      barberId: "b3",
      customerName: "Eduardo Lima",
      customerPhone: "11955554444",
      serviceName: "Corte Tradicional",
      time: "14:00",
      durationMinutes: 30,
      priceCents: 4500,
      status: "scheduled",
    },
  ]);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBarber, setNewBarber] = useState(barbers[0].id);
  const [newService, setNewService] = useState("Corte Degradê");
  const [newTime, setNewTime] = useState("15:00");
  const [isRecurrent, setIsRecurrent] = useState(false);

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer || !newTime) return;

    const newApp: Appointment = {
      id: Date.now().toString(),
      barberId: newBarber,
      customerName: newCustomer,
      customerPhone: newPhone || "11999998888",
      serviceName: newService,
      time: newTime,
      durationMinutes: 30,
      priceCents: 4500,
      status: "scheduled",
      isRecurrent,
    };

    setAppointments((prev) => [...prev, newApp]);
    setIsNewModalOpen(false);
    setNewCustomer("");
    setNewPhone("");
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
          <button className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold text-sm text-slate-800">
            <CalendarIcon className="w-4 h-4 text-amber-500" />
            <span>{selectedDate}</span>
          </div>
          <button className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
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

      {/* Multi-Barber Agenda Grid */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        {/* Barber Headers */}
        <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 font-bold text-xs text-slate-700">
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
            <div key={slot} className="grid grid-cols-4 min-h-[56px] hover:bg-slate-50/50">
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
                  <option>Corte Tradicional / Degradê (R$ 45,00)</option>
                  <option>Barba Terapia com Toalha Quente (R$ 35,00)</option>
                  <option>Combo Cabelo + Barba (R$ 70,00)</option>
                  <option>Acabamento / Sobrancelha (R$ 20,00)</option>
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
