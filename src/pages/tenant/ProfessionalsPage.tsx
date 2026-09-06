import React, { useEffect, useState } from "react";
import { UserCheck, Plus, Clock, Percent, Calendar, Edit2, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export const ProfessionalsPage: React.FC = () => {
  const { tenant } = useAuth();
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;

    const loadProfessionals = async () => {
      const { data } = await (supabase.from("professionals") as any)
        .select("id, name, nickname, phone, email, commission_rate, color_hex, is_active")
        .eq("tenant_id", tenant.id)
        .order("display_order");
      setProfessionals(data || []);
      setLoading(false);
    };

    loadProfessionals();
  }, [tenant?.id]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Equipe de Profissionais</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Escala individual de trabalho, comissões e visualização por cor na agenda
          </p>
        </div>
        <button className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-md shadow-amber-500/20 flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          <span>Cadastrar Profissional</span>
        </button>
      </div>

      {/* Professionals List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading && <div className="md:col-span-3 text-sm text-slate-500">Carregando profissionais...</div>}
        {!loading && professionals.map((pro) => (
          <div
            key={pro.id}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-base shadow"
                  style={{ backgroundColor: pro.color_hex }}
                >
                  {pro.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">{pro.name}</h3>
                  <div className="text-xs text-slate-400">{pro.nickname}</div>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Comissão de Atendimento:</span>
                  <span className="font-bold text-slate-900">{pro.commission_rate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Escala de Horários:</span>
                  <span className="font-medium text-slate-800">Escala não configurada</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Contato:</span>
                  <span className="font-medium text-slate-800">{pro.phone}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                Ativo na Barbearia
              </span>
              <button className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1">
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar Escala</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
