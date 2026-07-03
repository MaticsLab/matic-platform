import { sendEmail } from "./send-email"

export function sendChangeEmailConfirmation({
  user,
  newEmail,
  url,
}: {
  user: { email: string; name: string }
  newEmail: string
  url: string
}) {
  return sendEmail({
    to: user.email, // confirmation goes to the current (already verified) email
    subject: "Confirm your email change",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Confirm Email Change</h2>
        <p>Hello ${user.name},</p>
        <p>You requested to change your account email to <strong>${newEmail}</strong>. Click the button below to confirm this change:</p>
        <a href="${url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">Confirm Email Change</a>
        <p>If you didn't request this, please ignore this email and your email will remain unchanged.</p>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">This link will expire in 24 hours.</p>
        <p>Best regards,<br>Matic Platform Team</p>
      </div>
    `,
    text: `Hello ${user.name},\n\nYou requested to change your account email to ${newEmail}. Click this link to confirm: ${url}\n\nIf you didn't request this, please ignore this email.\n\nThis link will expire in 24 hours.\n\nBest regards,\nMatic Platform Team`,
  })
}
