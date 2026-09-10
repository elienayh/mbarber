import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const AuditPage: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const loadLogs = async () => {
      const { data, error: queryError } = await (supabase.from("audit_logs") as any).select("id, created_at, actor_email, action, entity_type, entity_id, new_state, ip_address").order("created_at", { ascending: false }).limit(200);
      setAuditLogs(data || []);
      if (queryError) setError(queryError.message);
      setLoading(false);
    };
    loadLogs();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <h2 className="text-xl sm:text-2xl font-black text-white">Trilha de Auditoria & Compliance</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Registro imutável de ações administrativas, alterações de planos e webhooks
        </p>
      </div>
      {loading && <div className="bg-slate-950 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-400">Carregando auditoria...</div>}
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {!loading && !error && auditLogs.length === 0 && <div className="bg-slate-950 rounded-xl border border-slate-800 px-4 py-8 text-center text-sm text-slate-400">Nenhum evento registrado.</div>}

      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="md:hidden divide-y divide-slate-900">
          {auditLogs.map((log) => (
            <article key={log.id} className="px-4 py-4 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold text-white">{log.actor_email || "Sistema"}</span>
                <span className="font-mono text-slate-500">{new Date(log.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-800 px-2 py-1 font-mono text-accent">{log.action}</span>
                <span className="text-slate-300">{log.entity_type}</span>
              </div>
              <p className="break-words text-slate-400">{JSON.stringify(log.new_state || {})}</p>
            </article>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
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
                  <td className="py-3.5 px-4 font-mono text-slate-400">{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                  <td className="py-3.5 px-4 font-semibold text-white">{log.actor_email || "Sistema"}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-accent font-mono">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">{log.entity_type} {log.entity_id || ""}</td>
                  <td className="py-3.5 px-4 text-slate-400">{JSON.stringify(log.new_state || {})}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-500">{log.ip_address || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
