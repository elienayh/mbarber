export type NotificationEvent =
  | 'created'
  | 'confirmed'
  | 'reminder'
  | 'canceled'
  | 'rescheduled';

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

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] || character));

export function renderAppointmentEmail(
  event: NotificationEvent,
  data: EmailTemplateData
): { subject: string; html: string; text: string } {
  const tenant = escapeHtml(data.tenantName || 'MBarber');
  const client = escapeHtml(data.clientName || 'Cliente');
  const service = escapeHtml(data.serviceName || 'Serviço');
  const barber = escapeHtml(data.barberName || 'Barbeiro');
  const date = escapeHtml(data.date || 'Data a confirmar');
  const time = escapeHtml(data.time || 'Horário a confirmar');
  const code = escapeHtml(data.bookingCode || 'N/A');
  const address = escapeHtml(data.address || '');
  const reason = escapeHtml(data.cancellationReason || '');

  let eventTitle = 'Atualização do Agendamento';
  let badgeColor = '#d97706'; // Amber
  let badgeText = 'Agendamento';
  let subject = `[${tenant}] Atualização do seu agendamento`;
  let leadMessage = `Olá, <strong>${client}</strong>! Seguem os detalhes do seu atendimento na <strong>${tenant}</strong>:`;

  switch (event) {
    case 'created':
    case 'confirmed':
      eventTitle = 'Agendamento Confirmado!';
      badgeColor = '#10b981'; // Emerald
      badgeText = 'Confirmado';
      subject = `[${tenant}] Agendamento Confirmado — ${date} às ${time}`;
      leadMessage = `Olá, <strong>${client}</strong>! Seu horário na <strong>${tenant}</strong> está confirmado com sucesso.`;
      break;

    case 'reminder':
      eventTitle = 'Lembrete do seu Atendimento';
      badgeColor = '#f59e0b'; // Amber
      badgeText = 'Lembrete';
      subject = `[${tenant}] Lembrete: Seu horário é hoje às ${time}`;
      leadMessage = `Olá, <strong>${client}</strong>! Passando para lembrar do seu horário hoje na <strong>${tenant}</strong>.`;
      break;

    case 'rescheduled':
      eventTitle = 'Agendamento Reagendado';
      badgeColor = '#3b82f6'; // Blue
      badgeText = 'Reagendado';
      subject = `[${tenant}] Seu agendamento foi reagendado para ${date} às ${time}`;
      leadMessage = `Olá, <strong>${client}</strong>! Seu atendimento na <strong>${tenant}</strong> foi atualizado para uma nova data/horário.`;
      break;

    case 'canceled':
      eventTitle = 'Agendamento Cancelado';
      badgeColor = '#ef4444'; // Red
      badgeText = 'Cancelado';
      subject = `[${tenant}] Agendamento Cancelado (${date} às ${time})`;
      leadMessage = `Olá, <strong>${client}</strong>! Informamos que o seu agendamento na <strong>${tenant}</strong> foi cancelado.`;
      break;
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0c0a09;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e7e5e4;
    }
    .container {
      max-width: 560px;
      margin: 30px auto;
      background-color: #1c1917;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #292524;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .header {
      background-color: #141210;
      padding: 24px 32px;
      border-bottom: 1px solid #292524;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .brand-accent {
      color: #f59e0b;
    }
    .content {
      padding: 32px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #ffffff;
      background-color: ${badgeColor};
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 12px 0;
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.3;
    }
    p.lead {
      margin: 0 0 24px 0;
      font-size: 14px;
      color: #a8a29e;
      line-height: 1.6;
    }
    .details-card {
      background-color: #292524;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      border: 1px solid #44403c;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 13px;
      border-bottom: 1px solid #3c3836;
    }
    .detail-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .detail-label {
      color: #a8a29e;
    }
    .detail-value {
      font-weight: 600;
      color: #ffffff;
      text-align: right;
    }
    .code-box {
      background-color: #0c0a09;
      border: 1px dashed #f59e0b;
      border-radius: 10px;
      padding: 14px;
      text-align: center;
      margin-bottom: 24px;
    }
    .code-label {
      font-size: 11px;
      color: #a8a29e;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .code-value {
      font-family: 'Courier New', monospace;
      font-size: 22px;
      font-weight: 800;
      color: #f59e0b;
      letter-spacing: 2px;
    }
    .footer {
      background-color: #141210;
      padding: 20px 32px;
      text-align: center;
      border-top: 1px solid #292524;
      font-size: 11px;
      color: #78716c;
    }
    .footer a {
      color: #f59e0b;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 8px auto;">
        <tr>
          <td style="vertical-align: middle; padding-right: 10px;">
            <!-- Logo Oficial MBarber -->
            <svg width="36" height="36" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; border-radius: 8px;">
              <rect width="512" height="512" rx="110" ry="110" fill="#F86D00" />
              <polygon points="446,152 446,386 382,386 382,204 320,292 175,152" fill="#FAB487" />
              <polygon points="175,152 320,292 320,366 175,236" fill="#FAB487" />
              <path d="M 175,236 L 319,366 C 321,373 315,385 304,385 L 295,385 C 280,385 175,282 175,236 Z" fill="#FFFFFF" />
              <path d="M 132,126 C 154,126 168,142 163,164 L 123,354 C 119,374 100,386 82,382 C 66,378 57,361 61,343 L 103,148 C 107,134 118,126 132,126 Z" fill="#FAB487" />
              <path d="M 152,170 L 118,345 C 115,358 106,366 94,367 C 106,370 119,363 123,348 L 157,178 C 158,172 156,168 152,170 Z" fill="#E68243" />
              <circle cx="132" cy="154" r="14.5" fill="#F86D00" />
              <circle cx="92" cy="354" r="11.5" fill="#F86D00" />
            </svg>
          </td>
          <td style="vertical-align: middle;">
            <div class="brand" style="margin: 0; line-height: 1;">M<span class="brand-accent">Barber</span></div>
          </td>
        </tr>
      </table>
      <div style="font-size: 12px; color: #a8a29e; font-weight: 600;">${tenant}</div>
    </div>
    <div class="content">
      <span class="badge">${badgeText}</span>
      <h1>${eventTitle}</h1>
      <p class="lead">${leadMessage}</p>

      <div class="details-card">
        <div class="detail-row">
          <span class="detail-label">Serviço:</span>
          <span class="detail-value">${service}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Profissional:</span>
          <span class="detail-value">${barber}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Data:</span>
          <span class="detail-value">${date}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Horário:</span>
          <span class="detail-value">${time}</span>
        </div>
        ${address ? `
        <div class="detail-row">
          <span class="detail-label">Local:</span>
          <span class="detail-value">${address}</span>
        </div>
        ` : ''}
        ${reason ? `
        <div class="detail-row">
          <span class="detail-label">Motivo:</span>
          <span class="detail-value" style="color: #f87171;">${reason}</span>
        </div>
        ` : ''}
      </div>

      ${code && code !== 'N/A' ? `
      <div class="code-box">
        <div class="code-label">Código da Reserva</div>
        <div class="code-value">${code}</div>
      </div>
      ` : ''}

      <p style="font-size: 12px; color: #78716c; margin: 0; text-align: center;">
        Em caso de dúvidas ou necessidade de reagendamento, entre em contato diretamente com a barbearia.
      </p>
    </div>
    <div class="footer">
      Mensagem enviada automaticamente por <strong>MBarber</strong> para ${tenant}.<br>
      © ${new Date().getFullYear()} MBarber — Gestão e Agendamento para Barbearias.
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
[${tenant}] ${eventTitle}
---------------------------------------------
${leadMessage.replace(/<[^>]*>?/gm, '')}

Detalhes do Agendamento:
- Serviço: ${service}
- Profissional: ${barber}
- Data: ${date}
- Horário: ${time}
${address ? `- Local: ${address}\n` : ''}${code !== 'N/A' ? `- Código da Reserva: ${code}\n` : ''}${reason ? `- Motivo do Cancelamento: ${reason}\n` : ''}
MBarber — Gestão e Agendamento para Barbearias
  `.trim();

  return { subject, html, text };
}
