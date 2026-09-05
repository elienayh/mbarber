import React, { useState } from "react";
import { UserCheck, Plus, Clock, Percent, Calendar, Edit2, Shield } from "lucide-react";

export const ProfessionalsPage: React.FC = () => {
  const [professionals, setProfessionals] = useState([
    {
      id: "p1",
      name: "João Silva",
      nickname: "Navalha de Ouro",
      phone: "(11) 98888-1111",
      email: "joao@barbeariavintage.com",
      commission_rate: 50,
      color_hex: "#3b82f6",
      is_active: true,
      role: "Barbeiro Sênior",
      working_days: "Seg a Sáb (09h - 19h)",
    },
    {
      id: "p2",
      name: "Carlos Barbeiro",
      nickname: "Mestre da Barboterapia",
      phone: "(11) 97777-2222",
      email: "carlos@barbeariavintage.com",
      commission_rate: 50,
      color_hex: "#10b981",
      is_active: true,
      role: "Barbeiro Pleno",
      working_days: "Ter a Sáb (10h - 20h)",
    },
    {
      id: "p3",
      name: "Lucas Ferreira",
      nickname: "Especialista em Freestyle",
      phone: "(11) 96666-3333",
      email: "lucas@barbeariavintage.com",
      commission_rate: 45,
      color_hex: "#8b5cf6",
      is_active: true,
      role: "Barbeiro Júnior",
      working_days: "Qua a Dom (11h - 20h)",
    },
  ]);

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
        {professionals.map((pro) => (
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
                  <span className="font-medium text-slate-800">{pro.working_days}</span>
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
