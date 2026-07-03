import { sendEmail } from "./send-email"

export function sendDeleteAccountEmail({
  user,
  url,
}: {
  user: { email: string; name: string }
  url: string
}) {
  return sendEmail({
    to: user.email,
    subject: "Confirm account deletion",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #c0392b;">Confirm Account Deletion</h2>
        <p>Hello ${user.name},</p>
        <p>You requested to permanently delete your Matic Platform account. Click the button below to confirm:</p>
        <a href="${url}" style="background-color: #c0392b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">Confirm Deletion</a>
        <p>This action is irreversible. If you didn't request this, please ignore this email and your account will remain active.</p>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">This link will expire in 24 hours.</p>
        <p>Best regards,<br>Matic Platform Team</p>
      </div>
    `,
    text: `Hello ${user.name},\n\nYou requested to permanently delete your account. Click this link to confirm: ${url}\n\nThis action is irreversible. If you didn't request this, please ignore this email.\n\nThis link will expire in 24 hours.\n\nBest regards,\nMatic Platform Team`,
  })
}
