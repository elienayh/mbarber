import React from "react";
import { FileText, Shield, User } from "lucide-react";

export const AuditPage: React.FC = () => {
  const auditLogs = [
    {
      id: "l1",
      timestamp: "05/09/2026 09:15:32",
      actor: "superadmin@metricbarber.com.br",
      action: "tenant.status_change",
      entity: "Barbearia do Bairro Antigo",
      detail: "Status alterado de past_due para suspended",
      ip: "189.40.12.88",
    },
    {
      id: "l2",
      timestamp: "05/09/2026 08:30:10",
      actor: "stripe_webhook",
      action: "subscription.payment_succeeded",
      entity: "Barbearia Vintage Club",
      detail: "Renovação mensal aprovada (R$ 79,00)",
      ip: "54.187.205.1 (Stripe IP)",
    },
    {
      id: "l3",
      timestamp: "04/09/2026 18:45:00",
      actor: "oliveira@barbeariavintage.com",
      action: "professional.created",
      entity: "Lucas Ferreira",
      detail: "Novo profissional adicionado à equipe",
      ip: "177.105.80.12",
    },
    {
      id: "l4",
      timestamp: "04/09/2026 14:20:11",
      actor: "superadmin@metricbarber.com.br",
      action: "plan.updated",
      entity: "Plano Barbearia Pro",
      detail: "Limite de barbeiros ajustado de 4 para 5",
      ip: "189.40.12.88",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <h2 className="text-xl sm:text-2xl font-black text-white">Trilha de Auditoria & Compliance</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Registro imutável de ações administrativas, alterações de planos e webhooks
        </p>
      </div>

      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-slate-400 font-semibold text-xs border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Data/Hora</th>
                <th className="py-3.5 px-4">Ator</th>
                <th className="py-3.5 px-4">Ação</th>
                <th className="py-3.5 px-4">Entidade Afetada</th>
                <th className="py-3.5 px-4">Detalhes</th>
                <th className="py-3.5 px-4">Endereço IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-xs">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/50 transition">
                  <td className="py-3.5 px-4 font-mono text-slate-400">{log.timestamp}</td>
                  <td className="py-3.5 px-4 font-semibold text-white">{log.actor}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">{log.entity}</td>
                  <td className="py-3.5 px-4 text-slate-400">{log.detail}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-500">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
