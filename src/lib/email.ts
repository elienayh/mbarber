import { supabase } from './supabase';
import type { NotificationEvent } from '@/types/database';

export interface EmailTemplateData {
  tenantName?: string;
  clientName?: string;
  serviceName?: string;
  barberName?: string;
  date?: string;
  time?: string;
  bookingCode?: string;
  address?: string;
  phone?: string;
  actionUrl?: string;
  cancellationReason?: string;
}

export interface SendEmailPayload {
  /** Destinatário único ou lista de destinatários */
  to: string | string[];
  /** Assunto do e-mail (opcional se event e templateData forem passados) */
  subject?: string;
  /** Corpo em HTML (opcional se event e templateData forem passados) */
  html?: string;
  /** Corpo em texto puro alternativo (opcional) */
  text?: string;
  /** Remetente customizado (padrão: MBarber <no-reply@mbarber.com.br>) */
  from?: string;
  /** E-mail para resposta (ex: e-mail da própria barbearia) */
  reply_to?: string;
  /** Tipo de evento para aplicar template de agendamento automático */
  event?: NotificationEvent;
  /** Dados estruturados do agendamento para preenchimento do template */
  templateData?: EmailTemplateData;
}

export interface SendEmailResponse {
  success: boolean;
  message: string;
  id?: string;
  to?: string[];
  from?: string;
  subject?: string;
}

/**
 * Envia um e-mail através da Edge Function 'send-email' do Supabase utilizando o Resend.
 * Não expõe chaves no frontend nem executa chamadas diretas ao Resend.
 */
export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResponse> {
  const { data, error } = await supabase.functions.invoke<SendEmailResponse>('send-email', {
    body: payload,
  });

  if (error) {
    console.error('[sendEmail] Erro ao invocar Edge Function send-email:', error);
    throw error;
  }

  if (!data) {
    throw new Error('Nenhuma resposta retornada pela Edge Function.');
  }

  return data;
}
