import { supabase } from "./supabase";

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  actor_id?: string | null;
  user_id?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type: "appointment" | "product" | "professional" | "service" | "settings" | "subscription" | string;
  entity_id: string;
  previous_state?: any;
  previous_data?: any;
  new_state?: any;
  deletion_reason?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

/**
 * Registra uma entrada na trilha de auditoria (audit_logs).
 * Salva no Supabase e mantém cópia sincronizada no cache local para resiliência instantânea.
 */
export async function recordAuditLog(params: {
  tenantId: string;
  userId?: string | null;
  userEmail?: string | null;
  action: "delete" | "soft_delete" | "update" | "create" | string;
  entityType: "appointment" | "product" | "professional" | "service" | string;
  entityId: string;
  previousData?: any;
  newData?: any;
  reason?: string | null;
}): Promise<AuditLogEntry> {
  const {
    tenantId,
    userId,
    userEmail,
    action,
    entityType,
    entityId,
    previousData,
    newData,
    reason,
  } = params;

  const entryId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}`;
  const now = new Date().toISOString();

  const logPayload: any = {
    id: entryId,
    tenant_id: tenantId,
    actor_id: userId || null,
    user_id: userId || null,
    actor_email: userEmail || "usuario@barbearia.com",
    action,
    entity_type: entityType,
    entity_id: entityId,
    previous_state: previousData || null,
    previous_data: previousData || null,
    new_state: newData || null,
    deletion_reason: reason || null,
    created_at: now,
  };

  // 1. Tenta salvar via RPC específica se disponível, ou INSERT direto na tabela audit_logs
  try {
    const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("log_audit_event", {
      p_tenant_id: tenantId,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_previous_data: previousData ? JSON.parse(JSON.stringify(previousData)) : null,
      p_new_data: newData ? JSON.parse(JSON.stringify(newData)) : null,
      p_reason: reason || null,
    });

    if (rpcErr) {
      // Fallback para INSERT direto
      const { error: insertErr } = await (supabase.from("audit_logs") as any).insert({
        tenant_id: tenantId,
        actor_id: userId || null,
        actor_email: userEmail || null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        previous_state: previousData || null,
        previous_data: previousData || null,
        new_state: newData || null,
        deletion_reason: reason || null,
      });

      if (insertErr) {
        console.warn("Aviso ao persistir log de auditoria no Supabase:", insertErr.message);
      }
    }
  } catch (err) {
    console.warn("Exceção na rede ao salvar audit_log:", err);
  }

  // 2. Persiste no cache local do tenant para visualização imediata pelo proprietário
  try {
    const cacheKey = `mb_audit_logs_${tenantId}`;
    const cachedRaw = localStorage.getItem(cacheKey);
    let logs: AuditLogEntry[] = cachedRaw ? JSON.parse(cachedRaw) : [];
    if (!Array.isArray(logs)) logs = [];
    logs.unshift(logPayload);
    // Limita o cache local a 500 itens mais recentes
    if (logs.length > 500) logs = logs.slice(0, 500);
    localStorage.setItem(cacheKey, JSON.stringify(logs));
  } catch (e) {
    console.warn("Falha ao salvar log de auditoria no localStorage:", e);
  }

  return logPayload;
}
