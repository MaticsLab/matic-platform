# Authentication Email Templates

Professional Vercel/Notion-style email templates for authentication flows with device information tracking.

## Overview

The authentication email system provides clean, professional templates for:
- **Magic Link Login** - Passwordless authentication for portal users
- **Password Reset** - Secure password reset emails
- **Email Verification** - Email confirmation for new accounts

All templates follow Resend best practices and include:
- ✅ Responsive table-based layouts (works in all email clients)
- ✅ Device information (browser, OS, IP address, location)
- ✅ Dark mode support
- ✅ Inline CSS for Gmail compatibility
- ✅ Plain text alternatives
- ✅ Workspace branding (logo, colors)

## Architecture

### Go Backend Template Engine

**Location**: `go-backend/services/email_templates.go`

Professional email HTML generation with:
- `AuthEmailTemplate` - Main template builder
- `DeviceInfo` - Device/session information
- `ParseUserAgent()` - Browser/OS detection
- `BuildAuthEmail()` - Generates HTML, plain text, and subject

### API Endpoint

**Endpoint**: `POST /api/v1/auth/generate-email`

**Location**: `go-backend/handlers/auth_emails.go`

Generates professional auth emails on demand:

```json
{
  "type": "magic-link",
  "email": "user@example.com",
  "userName": "John Doe",
  "actionUrl": "https://app.com/verify?token=xxx",
  "expiryMinutes": 15,
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "location": "San Francisco, CA",
  "companyName": "Matic Platform",
  "companyLogo": "https://...",
  "brandColor": "#2563eb"
}
```

Returns:
```json
{
  "html": "<html>...",
  "plainText": "...",
  "subject": "Sign in to Matic Platform"
}
```

### Frontend Helper

**Location**: `src/lib/auth-email-helper.ts`

Utilities for calling the email API:
- `generateAuthEmail()` - Calls Go backend for template generation (throws error if backend unavailable)
- `extractDeviceInfo()` - Extracts IP, user agent from request

## Integration with Better Auth

### Main App Auth

**Location**: `src/lib/better-auth.ts`

Updated sendResetPassword and sendMagicLink to use professional templates:

```typescript
sendResetPassword: async ({ user, url, request }) => {
  const deviceInfo = extractDeviceInfo(request);
  
  const { html, plainText, subject } = await generateAuthEmail({
    type: 'password-reset',
    email: user.email,
    userName: user.name,
    actionUrl: url,
    expiryMinutes: 60,
    companyName: 'Matic Platform',
    brandColor: '#2563eb',
    ...deviceInfo,
  });
  
  await resend.emails.send({
    from: 'Matics <hello@notifications.maticsapp.com>',
    to: user.email,
    subject,
    html,
    text: plainText,
  });
}
```

### Portal Auth

**Location**: `src/lib/portal-better-auth.ts`

Same professional templates for portal users with custom branding.

## Email Templates

### Magic Link Email

**Subject**: `Sign in to [Company Name]`

**Features**:
- Clean CTA button
- Link expiry notice (15 minutes)
- Device information section
- Security warning
- Workspace branding

**Device Info Displayed**:
- Device type (Desktop/Mobile/Tablet)
- Browser (Chrome, Safari, Firefox, etc.)
- Operating System (Windows, macOS, iOS, etc.)
- Request timestamp
- IP address (optional)
- Location (optional)

### Password Reset Email

**Subject**: `Reset your password — [Company Name]`

**Features**:
- Secure reset link
- Link expiry notice (60 minutes)
- Device information
- Safety notice ("didn't request this?")
- Workspace branding

### Device Information Section

Every auth email includes device details:

```
REQUEST DETAILS:
- Device: Desktop Google Chrome on macOS
- Time: Monday, January 30, 2026 at 2:30 PM PST
- Location: San Francisco, CA (optional)
- IP Address: 192.168.1.1

If this wasn't you, please ignore this email or contact support.
```

## Workspace Branding

Templates automatically use workspace settings:

- **Company Logo** - Displayed in header
- **Brand Color** - Used for buttons and links
- **Company Name** - In subject and footer
- **Portal Name** - For portal-specific emails

Branding is fetched from form settings when formId is present in callback URL.

## Security Features

1. **Request Tracking**
   - IP address logging
   - User agent tracking
   - Timestamp recording
   - Device fingerprinting

2. **Expiry Notices**
   - Magic links: 15 minutes
   - Password reset: 60 minutes
   - Clear expiry messaging

3. **Warnings**
   - "Don't forward this email"
   - "If this wasn't you..."
   - Support contact information

## Email Client Compatibility

Tested and working in:
- ✅ Gmail (web and mobile)
- ✅ Outlook (desktop and web)
- ✅ Apple Mail (macOS and iOS)
- ✅ Yahoo Mail
- ✅ ProtonMail
- ✅ Thunderbird

### Technical Compatibility

- Table-based layouts (not flexbox/grid)
- Inline CSS only (no external stylesheets)
- No JavaScript
- Web-safe fonts
- Responsive design with media queries
- Dark mode support

## Development

### Preview Emails in Browser

Visit these URLs to preview email templates:
- Magic Link: http://localhost:8080/api/v1/auth/preview-email?type=magic-link
- Password Reset: http://localhost:8080/api/v1/auth/preview-email?type=password-reset
- Email Verification: http://localhost:8080/api/v1/auth/preview-email?type=verification

The preview page shows:
- ✅ Live HTML rendering
- ✅ Plain text version
- ✅ HTML source code
- ✅ Sample device information
- ✅ All email types

### Testing Locally

1. Start Go backend:
```bash
cd go-backend && go run main.go
```

2. Test email generation:
```bash
curl -X POST http://localhost:8080/api/v1/auth/generate-email \
  -H "Content-Type: application/json" \
  -d '{
    "type": "magic-link",
    "email": "test@example.com",
    "actionUrl": "https://app.com/verify?token=test",
    "companyName": "Test Company",
    "brandColor": "#2563eb",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
  }'
```

3. Trigger auth flow:
```typescript
// In your app
import { portalBetterAuthClient } from '@/lib/portal-better-auth-client';

await portalBetterAuthClient.signIn.magicLink({
  email: 'user@example.com',
  callbackURL: '/portal'
});
```

### Adding Device Location

To add geolocation, integrate an IP lookup service:

```typescript
// In auth-email-helper.ts
async function getLocation(ipAddress: string): Promise<string> {
  const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
  const data = await response.json();
  return `${data.city}, ${data.region}`;
}
```

## Customization

### Adding New Template Types

1. Add type to `AuthEmailTemplate`:
```go
// In email_templates.go
switch a.Type {
case "magic-link":
  // ...
case "password-reset":
  // ...
case "welcome": // NEW
  title = "Welcome!"
  description = "Get started with your account"
  buttonText = "Get Started"
  // ...
}
```

2. Update TypeScript types:
```typescript
// In auth-email-helper.ts
interface AuthEmailRequest {
  type: 'magic-link' | 'password-reset' | 'verification' | 'welcome';
  // ...
}
```

### Custom Branding

Override default styles per workspace:

```typescript
await generateAuthEmail({
  type: 'magic-link',
  email: user.email,
  actionUrl: url,
  companyName: workspace.name,
  companyLogo: workspace.logoUrl,
  brandColor: workspace.primaryColor, // Custom color
});
```

## Monitoring

### Email Deliverability

Check email performance:
- Open rates (via Resend dashboard)
- Bounce rates
- Spam complaints
- Click-through rates

### Device Analytics

Track authentication patterns:
- Most common browsers
- Desktop vs mobile usage
- Geographic distribution
- Peak authentication times

## Troubleshooting

### Emails Look Broken

**Issue**: HTML rendering incorrectly
**Solution**: Ensure inline CSS, table-based layout, no external resources

### Device Info Missing

**Issue**: No device information showing
**Solution**: Check that better-auth passes request context to email handlers

### Branding Not Applied

**Issue**: Default branding instead of workspace branding
**Solution**: Verify formId is in callback URL and form settings are configured

### Email Generation Failed

**Issue**: Email generation throws error
**Solution**: Ensure Go backend is running and accessible at NEXT_PUBLIC_GO_API_URL. Check backend logs for compilation errors.

## Best Practices

1. **Always Include Device Info** - Helps users identify suspicious login attempts
2. **Clear Expiry Times** - Users need to know how long links are valid
3. **Consistent Branding** - Use workspace colors and logos
4. **Plain Text Alternative** - Required by email standards
5. **Security Warnings** - Remind users not to share auth links
6. **Support Contact** - Provide help if something seems wrong

## Resources

- [Resend Email Best Practices](https://resend.com/docs/send-with-nodejs)
- [React Email Components](https://react.email/)
- [Email Client CSS Support](https://www.caniemail.com/)
- [Better Auth Documentation](https://www.better-auth.com/)

## Files Reference

### Backend
- `go-backend/services/email_templates.go` - Template engine
- `go-backend/handlers/auth_emails.go` - API endpoint
- `go-backend/router/router.go` - Route registration

### Frontend
- `src/lib/auth-email-helper.ts` - Helper functions
- `src/lib/better-auth.ts` - Main app integration
- `src/lib/portal-better-auth.ts` - Portal integration

### Database
- `ba_sessions` - Stores IP address and user agent
- `ba_verifications` - Stores magic link tokens
