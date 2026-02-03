import { sendEmail } from "./send-email"

export function sendEmailVerificationEmail({
  user,
  url,
}: {
  user: { email: string; name: string }
  url: string
}) {
  return sendEmail({
    to: user.email,
    subject: "Verify your email",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verify Your Email</h2>
        <p>Hello ${user.name},</p>
        <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
        <a href="${url}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">Verify Email</a>
        <p>If you didn't create an account, please ignore this email.</p>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">This link will expire in 24 hours.</p>
        <p>Best regards,<br>Matic Platform Team</p>
      </div>
    `,
    text: `Hello ${user.name},\n\nThank you for signing up! Please verify your email address by clicking this link: ${url}\n\nIf you didn't create an account, please ignore this email.\n\nThis link will expire in 24 hours.\n\nBest regards,\nMatic Platform Team`,
  })
}
