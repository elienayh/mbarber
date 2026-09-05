import React, { useState } from "react";
import { Building2, Search, ExternalLink, ShieldCheck, AlertCircle, Ban } from "lucide-react";
import { Link } from "react-router-dom";

export const TenantsListPage: React.FC = () => {
  const [tenants, setTenants] = useState([
    {
      id: "t1",
      name: "Barbearia Vintage Club",
      slug: "vintage-barber",
      owner: "Oliveira Santos",
      phone: "(11) 98765-4321",
      plan: "Plano Pro",
      status: "active",
      barbers_count: 3,
    },
    {
      id: "t2",
      name: "Dom Pedro Barbearia Tradicional",
      slug: "dom-pedro",
      owner: "Pedro Henrique",
      phone: "(21) 99887-1122",
      plan: "Plano Pro",
      status: "active",
      barbers_count: 5,
    },
    {
      id: "t3",
      name: "Studio Barber Prime",
      slug: "barber-prime",
      owner: "Marcos Lima",
      phone: "(31) 98765-9988",
      plan: "Plano Solo",
      status: "trial",
      barbers_count: 1,
    },
    {
      id: "t4",
      name: "Navalha de Ouro Barbearia",
      slug: "navalha-ouro",
      owner: "Gabriel Souza",
      phone: "(41) 97766-5544",
      plan: "Plano Pro",
      status: "past_due",
      barbers_count: 4,
    },
    {
      id: "t5",
      name: "Barbearia do Bairro Antigo",
      slug: "bairro-antigo",
      owner: "Antonio Silva",
      phone: "(51) 96655-4433",
      plan: "Plano Solo",
      status: "suspended",
      barbers_count: 1,
    },
  ]);

  const handleToggleStatus = (id: string) => {
    setTenants((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === "active" ? "suspended" : "active" }
          : t
      )
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Ativo</span>;
      case "trial":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Trial (12 dias)</span>;
      case "past_due":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">Inadimplente</span>;
      case "suspended":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-400">Suspenso</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Barbearias Cadastradas (Tenants)</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Gestão de contas, status de assinatura e controle de suspensão/reativação
          </p>
        </div>
      </div>

      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-slate-400 font-semibold text-xs border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Barbearia</th>
                <th className="py-3.5 px-4">Slug Público</th>
                <th className="py-3.5 px-4">Proprietário</th>
                <th className="py-3.5 px-4">Plano</th>
                <th className="py-3.5 px-4">Barbeiros</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-slate-300">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-900/50 transition">
                  <td className="py-3.5 px-4 font-bold text-white">{t.name}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-amber-400">
                    <Link to={`/${t.slug}`} target="_blank" className="hover:underline flex items-center gap-1">
                      /{t.slug} <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-xs">{t.owner}</td>
                  <td className="py-3.5 px-4 text-xs font-semibold">{t.plan}</td>
                  <td className="py-3.5 px-4 text-xs">{t.barbers_count} cadeiras</td>
                  <td className="py-3.5 px-4">{getStatusBadge(t.status)}</td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleToggleStatus(t.id)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                        t.status === "active"
                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
                          : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                      }`}
                    >
                      {t.status === "active" ? "Suspender" : "Reativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
