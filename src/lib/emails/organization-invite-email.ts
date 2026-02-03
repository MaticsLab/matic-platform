import { sendEmail } from "./send-email"

interface OrganizationInviteData {
  id: string
  email: string
  organization: {
    name: string
  }
  inviter: {
    user: {
      name?: string
      email: string
    }
  }
}

export async function sendOrganizationInviteEmail(data: OrganizationInviteData) {
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || 'https://www.maticsapp.com';
  const inviteLink = `${baseURL}/accept-invitation/${data.id}`;
  
  await sendEmail({
    to: data.email,
    subject: `You've been invited to join ${data.organization.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af;">Join ${data.organization.name}</h2>
        <p>Hi there,</p>
        <p><strong>${data.inviter.user.name || data.inviter.user.email}</strong> has invited you to join <strong>${data.organization.name}</strong> on Matic Platform.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 500; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          This invitation will expire in 48 hours. If you don't want to join this organization, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} Matic Platform. All rights reserved.
        </p>
      </div>
    `,
    text: `Hi there,\n\n${data.inviter.user.name || data.inviter.user.email} has invited you to join ${data.organization.name} on Matic Platform.\n\nAccept the invitation by visiting:\n${inviteLink}\n\nThis invitation will expire in 48 hours. If you don't want to join this organization, you can safely ignore this email.\n\n© ${new Date().getFullYear()} Matic Platform. All rights reserved.`,
  });
}
