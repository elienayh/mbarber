const fs = require('fs');
const path = require('path');

const audit = {
  tenants: ['address_city', 'address_neighborhood', 'address_number', 'address_state', 'address_street', 'address_zip_code', 'created_at', 'document_number', 'email', 'id', 'logo_url', 'name', 'phone', 'primary_color', 'secondary_color', 'settings', 'slug', 'status', 'trade_name', 'trial_ends_at', 'updated_at'],
  tenant_users: ['created_at', 'id', 'is_active', 'role', 'tenant_id', 'user_id'],
  profiles: ['avatar_url', 'created_at', 'email', 'full_name', 'id', 'is_platform_admin', 'phone', 'platform_role', 'updated_at'],
  professionals: ['avatar_url', 'bio', 'color_hex', 'commission_rate', 'created_at', 'display_order', 'email', 'id', 'is_active', 'name', 'nickname', 'phone', 'tenant_id', 'updated_at', 'user_id'],
  services: ['buffer_minutes', 'category', 'created_at', 'description', 'duration_minutes', 'id', 'image_url', 'is_active', 'name', 'price_cents', 'tenant_id', 'updated_at'],
  business_hours: ['break_end', 'break_start', 'close_time', 'created_at', 'day_of_week', 'id', 'is_closed', 'open_time', 'tenant_id'],
  customers: ['created_at', 'email', 'id', 'last_appointment_at', 'name', 'notes', 'phone', 'tenant_id', 'total_appointments', 'updated_at'],
  appointments: ['created_at', 'customer_id', 'end_time', 'id', 'notes', 'price_cents', 'professional_id', 'series_id', 'service_id', 'start_time', 'status', 'tenant_id', 'updated_at'],
  financial_transactions: ['amount_cents', 'appointment_id', 'category', 'created_at', 'description', 'due_date', 'id', 'paid_at', 'payment_method', 'status', 'tenant_id', 'type'],
  products: ['barcode', 'cost_price_cents', 'created_at', 'id', 'is_active', 'min_stock_alert', 'name', 'sale_price_cents', 'sku', 'tenant_id', 'updated_at'],
  stock_movements: ['created_at', 'id', 'product_id', 'quantity', 'tenant_id', 'type', 'unit_cost_cents']
};

const migrationsDir = path.join('supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

console.log('=== AUDIT OF MIGRATIONS / FUNCTIONS ===');

for (const f of files) {
  const content = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
  
  // Check for common known bad references
  if (content.includes('tenant_users') && content.includes('updated_at')) {
    console.log(`[DISCREPANCY] ${f}: references 'updated_at' on 'tenant_users'`);
  }
  if (content.includes('professionals') && content.includes('color_tag')) {
    console.log(`[DISCREPANCY] ${f}: references 'color_tag' on 'professionals' (should be 'color_hex')`);
  }
  if (content.includes('p_address') && content.includes('create_tenant_for_current_user')) {
    console.log(`[NOTE] ${f}: references 'p_address' on 'create_tenant_for_current_user'`);
  }
  if (content.includes('stock_movements') && content.includes('reason')) {
    console.log(`[DISCREPANCY] ${f}: references 'reason' on 'stock_movements' (reason column does not exist)`);
  }
  if (content.includes('products') && content.includes('stock_quantity')) {
    console.log(`[DISCREPANCY] ${f}: references 'stock_quantity' on 'products' (stock_quantity column does not exist)`);
  }
}
