import React, { useEffect, useState } from "react";
import { Scissors, Plus, Clock, DollarSign, Check, Edit2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export const ServicesPage: React.FC = () => {
  const { tenant } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;

    const loadServices = async () => {
      const { data } = await (supabase.from("services") as any)
        .select("id, name, category, price_cents, duration_minutes, buffer_minutes, is_active, professional_services(count)")
        .eq("tenant_id", tenant.id)
        .order("name");
      setServices((data || []).map((service: any) => ({
        ...service,
        professionals_count: service.professional_services?.[0]?.count || 0,
      })));
      setLoading(false);
    };

    loadServices();
  }, [tenant?.id]);

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
        {loading && <div className="md:col-span-2 lg:col-span-3 text-sm text-slate-500">Carregando serviços...</div>}
        {!loading && services.map((srv) => (
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
