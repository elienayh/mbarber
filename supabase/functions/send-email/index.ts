import { corsHeaders } from '../_shared/cors.ts';
import {
  renderAppointmentEmail,
  NotificationEvent,
  EmailTemplateData,
} from './templates.ts';

interface SendEmailRequest {
  to: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  from?: string;
  reply_to?: string;
  event?: NotificationEvent;
  templateData?: EmailTemplateData;
}

const DEFAULT_FROM = 'MBarber <no-reply@mbarber.com.br>';
const RESEND_API_URL = 'https://api.resend.com/emails';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: 'Method not allowed. Use POST to send emails.',
      }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // 1. Validate Resend API Key from Supabase Secret
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('[send-email] Secret RESEND_API_KEY not configured.');
      return new Response(
        JSON.stringify({
          error: 'Configuração ausente: RESEND_API_KEY não foi encontrada nas secrets do Supabase.',
          hint: 'Configure com: supabase secrets set RESEND_API_KEY=re_sua_chave',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Parse and validate JSON request body
    let body: SendEmailRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Payload inválido: corpo da requisição deve ser um JSON válido.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { to, from: customFrom, reply_to, event, templateData } = body;
    let { subject, html, text } = body;

    // Validate recipient
    if (!to || (Array.isArray(to) && to.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'Campo obrigatório ausente: "to" (destinatário do e-mail).' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If a notification event and template data were supplied, generate template
    if (event && templateData) {
      const rendered = renderAppointmentEmail(event, templateData);
      subject = subject || rendered.subject;
      html = html || rendered.html;
      text = text || rendered.text;
    }

    // Validate subject and content
    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Campo obrigatório ausente: "subject" (assunto do e-mail).' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!html || typeof html !== 'string' || html.trim() === '') {
      return new Response(
        JSON.stringify({
          error:
            'Conteúdo ausente: informe "html" com o corpo do e-mail ou utilize os campos "event" e "templateData".',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const recipients = Array.isArray(to) ? to : [to];
    const fromAddress = customFrom || DEFAULT_FROM;

    // 3. Dispatch to Resend API
    const resendPayload: Record<string, unknown> = {
      from: fromAddress,
      to: recipients,
      subject: subject.trim(),
      html,
    };

    if (text) {
      resendPayload.text = text;
    }

    if (reply_to) {
      resendPayload.reply_to = reply_to;
    }

    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      console.error('[send-email] Resend API error:', resendResponse.status, resendData);
      return new Response(
        JSON.stringify({
          error: 'Falha no envio de e-mail através do Resend.',
          statusCode: resendResponse.status,
          details: resendData,
        }),
        {
          status: resendResponse.status >= 400 && resendResponse.status < 600 ? resendResponse.status : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'E-mail enviado com sucesso.',
        id: resendData.id,
        to: recipients,
        from: fromAddress,
        subject,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[send-email] Unexpected error:', message);

    return new Response(
      JSON.stringify({
        error: 'Erro interno ao processar envio de e-mail.',
        message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
