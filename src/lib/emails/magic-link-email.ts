import { sendEmail } from "./send-email"

interface MagicLinkData {
  user: {
    name: string
    email: string
  }
  url: string
  portalSettings?: {
    emailSenderName?: string | null
    name?: string
  }
}

export async function sendMagicLink({
  user,
  url,
  portalSettings,
}: MagicLinkData) {
  const senderName = portalSettings?.emailSenderName || portalSettings?.name || "Matic Platform"
  const fromEmail = `${senderName} <${process.env.RESEND_FROM_EMAIL?.split('<')[1]?.replace('>', '') || 'noreply@notifications.maticsapp.com'}>`
  
  await sendEmail({
    to: user.email,
    from: fromEmail,
    subject: `Sign In to ${senderName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Sign In to ${senderName}</h2>
        <p>Hello ${user.name},</p>
        <p>Click the button below to securely log in! This link will expire in 20 minutes.</p>
        <a href="${url}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">Log in</a>
        <p>If you didn't request to sign in, please ignore this email.</p>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">This link will expire in 20 minutes.</p>
      </div>
    `,
    text: `Hello ${user.name},\n\nSecurely sign in by clicking this link: ${url}\n\nIf you didn't request to sign in, please ignore this email.\n\nThis link will expire in 20 minutes.`,
  });
}
