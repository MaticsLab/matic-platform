import { sendEmail } from "./send-email"

export function sendWelcomeEmail(user: { name: string; email: string }) {
  return sendEmail({
    to: user.email,
    subject: "Welcome to Matic Platform!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Matic Platform! 🎉</h2>
        <p>Hello ${user.name},</p>
        <p>Thank you for joining Matic Platform! We're excited to have you on board.</p>
        <p>You can now:</p>
        <ul style="color: #555;">
          <li>Create and manage data tables</li>
          <li>Build custom forms</li>
          <li>Collaborate with your team</li>
          <li>And much more!</li>
        </ul>
        <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
        <p>Best regards,<br>Matic Platform Team</p>
      </div>
    `,
    text: `Hello ${user.name},\n\nWelcome to Matic Platform!\n\nThank you for joining us! We're excited to have you on board.\n\nYou can now create and manage data tables, build custom forms, collaborate with your team, and much more!\n\nIf you have any questions or need assistance, feel free to reach out to our support team.\n\nBest regards,\nMatic Platform Team`,
  })
}
