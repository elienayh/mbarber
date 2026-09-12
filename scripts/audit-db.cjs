const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const allTables = [
  'tenants', 'plans', 'subscriptions', 'profiles', 'tenant_users',
  'professionals', 'services', 'professional_services', 'business_hours',
  'professional_schedules', 'schedule_blocks', 'customers', 'appointment_series',
  'appointments', 'financial_transactions', 'products', 'stock_movements',
  'notification_logs', 'audit_logs', 'webhook_events'
];

// Candidates for remaining tables
const tableCandidates = {
  services: ['id', 'tenant_id', 'name', 'description', 'category', 'price_cents', 'duration_minutes', 'buffer_minutes', 'is_active', 'image_url', 'created_at', 'updated_at', 'deleted_at'],
  professional_services: ['id', 'professional_id', 'service_id', 'custom_price_cents', 'custom_duration_minutes', 'commission_rate', 'created_at', 'updated_at'],
  business_hours: ['id', 'tenant_id', 'day_of_week', 'open_time', 'close_time', 'break_start', 'break_end', 'is_closed', 'created_at', 'updated_at'],
  professional_schedules: ['id', 'tenant_id', 'professional_id', 'day_of_week', 'open_time', 'close_time', 'break_start', 'break_end', 'is_working', 'created_at', 'updated_at'],
  schedule_blocks: ['id', 'tenant_id', 'professional_id', 'start_datetime', 'end_datetime', 'reason', 'created_at', 'updated_at'],
  customers: ['id', 'tenant_id', 'name', 'phone', 'email', 'notes', 'birth_date', 'total_appointments', 'last_appointment_at', 'created_at', 'updated_at', 'deleted_at'],
  appointment_series: ['id', 'tenant_id', 'customer_id', 'frequency', 'interval_weeks', 'total_occurrences', 'created_at', 'updated_at'],
  appointments: ['id', 'tenant_id', 'customer_id', 'professional_id', 'service_id', 'date', 'start_time', 'end_time', 'status', 'notes', 'price_cents', 'final_price_cents', 'payment_status', 'payment_method', 'series_id', 'created_at', 'updated_at', 'canceled_at', 'cancel_reason'],
  financial_transactions: ['id', 'tenant_id', 'appointment_id', 'type', 'category', 'description', 'amount_cents', 'payment_method', 'status', 'due_date', 'paid_at', 'created_at', 'updated_at'],
  products: ['id', 'tenant_id', 'name', 'description', 'sku', 'barcode', 'cost_price_cents', 'sale_price_cents', 'stock_quantity', 'min_stock_alert', 'is_active', 'created_at', 'updated_at'],
  stock_movements: ['id', 'tenant_id', 'product_id', 'type', 'quantity', 'unit_cost_cents', 'reason', 'created_at', 'updated_at'],
  notification_logs: ['id', 'tenant_id', 'type', 'channel', 'recipient', 'status', 'payload', 'error_message', 'sent_at', 'created_at'],
  audit_logs: ['id', 'tenant_id', 'user_id', 'action', 'entity_type', 'entity_id', 'old_data', 'new_data', 'ip_address', 'created_at'],
  webhook_events: ['id', 'source', 'event_type', 'payload', 'processed', 'error_message', 'created_at']
};

async function testTable(table, candidates) {
  const cols = Array.from(new Set(['id', 'tenant_id', 'created_at', 'updated_at', ...(candidates || [])]));
  const results = await Promise.all(
    cols.map(async col => {
      const res = await supabase.from(table).select(col).limit(0);
      if (!res.error) return { col, exists: true };
      if (res.error.code === '42703' || res.error.message?.includes('does not exist')) return { col, exists: false };
      return { col, exists: false, err: res.error.message };
    })
  );

  const present = results.filter(r => r.exists).map(r => r.col);
  const absent = results.filter(r => !r.exists).map(r => r.err ? `${r.col} (${r.err})` : r.col);
  return { table, present, absent };
}

async function run() {
  const allResults = {};
  for (const [t, cols] of Object.entries(tableCandidates)) {
    const r = await testTable(t, cols);
    allResults[t] = r;
    console.log(`\nTABLE: ${t}`);
    console.log(`  EXISTS: [ ${r.present.sort().join(', ')} ]`);
    if (r.absent.length > 0) console.log(`  DOES NOT EXIST: [ ${r.absent.sort().join(', ')} ]`);
  }
}

run();
