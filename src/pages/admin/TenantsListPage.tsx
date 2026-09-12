import React, { useEffect, useState } from "react";
import {
  Building2,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Edit,
  Copy,
  Check,
  X,
  MapPin,
  Phone,
  Mail,
  User,
  Calendar,
  Save,
  Loader2,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { sanitizeSlug, validateSlugSyntax } from "@/lib/authRedirect";

interface TenantDetail {
  id: string;
  name: string;
  trade_name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  status: string;
  trial_ends_at: string | null;
  primary_color: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
  settings: any;
  created_at: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  plan: string;
  barbers_count: number;
}

export const TenantsListPage: React.FC = () => {
  const [tenants, setTenants] = useState<TenantDetail[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Estado do modal de edição
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<TenantDetail>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Estado de exclusão de barbearia (Super Admin)
  const [tenantToDelete, setTenantToDelete] = useState<TenantDetail | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletingTenant, setDeletingTenant] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: loadError } = await (supabase.from("tenants") as any)
        .select(`
          id, name, trade_name, slug, phone, email, status, trial_ends_at,
          primary_color, secondary_color, logo_url,
          address_street, address_number, address_neighborhood, address_city,
          address_state, address_zip_code, settings, created_at,
          tenant_users (
            role,
            is_active,
            profiles (id, full_name, email)
          ),
          professionals (count),
          subscriptions (
            plans (name)
          )
        `)
        .order("created_at", { ascending: false });

      if (loadError) throw loadError;

      const formatted: TenantDetail[] = (data || []).map((t: any) => {
        const ownerMembership = t.tenant_users?.find((u: any) => u.role === "owner") || t.tenant_users?.[0];
        const rawProfile = ownerMembership?.profiles;
        const ownerProfile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;

        return {
          ...t,
          owner_name: ownerProfile?.full_name || "Não informado",
          owner_email: ownerProfile?.email || "—",
          owner_phone: t.phone || "—",
          plan: t.subscriptions?.[0]?.plans?.name || (t.status === "trial" ? "Trial Grátis" : "Sem Plano"),
          barbers_count: t.professionals?.[0]?.count || 0,
        };
      });

      setTenants(formatted);
    } catch (err: any) {
      console.error("Erro ao carregar tenants:", err);
      setError(err?.message || "Não foi possível carregar as barbearias.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;

    const inputClean = deleteConfirmationText.trim().toLowerCase();
    const slugMatch = inputClean === tenantToDelete.slug.toLowerCase();
    const nameMatch = inputClean === tenantToDelete.name.trim().toLowerCase();

    if (!slugMatch && !nameMatch) {
      setDeleteError(`Digite exatamente "${tenantToDelete.slug}" ou "${tenantToDelete.name}" para confirmar a exclusão.`);
      return;
    }

    setDeletingTenant(true);
    setDeleteError(null);

    const targetId = tenantToDelete.id;

    try {
      // 1. Tentar executar via RPC atômica delete_tenant_by_admin
      let rpcSucceeded = false;
      try {
        const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("delete_tenant_by_admin", {
          p_tenant_id: targetId,
        });
        if (!rpcErr) {
          rpcSucceeded = true;
        } else {
          console.warn("RPC delete_tenant_by_admin retornou erro:", rpcErr);
        }
      } catch (rpcCallErr) {
        console.warn("Chamada RPC falhou, tentando exclusão ordenada direta:", rpcCallErr);
      }

      // 2. Fallback: Deleção ordenada em sequência respeitando restrições de chaves estrangeiras
      if (!rpcSucceeded) {
        await (supabase.from("financial_transactions") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("appointments") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("appointment_series") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("schedule_blocks") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("stock_movements") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("products") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("professional_services") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("services") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("professional_schedules") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("professionals") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("customers") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("business_hours") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("subscriptions") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("notification_logs") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("audit_logs") as any).delete().eq("tenant_id", targetId);
        await (supabase.from("tenant_users") as any).delete().eq("tenant_id", targetId);

        const { data: deletedRows, error: deleteTenantError } = await (supabase.from("tenants") as any)
          .delete()
          .eq("id", targetId)
          .select();

        if (deleteTenantError) throw deleteTenantError;
        if (!deletedRows || deletedRows.length === 0) {
          throw new Error("A exclusão não foi autorizada ou não afetou nenhum registro no banco. Verifique permissões.");
        }
      }

      // Atualizar lista local APENAS após confirmação real da exclusão no banco
      setTenants((prev) => prev.filter((t) => t.id !== targetId));
      if (selectedTenant && selectedTenant.id === targetId) {
        setSelectedTenant(null);
      }
      setDeleteSuccessMessage(`A barbearia "${tenantToDelete.name}" (${tenantToDelete.slug}) foi excluída permanentemente.`);
      setTenantToDelete(null);
      setDeleteConfirmationText("");
      setTimeout(() => setDeleteSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error("Erro ao excluir barbearia:", err);
      setDeleteError(err?.message || "Não foi possível excluir a barbearia. Verifique suas permissões no banco.");
    } finally {
      setDeletingTenant(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    if (updatingId) return;
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    setUpdatingId(id);
    setError(null);

    try {
      const { error: updateError } = await (supabase.from("tenants") as any)
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (updateError) throw updateError;

      setTenants((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
      );
      if (selectedTenant && selectedTenant.id === id) {
        setSelectedTenant((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err: any) {
      setError(err?.message || "Não foi possível alterar o status da barbearia.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenEditModal = (tenant: TenantDetail) => {
    setSelectedTenant(tenant);
    setEditFormData({
      name: tenant.name || "",
      trade_name: tenant.trade_name || "",
      slug: tenant.slug || "",
      phone: tenant.phone || "",
      email: tenant.email || "",
      address_street: tenant.address_street || "",
      address_number: tenant.address_number || "",
      address_neighborhood: tenant.address_neighborhood || "",
      address_city: tenant.address_city || "",
      address_state: tenant.address_state || "",
      address_zip_code: tenant.address_zip_code || "",
      status: tenant.status || "active",
      primary_color: tenant.primary_color || "#F28322",
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    setEditError(null);

    const cleanSlug = sanitizeSlug(editFormData.slug || "");
    const slugCheck = validateSlugSyntax(cleanSlug);
    if (!slugCheck.valid) {
      setEditError(slugCheck.error || "Slug inválido");
      return;
    }

    setSavingEdit(true);

    try {
      // 1. Verificar se o slug já existe em outro tenant
      const { data: duplicate } = await (supabase.from("tenants") as any)
        .select("id")
        .eq("slug", cleanSlug)
        .neq("id", selectedTenant.id)
        .maybeSingle();

      if (duplicate) {
        setEditError("Este slug já está sendo utilizado por outra barbearia.");
        setSavingEdit(false);
        return;
      }

      // 2. Persistir alterações no Supabase
      const payload = {
        name: (editFormData.name || "").trim(),
        trade_name: (editFormData.trade_name || "").trim() || (editFormData.name || "").trim(),
        slug: cleanSlug,
        phone: (editFormData.phone || "").trim() || null,
        email: (editFormData.email || "").trim() || null,
        address_street: (editFormData.address_street || "").trim() || null,
        address_number: (editFormData.address_number || "").trim() || null,
        address_neighborhood: (editFormData.address_neighborhood || "").trim() || null,
        address_city: (editFormData.address_city || "").trim() || null,
        address_state: (editFormData.address_state || "").trim() || null,
        address_zip_code: (editFormData.address_zip_code || "").trim() || null,
        status: editFormData.status || selectedTenant.status,
        primary_color: editFormData.primary_color || "#F28322",
        updated_at: new Date().toISOString(),
      };

      // 2. Persistir alterações no Supabase (tenta RPC de super admin ou update direto verificado)
      let updateSucceeded = false;
      try {
        const { data: rpcUpdate, error: rpcErr } = await (supabase.rpc as any)("update_tenant_by_admin", {
          p_tenant_id: selectedTenant.id,
          p_payload: payload,
        });
        if (!rpcErr && rpcUpdate) {
          updateSucceeded = true;
        } else if (rpcErr) {
          console.warn("RPC update_tenant_by_admin retornou aviso:", rpcErr);
        }
      } catch (rpcErr) {
        console.warn("RPC update_tenant_by_admin não disponível, tentando update direto:", rpcErr);
      }

      if (!updateSucceeded) {
        const { data: updatedRows, error: updateError } = await (supabase.from("tenants") as any)
          .update(payload)
          .eq("id", selectedTenant.id)
          .select();

        if (updateError) throw updateError;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error("As alterações não foram salvas pelo banco de dados. Verifique suas permissões de administrador.");
        }
      }

      // Atualizar lista local apenas após confirmação real
      setTenants((prev) =>
        prev.map((t) =>
          t.id === selectedTenant.id ? { ...t, ...payload, slug: cleanSlug } : t
        )
      );

      setSelectedTenant(null);
    } catch (err: any) {
      console.error("Erro ao atualizar barbearia:", err);
      setEditError(err?.message || "Não foi possível salvar as alterações.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCopyLink = (slug: string) => {
    const url = `https://www.mbarber.com.br/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Ativo
          </span>
        );
      case "trial":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold surface-accent-soft text-primary-on-dark border border-accent">
            Trial
          </span>
        );
      case "past_due":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Inadimplente
          </span>
        );
      case "suspended":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
            Suspenso
          </span>
        );
      case "canceled":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-400">
            Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  const filteredTenants = tenants.filter((t) => {
    const term = searchTerm.toLowerCase();
    return (
      t.name.toLowerCase().includes(term) ||
      t.slug.toLowerCase().includes(term) ||
      t.owner_name.toLowerCase().includes(term) ||
      t.owner_email.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-white">Barbearias Cadastradas</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-xs font-bold text-slate-300">
              {tenants.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gestão de tenants, edição de dados cadastrais, links públicos e controle de status
          </p>
        </div>

        {/* Busca */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nome, slug ou dono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {deleteSuccessMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{deleteSuccessMessage}</span>
        </div>
      )}

      {/* Tabela de Barbearias */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-slate-400 font-semibold text-xs border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Barbearia / Nome Fantasia</th>
                <th className="py-3.5 px-4">Link Público (Slug)</th>
                <th className="py-3.5 px-4">Proprietário</th>
                <th className="py-3.5 px-4">Contato</th>
                <th className="py-3.5 px-4">Plano</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-slate-300">
              {loading && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
                    Carregando barbearias cadastradas...
                  </td>
                </tr>
              )}

              {!loading && filteredTenants.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                    Nenhuma barbearia encontrada para esta busca.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white leading-snug">{t.name}</div>
                      {t.trade_name && t.trade_name !== t.name && (
                        <div className="text-xs text-slate-400">{t.trade_name}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-accent">
                        <Link
                          to={`/${t.slug}`}
                          target="_blank"
                          className="hover:underline flex items-center gap-1"
                        >
                          /{t.slug} <ExternalLink className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={() => handleCopyLink(t.slug)}
                          title="Copiar link"
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                        >
                          {copiedSlug === t.slug ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs">
                      <div className="font-medium text-slate-200">{t.owner_name}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                        {t.owner_email}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      <div>{t.phone || "—"}</div>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-200">
                      {t.plan}
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(t.status)}</td>

                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 transition inline-flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Editar</span>
                      </button>

                      <button
                        disabled={updatingId === t.id}
                        onClick={() => handleToggleStatus(t.id, t.status)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-50 ${
                          t.status === "active"
                            ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                        }`}
                      >
                        {updatingId === t.id
                          ? "..."
                          : t.status === "active"
                          ? "Suspender"
                          : "Reativar"}
                      </button>

                      <button
                        onClick={() => {
                          setTenantToDelete(t);
                          setDeleteConfirmationText("");
                          setDeleteError(null);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition inline-flex items-center gap-1"
                        title="Excluir barbearia permanentemente"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Excluir</span>
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO & EDIÇÃO PELO SUPER ADMIN */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl my-8 relative">
            {/* Fechar */}
            <button
              onClick={() => setSelectedTenant(null)}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabeçalho do Modal */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold">
                  Painel Super Admin
                </span>
                {getStatusBadge(editFormData.status || selectedTenant.status)}
              </div>
              <h3 className="text-xl font-black text-white">
                Editar Cadastro da Barbearia
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ID do Tenant: <code className="text-slate-300 font-mono">{selectedTenant.id}</code>
              </p>
            </div>

            {/* Links Rápidos */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 mb-6">
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs text-slate-400">Link Público:</span>
                <span className="text-xs font-mono text-accent font-bold truncate">
                  https://www.mbarber.com.br/{editFormData.slug || selectedTenant.slug}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyLink(editFormData.slug || selectedTenant.slug)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedSlug ? "Copiado!" : "Copiar"}</span>
                </button>
                <Link
                  to={`/${editFormData.slug || selectedTenant.slug}`}
                  target="_blank"
                  className="px-2.5 py-1 text-xs rounded-lg bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 transition flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Abrir</span>
                </Link>
              </div>
            </div>

            {editError && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Dados Básicos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome da Barbearia *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    value={editFormData.trade_name || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, trade_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Slug Público *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.slug || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, slug: sanitizeSlug(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-accent focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Status da Assinatura
                  </label>
                  <select
                    value={editFormData.status || "active"}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-accent"
                  >
                    <option value="active">Ativo (Regular)</option>
                    <option value="trial">Trial (Período de Testes)</option>
                    <option value="past_due">Inadimplente</option>
                    <option value="suspended">Suspenso</option>
                    <option value="canceled">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Contatos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Telefone Comercial
                  </label>
                  <input
                    type="text"
                    value={editFormData.phone || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    E-mail Comercial
                  </label>
                  <input
                    type="email"
                    value={editFormData.email || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-accent" /> Endereço
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Rua / Logradouro"
                      value={editFormData.address_street || ""}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, address_street: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Número"
                      value={editFormData.address_number || ""}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, address_number: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Bairro"
                    value={editFormData.address_neighborhood || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, address_neighborhood: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-accent"
                  />
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={editFormData.address_city || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, address_city: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-accent"
                  />
                  <input
                    type="text"
                    placeholder="UF (ex: SP)"
                    maxLength={2}
                    value={editFormData.address_state || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, address_state: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Informações do Proprietário (Somente Leitura - Segurança) */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Dados do Proprietário (Somente Leitura)</span>
                </div>
                <p>Nome: <strong className="text-white">{selectedTenant.owner_name}</strong></p>
                <p>E-mail: <strong className="text-white">{selectedTenant.owner_email}</strong></p>
                <p>Telefone: <strong className="text-white">{selectedTenant.owner_phone}</strong></p>
                <p className="text-[11px] text-slate-500 pt-1">
                  * Por segurança, senhas de usuários não são acessíveis nem alteradas pelo Super Admin.
                </p>
              </div>

              {/* Botões do Formulário */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setTenantToDelete(selectedTenant);
                    setDeleteConfirmationText("");
                    setDeleteError(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Barbearia</span>
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedTenant(null)}
                    disabled={savingEdit}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-2.5 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-xs transition shadow-md shadow-accent flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingEdit ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Salvar Alterações</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE BARBEARIA (SUPER ADMIN) */}
      {tenantToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl relative my-8">
            <button
              onClick={() => {
                setTenantToDelete(null);
                setDeleteConfirmationText("");
                setDeleteError(null);
              }}
              disabled={deletingTenant}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Excluir Barbearia</h3>
                <p className="text-xs text-red-400 font-medium">Ação permanente e irreversível</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Você está prestes a excluir definitivamente a barbearia{" "}
              <strong className="text-white">{tenantToDelete.name}</strong>{" "}
              (slug: <span className="font-mono text-accent">{tenantToDelete.slug}</span>).
            </p>

            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 leading-normal mb-4 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Dados que serão removidos permanentemente:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                <li>Todos os agendamentos e históricos</li>
                <li>Clientes e notas cadastradas</li>
                <li>Serviços, profissionais e horários de atendimento</li>
                <li>Produtos e movimentações de estoque</li>
                <li>Vínculos de usuários (owners e colaboradores)</li>
              </ul>
            </div>

            {deleteError && (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="space-y-1.5 mb-5">
              <label className="block text-xs font-semibold text-slate-300">
                Digite <strong className="text-white select-all">{tenantToDelete.slug}</strong> ou o nome da barbearia para confirmar:
              </label>
              <input
                type="text"
                placeholder={tenantToDelete.slug}
                value={deleteConfirmationText}
                onChange={(e) => {
                  setDeleteConfirmationText(e.target.value);
                  setDeleteError(null);
                }}
                disabled={deletingTenant}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-red-500 transition placeholder:text-slate-600 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTenantToDelete(null);
                  setDeleteConfirmationText("");
                  setDeleteError(null);
                }}
                disabled={deletingTenant}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteTenant}
                disabled={
                  deletingTenant ||
                  (deleteConfirmationText.trim().toLowerCase() !== tenantToDelete.slug.toLowerCase() &&
                    deleteConfirmationText.trim().toLowerCase() !== tenantToDelete.name.trim().toLowerCase())
                }
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-900/30"
              >
                {deletingTenant ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo barbearia...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
