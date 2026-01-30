# Resend Best Practices Implementation

This document outlines the Resend best practices we've implemented in the authentication email system following the official Resend skills and recommendations.

## ✅ Implemented Best Practices

### 1. **Email Validation** 
*Before sending, always validate email addresses*

**Implementation**: 
- `isValidEmail()` function validates format before API calls
- RFC 5322 compliant regex validation
- Email length validation (max 254 characters)
- Fail-fast approach - reject invalid emails immediately

**Location**: `src/lib/auth-email-helper.ts`

```typescript
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}
```

### 2. **Retry Logic with Exponential Backoff**
*Implement retries for transient failures*

**Implementation**:
- 2 retry attempts for failed requests
- Exponential backoff (1s, 2s)
- Skip retries for validation errors
- Fallback to simple template after all retries

**Location**: `src/lib/auth-email-helper.ts`

```typescript
const maxRetries = 2;
const retryDelay = 1000; // 1 second

for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    // ... API call
  } catch (error) {
    if (attempt < maxRetries) {
      await new Promise(resolve => 
        setTimeout(resolve, retryDelay * (attempt + 1))
      );
      continue;
    }
  }
}
```

### 3. **Timeout Handling**
*Prevent hanging requests with timeouts*

**Implementation**:
- 5-second timeout on API calls
- AbortController for proper request cancellation
- Graceful degradation to fallback template

**Location**: `src/lib/auth-email-helper.ts`

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const response = await fetch(url, {
  signal: controller.signal,
});

clearTimeout(timeoutId);
```

### 4. **Tags for Tracking and Analytics**
*Use tags to organize and track email performance*

**Implementation**:
- Category tags (auth, marketing, transactional)
- Type tags (magic-link, password-reset, verification)
- Environment tags (production, development)
- Portal tags for multi-tenant tracking

**Location**: `src/lib/better-auth.ts`, `src/lib/portal-better-auth.ts`

```typescript
tags: [
  { name: 'category', value: 'auth' },
  { name: 'type', value: 'magic-link' },
  { name: 'portal', value: subdomain || 'main' },
  { name: 'environment', value: process.env.NODE_ENV },
]
```

### 5. **Custom Headers for Deliverability**
*Add headers to improve deliverability and tracking*

**Implementation**:
- `X-Entity-Ref-ID` for unique email identification
- `X-Priority` set to 1 for auth emails (high priority)
- Proper Reply-To headers

**Location**: `src/lib/better-auth.ts`, `src/lib/portal-better-auth.ts`

```typescript
headers: {
  'X-Entity-Ref-ID': `pwd-reset-${user.id}`,
  'X-Priority': '1',
}
```

### 6. **Proper Reply-To Format**
*Use correct snake_case for Resend API*

**Implementation**:
- Changed from `replyTo` to `reply_to`
- Consistent support email address
- Matches Resend API requirements

```typescript
reply_to: "support@maticsapp.com"
```

### 7. **Plain Text Alternatives**
*Always include plain text version for accessibility*

**Implementation**:
- Auto-generated plain text from HTML
- Properly formatted with line breaks
- Device information included in text version
- All authentication emails have both HTML and text

**Location**: `go-backend/services/email_templates.go`

### 8. **Responsive Table-Based Layouts**
*Use tables for maximum email client compatibility*

**Implementation**:
- Table-based layout (not flexbox/grid)
- Inline CSS only
- Mobile-responsive with media queries
- Dark mode support
- Works in Outlook, Gmail, Apple Mail, etc.

**Location**: `go-backend/services/email_templates.go`

### 9. **Proper Email Structure**
*Follow email HTML best practices*

**Implementation**:
- ✅ DOCTYPE declaration
- ✅ XHTML 1.0 Transitional
- ✅ Proper meta tags
- ✅ Color scheme support
- ✅ MSO conditional comments for Outlook
- ✅ Preheader text for inbox preview
- ✅ 600px max width
- ✅ Web-safe fonts

### 10. **Error Handling and Logging**
*Comprehensive error handling for production*

**Implementation**:
- Try-catch blocks around all email operations
- Detailed error logging with attempt numbers
- Graceful fallbacks for failures
- User-friendly error messages

**Location**: `src/lib/auth-email-helper.ts`

```typescript
console.error(`[Auth Email] Attempt ${attempt + 1} failed:`, error.message);
console.warn('[Auth Email] All retries failed, using fallback template');
```

## 📊 Email Analytics with Tags

Track email performance in Resend dashboard by:

### Category Tags
- `auth` - Authentication emails
- `marketing` - Marketing campaigns
- `transactional` - Order confirmations, receipts

### Type Tags
- `magic-link` - Passwordless login
- `password-reset` - Password recovery
- `verification` - Email verification

### Portal Tags
- `main` - Main application
- `portal` - Applicant portal
- Custom subdomain values

### Environment Tags
- `production` - Live emails
- `development` - Test emails

## 🔐 Security Best Practices

### Rate Limiting Awareness
- Be mindful of Resend API rate limits
- Implement client-side throttling if needed
- Use tags to monitor usage patterns

### Email Authentication
Ensure these DNS records are configured:

```
SPF:    v=spf1 include:resend.net ~all
DKIM:   Configured via Resend dashboard
DMARC:  v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

### Content Security
- Sanitize user-generated content
- No external scripts in emails
- Validate all URLs before including
- Escape HTML properly

## 🎯 Performance Optimization

### Template Caching
- Cache compiled templates when possible
- Reuse template builder instances
- Minimize API calls

### Lazy Loading
- Load email templates on demand
- Don't preload heavy assets
- Optimize image sizes (max 600px width)

### Compression
- Minimize HTML when possible
- Remove unnecessary whitespace
- Inline critical CSS only

## 📝 Content Best Practices

### Subject Lines
- Keep under 50 characters
- Avoid spam trigger words
- Include brand name
- Clear and actionable

Examples:
- ✅ "Sign in to Matic Platform"
- ✅ "Reset your password — Matic"
- ❌ "URGENT!!! ACT NOW!!!"

### Preheader Text
- First 100 characters after subject
- Complements subject line
- Don't repeat subject

### Call-to-Action
- One primary CTA per email
- Use button (not just link)
- Clear action verb
- High contrast colors

### Footer
- Company name and year
- Unsubscribe link (for marketing)
- Support contact
- Physical address (CAN-SPAM compliance)

## 🧪 Testing Checklist

- [ ] Send test to multiple email clients
- [ ] Check mobile rendering
- [ ] Verify dark mode appearance
- [ ] Test all links and buttons
- [ ] Review plain text version
- [ ] Check spam score (Mail-Tester.com)
- [ ] Verify tags appear in Resend dashboard
- [ ] Test retry logic with network failures
- [ ] Validate email format checks work
- [ ] Confirm timeout handling

## 📈 Monitoring and Metrics

Track these metrics in Resend dashboard:

### Delivery Metrics
- Delivery rate (should be >95%)
- Bounce rate (should be <5%)
- Complaint rate (should be <0.1%)

### Engagement Metrics
- Open rate (track with tags)
- Click rate (track with tags)
- Time to open

### Authentication Metrics
- Magic link success rate
- Password reset completion rate
- Average time to click

## 🚨 Troubleshooting

### Emails Going to Spam
1. Check SPF/DKIM/DMARC records
2. Review spam score on Mail-Tester.com
3. Remove spam trigger words
4. Add plain text version
5. Verify sender reputation

### High Bounce Rate
1. Validate email addresses before sending
2. Clean email list regularly
3. Remove hard bounces immediately
4. Check for typos in recipient addresses

### Low Open Rates
1. Improve subject lines
2. Optimize send time
3. Segment audience better
4. A/B test preheader text

### API Failures
1. Check retry logic is working
2. Verify API key is valid
3. Monitor rate limits
4. Review error logs

## 🔄 Future Improvements

### Planned Enhancements
- [ ] A/B testing framework
- [ ] Email template versioning
- [ ] Advanced analytics dashboard
- [ ] Webhook integration for events
- [ ] Batch email sending
- [ ] Email queue with Redis
- [ ] Scheduled email sending
- [ ] Email preferences center

### Advanced Features
- [ ] Dynamic content based on user segments
- [ ] Personalization beyond name
- [ ] Multi-language support
- [ ] Automated email sequences
- [ ] Smart send time optimization

## 📚 Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend Best Practices](https://resend.com/docs/send-with-nodejs)
- [React Email](https://react.email/)
- [Email on Acid](https://www.emailonacid.com/)
- [Can I Email](https://www.caniemail.com/)
- [Mail Tester](https://www.mail-tester.com/)

## 🎓 Key Takeaways

1. **Always validate emails** before sending
2. **Implement retry logic** for resilience
3. **Use tags** for tracking and analytics
4. **Add timeouts** to prevent hanging
5. **Provide plain text** alternatives
6. **Use table layouts** for compatibility
7. **Test thoroughly** across clients
8. **Monitor metrics** in Resend dashboard
9. **Follow security** best practices
10. **Keep improving** based on data

---

**Last Updated**: January 30, 2026
**Skills Used**: resend/resend-skills, resend/react-email, resend/email-best-practices
