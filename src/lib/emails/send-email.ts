import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendEmail({
  to,
  from,
  subject,
  html,
  text,
}: {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text: string;
}) {
  return resend.emails.send({
    from: from || process.env.RESEND_FROM_EMAIL || 'Matic Platform <noreply@notifications.maticsapp.com>',
    to,
    subject,
    html,
    text,
  });
}
