export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TenantStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'canceled';
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
export type TenantRole = 'owner' | 'admin' | 'professional' | 'receptionist';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'canceled' | 'no_show' | 'rescheduled';
export type AppointmentOrigin = 'public_chat' | 'backoffice' | 'recurrent';
export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly';
export type SeriesStatus = 'active' | 'completed' | 'canceled';
export type TransactionType = 'income' | 'expense';
export type FinancialCategory =
  | 'service_revenue'
  | 'product_sale'
  | 'commission_payout'
  | 'rent'
  | 'utilities'
  | 'supplies'
  | 'software'
  | 'marketing'
  | 'other';
export type PaymentMethod = 'money' | 'pix' | 'credit_card' | 'debit_card' | 'transfer' | 'voucher';
export type TransactionStatus = 'pending' | 'paid' | 'canceled';
export type StockMovementType = 'in_purchase' | 'out_sale' | 'out_internal_use' | 'out_loss_expired' | 'adjustment';
export type NotificationChannel = 'whatsapp' | 'email' | 'sms' | 'push';
export type NotificationEvent = 'created' | 'confirmed' | 'reminder' | 'canceled' | 'rescheduled';
export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'failed';
export type WebhookStatus = 'pending' | 'processed' | 'ignored' | 'failed';

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          slug: string;
          name: string;
          trade_name: string;
          document_number: string | null;
          phone: string;
          email: string;
          address_street: string | null;
          address_number: string | null;
          address_neighborhood: string | null;
          address_city: string | null;
          address_state: string | null;
          address_zip_code: string | null;
          logo_url: string | null;
          primary_color: string;
          secondary_color: string;
          status: TenantStatus;
          trial_ends_at: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tenants']['Row']>;
      };
      plans: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          stripe_product_id: string;
          stripe_price_id: string;
          price_cents: number;
          billing_cycle: BillingCycle;
          max_professionals: number;
          features: Json;
          is_active: boolean;
          created_at: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          tenant_id: string;
          plan_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          status: SubscriptionStatus;
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          is_platform_admin: boolean;
          platform_role: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      tenant_users: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: TenantRole;
          is_active: boolean;
          created_at: string;
        };
      };
      professionals: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          name: string;
          nickname: string | null;
          phone: string | null;
          email: string | null;
          avatar_url: string | null;
          bio: string | null;
          commission_rate: number;
          color_hex: string;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
      };
      services: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          category: string;
          price_cents: number;
          duration_minutes: number;
          buffer_minutes: number;
          is_active: boolean;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      professional_services: {
        Row: {
          id: string;
          tenant_id: string;
          professional_id: string;
          service_id: string;
          custom_price_cents: number | null;
          custom_duration_minutes: number | null;
          custom_commission_rate: number | null;
          created_at: string;
        };
      };
      business_hours: {
        Row: {
          id: string;
          tenant_id: string;
          day_of_week: number;
          open_time: string;
          close_time: string;
          break_start: string | null;
          break_end: string | null;
          is_closed: boolean;
          created_at: string;
        };
      };
      professional_schedules: {
        Row: {
          id: string;
          tenant_id: string;
          professional_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          break_start: string | null;
          break_end: string | null;
          is_day_off: boolean;
          created_at: string;
        };
      };
      schedule_blocks: {
        Row: {
          id: string;
          tenant_id: string;
          professional_id: string | null;
          title: string;
          start_time: string;
          end_time: string;
          is_all_day: boolean;
          created_at: string;
        };
      };
      customers: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          phone: string;
          email: string | null;
          notes: string | null;
          total_appointments: number;
          total_spent_cents: number;
          last_appointment_at: string | null;
          is_blocked: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      appointment_series: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          professional_id: string;
          service_id: string;
          frequency: RecurrenceFrequency;
          day_of_week: number | null;
          preferred_time: string;
          start_date: string;
          end_date: string | null;
          total_occurrences: number;
          status: SeriesStatus;
          created_at: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          tenant_id: string;
          series_id: string | null;
          series_index: number | null;
          customer_id: string;
          professional_id: string;
          service_id: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          price_cents: number;
          commission_rate: number;
          commission_cents: number;
          status: AppointmentStatus;
          origin: AppointmentOrigin;
          cancellation_reason: string | null;
          canceled_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      financial_transactions: {
        Row: {
          id: string;
          tenant_id: string;
          appointment_id: string | null;
          type: TransactionType;
          category: FinancialCategory;
          amount_cents: number;
          payment_method: PaymentMethod;
          status: TransactionStatus;
          description: string;
          professional_id: string | null;
          paid_at: string | null;
          due_date: string | null;
          created_at: string;
        };
      };
      products: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          sku: string | null;
          barcode: string | null;
          category: string;
          cost_price_cents: number;
          sale_price_cents: number;
          current_stock: number;
          min_stock_alert: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      stock_movements: {
        Row: {
          id: string;
          tenant_id: string;
          product_id: string;
          type: StockMovementType;
          quantity: number;
          unit_cost_cents: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
      };
      notification_logs: {
        Row: {
          id: string;
          tenant_id: string;
          appointment_id: string | null;
          channel: NotificationChannel;
          event: NotificationEvent;
          recipient_phone: string | null;
          recipient_name: string | null;
          message_body: string;
          status: NotificationStatus;
          scheduled_for: string;
          sent_at: string | null;
          error_log: string | null;
          created_at: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string | null;
          actor_id: string | null;
          actor_email: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          previous_state: Json | null;
          new_state: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
      };
      webhook_events: {
        Row: {
          id: string;
          provider: string;
          event_id: string;
          event_type: string;
          payload: Json;
          status: WebhookStatus;
          error_message: string | null;
          processed_at: string | null;
          created_at: string;
        };
      };
    };
  };
}
