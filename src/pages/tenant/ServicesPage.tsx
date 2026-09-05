import React, { useState } from "react";
import { Scissors, Plus, Clock, DollarSign, Check, Edit2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const ServicesPage: React.FC = () => {
  const [services, setServices] = useState([
    {
      id: "s1",
      name: "Corte Tradicional / Degradê",
      category: "Cabelo",
      price_cents: 4500,
      duration_minutes: 30,
      buffer_minutes: 5,
      is_active: true,
      professionals_count: 3,
    },
    {
      id: "s2",
      name: "Barba Terapia com Toalha Quente",
      category: "Barba",
      price_cents: 3500,
      duration_minutes: 30,
      buffer_minutes: 5,
      is_active: true,
      professionals_count: 2,
    },
    {
      id: "s3",
      name: "Combo Cabelo + Barba Completa",
      category: "Combos",
      price_cents: 7000,
      duration_minutes: 50,
      buffer_minutes: 10,
      is_active: true,
      professionals_count: 3,
    },
    {
      id: "s4",
      name: "Acabamento / Pezinho / Sobrancelha",
      category: "Acabamento",
      price_cents: 2000,
      duration_minutes: 20,
      buffer_minutes: 0,
      is_active: true,
      professionals_count: 3,
    },
    {
      id: "s5",
      name: "Platinado / Descoloração Global",
      category: "Química",
      price_cents: 15000,
      duration_minutes: 120,
      buffer_minutes: 15,
      is_active: false,
      professionals_count: 1,
    },
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Catálogo de Serviços</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Duração, valores e vínculo com os barbeiros habilitados
          </p>
        </div>
        <button className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-md shadow-amber-500/20 flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Serviço</span>
        </button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((srv) => (
          <div
            key={srv.id}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-amber-400 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  {srv.category}
                </span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    srv.is_active ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  title={srv.is_active ? "Serviço Ativo" : "Serviço Inativo"}
                />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">{srv.name}</h3>
              <div className="text-xs text-slate-400 flex items-center gap-3 mt-3">
                <span className="flex items-center gap-1 text-slate-600 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  {srv.duration_minutes} min {srv.buffer_minutes > 0 && `(+${srv.buffer_minutes}m buffer)`}
                </span>
                <span>•</span>
                <span>{srv.professionals_count} barbeiros habilitados</span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-lg font-black text-slate-900">
                {formatCurrency(srv.price_cents)}
              </span>
              <button className="p-2 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-50 transition">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
