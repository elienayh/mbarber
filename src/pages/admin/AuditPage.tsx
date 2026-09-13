import React, { useEffect, useMemo, useState } from "react";
import { 
  ShieldAlert, 
  Search, 
  Trash2, 
  Calendar, 
  User, 
  Package, 
  Scissors, 
  UserCheck, 
  Eye, 
  X, 
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Clock
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";

interface AuditLog {
  id: string;
  created_at: string;
  actor_email: string;
  actor_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  previous_state?: any;
  previous_data?: any;
  new_state?: any;
  deletion_reason?: string;
  ip_address?: string;
}

export const AuditPage: React.FC = () => {
  const { tenant } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterAction, setFilterAction] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"today" | "7days" | "30days" | "all">("30days");

  // Selected Log for detail modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);

    // 1. Verificar cache local primeiro para carregamento instantâneo
    if (tenant?.id) {
      try {
        const cached = localStorage.getItem(`mb_audit_logs_${tenant.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAuditLogs(parsed);
          }
        }
      } catch (e) {
        console.warn("Falha ao ler cache local de auditoria:", e);
      }
    }

    try {
      let query = (supabase.from("audit_logs") as any)
        .select("id, created_at, actor_email, action, entity_type, entity_id, previous_state, previous_data, new_state, deletion_reason, ip_address")
        .order("created_at", { ascending: false })
        .limit(300);

      // Se for no contexto de uma barbearia (tenant), filtrar estritamente por tenant_id
      if (tenant?.id) {
        query = query.eq("tenant_id", tenant.id);
      }

      const { data, error: queryError } = await query;

      if (!queryError && data) {
        setAuditLogs(data);
        if (tenant?.id && data.length > 0) {
          try {
            localStorage.setItem(`mb_audit_logs_${tenant.id}`, JSON.stringify(data));
          } catch {}
        }
      } else if (queryError) {
        console.warn("Erro ao buscar audit_logs do Supabase:", queryError.message);
        // Não quebra caso o cache local já tenha registros
      }
    } catch (err: any) {
      console.warn("Erro de conexão ao carregar logs:", err);
      setError(err?.message || "Não foi possível conectar ao servidor de auditoria.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [tenant?.id]);

  // Filtragem dos logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // 1. Filtro de Tipo de Ação
      if (filterAction === "deletions") {
        const isDel = log.action === "delete" || log.action === "soft_delete" || log.action.includes("delete") || log.action.includes("cancel");
        if (!isDel) return false;
      } else if (filterAction === "appointment") {
        if (log.entity_type !== "appointment") return false;
      } else if (filterAction === "product") {
        if (log.entity_type !== "product") return false;
      } else if (filterAction === "professional") {
        if (log.entity_type !== "professional") return false;
      } else if (filterAction === "service") {
        if (log.entity_type !== "service") return false;
      }

      // 2. Filtro de Período
      if (periodFilter !== "all") {
        const logDate = new Date(log.created_at).getTime();
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        if (periodFilter === "today") {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          if (logDate < startOfDay.getTime()) return false;
        } else if (periodFilter === "7days" && now - logDate > 7 * oneDay) {
          return false;
        } else if (periodFilter === "30days" && now - logDate > 30 * oneDay) {
          return false;
        }
      }

      // 3. Busca Textual
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const email = (log.actor_email || "").toLowerCase();
        const action = (log.action || "").toLowerCase();
        const entity = (log.entity_type || "").toLowerCase();
        const reason = (log.deletion_reason || "").toLowerCase();
        const detailsStr = JSON.stringify(log.previous_data || log.previous_state || {}).toLowerCase();

        return (
          email.includes(query) ||
          action.includes(query) ||
          entity.includes(query) ||
          reason.includes(query) ||
          detailsStr.includes(query)
        );
      }

      return true;
    });
  }, [auditLogs, filterAction, periodFilter, searchQuery]);

  // Contadores para métricas
  const stats = useMemo(() => {
    const total = auditLogs.length;
    const deletions = auditLogs.filter(
      (l) => l.action === "delete" || l.action === "soft_delete" || l.action.includes("delete") || l.action.includes("cancel")
    ).length;
    const appointmentDeletes = auditLogs.filter(
      (l) => l.entity_type === "appointment" && (l.action === "soft_delete" || l.action === "delete")
    ).length;

    return { total, deletions, appointmentDeletes };
  }, [auditLogs]);

  // Helper para renderizar dados prévios (snapshot)
  const renderSnapshotSummary = (log: AuditLog) => {
    const data = log.previous_data || log.previous_state;
    if (!data) return <span className="text-slate-400 italic">Sem snapshot detalhado</span>;

    if (log.entity_type === "appointment") {
      const client = data.customer_name || data.customerName || "Cliente";
      const service = data.service_name || data.serviceName || "Serviço";
      const priceCents = data.price_cents ?? data.priceCents ?? 0;
      const date = data.start_time ? new Date(data.start_time).toLocaleDateString("pt-BR") : "";

      return (
        <div className="text-xs space-y-0.5">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <span className="text-emerald-700 font-bold">{formatCurrency(priceCents)}</span>
            <span>•</span>
            <span className="truncate">{client}</span>
          </div>
          <div className="text-slate-500 text-[11px] truncate">
            {service} {date ? `(${date})` : ""}
          </div>
        </div>
      );
    }

    if (log.entity_type === "product") {
      const name = data.name || "Produto";
      const sku = data.sku ? `[${data.sku}]` : "";
      const priceCents = data.sale_price_cents || data.salePriceCents || 0;
      return (
        <div className="text-xs">
          <span className="font-semibold text-slate-900">{name}</span> {sku}{" "}
          <span className="text-emerald-700 font-bold ml-1">{formatCurrency(priceCents)}</span>
        </div>
      );
    }

    if (log.entity_type === "professional") {
      const name = data.name || "Profissional";
      const email = data.email || "";
      return (
        <div className="text-xs">
          <span className="font-semibold text-slate-900">{name}</span>
          {email && <span className="text-slate-500 ml-1">({email})</span>}
        </div>
      );
    }

    if (log.entity_type === "service") {
      const name = data.name || "Serviço";
      const priceCents = data.price_cents || data.priceCents || 0;
      return (
        <div className="text-xs">
          <span className="font-semibold text-slate-900">{name}</span>
          <span className="text-emerald-700 font-bold ml-1">{formatCurrency(priceCents)}</span>
        </div>
      );
    }

    return (
      <span className="text-xs text-slate-600 truncate max-w-xs block">
        {data.name || data.title || data.description || JSON.stringify(data).slice(0, 50)}
      </span>
    );
  };

  const getActionBadge = (action: string) => {
    if (action === "soft_delete" || action === "delete" || action.includes("delete")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
          <Trash2 className="w-3 h-3" />
          Exclusão
        </span>
      );
    }
    if (action.includes("cancel")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3 h-3" />
          Cancelamento
        </span>
      );
    }
    if (action.includes("update")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
          Alteração
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
        {action}
      </span>
    );
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "appointment":
        return <Calendar className="w-4 h-4 text-blue-600" />;
      case "product":
        return <Package className="w-4 h-4 text-amber-600" />;
      case "professional":
        return <UserCheck className="w-4 h-4 text-purple-600" />;
      case "service":
        return <Scissors className="w-4 h-4 text-emerald-600" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center shrink-0 border border-red-100">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Trilha de Auditoria & Anti-fraude</h2>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                Imutável
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Registro histórico completo de exclusões, cancelamentos e operações realizadas pela equipe.
            </p>
          </div>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-bold text-xs shadow-sm transition flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface-card-light p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total de Eventos</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Últimos registros
          </div>
        </div>

        <div className="surface-card-light p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-red-600 uppercase tracking-wide flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" />
            Total de Exclusões
          </div>
          <div className="text-2xl font-black text-red-600 mt-1">{stats.deletions}</div>
          <div className="text-xs text-slate-500 mt-1">Registros com trilha anti-fraude</div>
        </div>

        <div className="surface-card-light p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            Atendimentos Excluídos
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">{stats.appointmentDeletes}</div>
          <div className="text-xs text-slate-500 mt-1">Valores preservados no caixa</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="surface-card-light p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por funcionário, cliente ou motivo..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition"
          />
        </div>

        {/* Action Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setFilterAction("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filterAction === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterAction("deletions")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              filterAction === "deletions"
                ? "bg-red-600 text-white shadow-sm"
                : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
            }`}
          >
            <Trash2 className="w-3 h-3" />
            Apenas Exclusões (Anti-fraude)
          </button>
          <button
            onClick={() => setFilterAction("appointment")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filterAction === "appointment"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Atendimentos
          </button>
          <button
            onClick={() => setFilterAction("product")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filterAction === "product"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Produtos
          </button>
          <button
            onClick={() => setFilterAction("professional")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filterAction === "professional"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Profissionais
          </button>
        </div>

        {/* Period Filter */}
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as any)}
          className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 self-end md:self-auto"
        >
          <option value="today">Hoje</option>
          <option value="7days">Últimos 7 dias</option>
          <option value="30days">Últimos 30 dias</option>
          <option value="all">Todo o período</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Logs Table / Cards */}
      <div className="surface-card-light rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && (
          <div className="p-8 text-center text-xs text-slate-500 font-medium">
            Carregando registros de auditoria...
          </div>
        )}

        {!loading && filteredLogs.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Nenhum registro encontrado</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Nenhum evento registrado com os filtros selecionados. Exclusões e cancelamentos são catalogados automaticamente.
            </p>
          </div>
        )}

        {!loading && filteredLogs.length > 0 && (
          <>
            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <article key={log.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {getEntityIcon(log.entity_type)}
                      <span className="font-bold text-xs text-slate-900 capitalize">
                        {log.entity_type === "appointment"
                          ? "Atendimento"
                          : log.entity_type === "product"
                          ? "Produto"
                          : log.entity_type === "professional"
                          ? "Profissional"
                          : log.entity_type === "service"
                          ? "Serviço"
                          : log.entity_type}
                      </span>
                    </div>
                    {getActionBadge(log.action)}
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="text-[11px] text-slate-400 uppercase font-semibold mb-0.5">Snapshot dos Dados</div>
                    {renderSnapshotSummary(log)}
                  </div>

                  {log.deletion_reason && (
                    <div className="text-xs text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      <span className="font-bold">Motivo: </span> {log.deletion_reason}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-50">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="font-medium text-slate-700 truncate max-w-[150px]">{log.actor_email}</span>
                    </div>
                    <span>{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                  </div>

                  <button
                    onClick={() => setSelectedLog(log)}
                    className="w-full mt-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Snapshot Completo</span>
                  </button>
                </article>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Data / Hora</th>
                    <th className="py-3.5 px-4">Funcionário (Ator)</th>
                    <th className="py-3.5 px-4">Ação</th>
                    <th className="py-3.5 px-4">Tipo</th>
                    <th className="py-3.5 px-4">Dados Removidos (Snapshot)</th>
                    <th className="py-3.5 px-4">Motivo Informado</th>
                    <th className="py-3.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{log.actor_email || "Sistema"}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          {getEntityIcon(log.entity_type)}
                          <span className="capitalize">
                            {log.entity_type === "appointment"
                              ? "Atendimento"
                              : log.entity_type === "product"
                              ? "Produto"
                              : log.entity_type === "professional"
                              ? "Profissional"
                              : log.entity_type === "service"
                              ? "Serviço"
                              : log.entity_type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-sm">
                        {renderSnapshotSummary(log)}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        {log.deletion_reason ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200 block truncate">
                            {log.deletion_reason}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Não informado</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs inline-flex items-center gap-1.5 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Snapshot Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-tight">
                    Auditoria de Evento #{selectedLog.id.slice(0, 8)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Registrado em {new Date(selectedLog.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 overflow-y-auto space-y-4 text-xs pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-medium block">Autor da Ação</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedLog.actor_email || "Sistema"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Ação & Entidade</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getActionBadge(selectedLog.action)}
                    <span className="font-bold text-slate-800 capitalize">
                      {selectedLog.entity_type} #{selectedLog.entity_id.slice(0, 8)}
                    </span>
                  </div>
                </div>
                {selectedLog.deletion_reason && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                    <span className="text-amber-800 font-bold block mb-0.5">Motivo Informado para Exclusão:</span>
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                      "{selectedLog.deletion_reason}"
                    </div>
                  </div>
                )}
              </div>

              {/* Se for Atendimento com dados extras */}
              {selectedLog.entity_type === "appointment" && (selectedLog.previous_data || selectedLog.previous_state) && (
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                  <h4 className="font-bold text-emerald-950 text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Impacto Financeiro Registrado
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-slate-700">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Valor Total</span>
                      <span className="text-base font-black text-emerald-800">
                        {formatCurrency(
                          selectedLog.previous_data?.price_cents ?? selectedLog.previous_data?.priceCents ?? 0
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Cliente</span>
                      <span className="font-bold text-slate-900">
                        {selectedLog.previous_data?.customer_name || selectedLog.previous_data?.customerName || "Não identificado"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Serviço</span>
                      <span className="font-bold text-slate-900">
                        {selectedLog.previous_data?.service_name || selectedLog.previous_data?.serviceName || "Serviço"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* JSON Snapshot Raw */}
              <div>
                <span className="font-bold text-slate-700 block mb-1.5">
                  Snapshot Integral dos Dados Anteriores:
                </span>
                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed">
                  {JSON.stringify(selectedLog.previous_data || selectedLog.previous_state || selectedLog.new_state, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
