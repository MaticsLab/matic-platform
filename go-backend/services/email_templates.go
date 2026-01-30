package services

import (
	"fmt"
	"strings"
	"time"
)

// EmailTemplateBuilder creates production-ready email HTML following Resend best practices
type EmailTemplateBuilder struct {
	Subject       string
	PreheaderText string
	Body          string
	IsHTML        bool
	BrandColor    string
	CompanyName   string
	CompanyLogo   string
	FooterText    string
}

// AuthEmailTemplate creates clean, Vercel/Notion-style authentication emails
type AuthEmailTemplate struct {
	Type          string // "magic-link", "password-reset", "verification"
	Email         string
	UserName      string
	ActionURL     string
	ExpiryMinutes int
	CompanyName   string
	CompanyLogo   string
	BrandColor    string

	// Device information
	Device *DeviceInfo
}

// DeviceInfo contains information about the device/session requesting authentication
type DeviceInfo struct {
	IPAddress  string
	UserAgent  string
	Browser    string
	OS         string
	Location   string
	DeviceType string // desktop, mobile, tablet
	Timestamp  time.Time
}

// BuildHTML creates a responsive, email-client compatible HTML email
// Following Resend and email best practices:
// 1. Uses tables for layout (best compatibility)
// 2. Inline CSS (Gmail requirement)
// 3. Proper DOCTYPE and meta tags
// 4. Responsive design with media queries
// 5. Dark mode support
// 6. Preheader text for better inbox preview
func (b *EmailTemplateBuilder) BuildHTML() string {
	brandColor := b.BrandColor
	if brandColor == "" {
		brandColor = "#3B82F6" // Default blue
	}

	companyName := b.CompanyName
	if companyName == "" {
		companyName = "Matic Platform"
	}

	// Extract or generate preheader
	preheader := b.PreheaderText
	if preheader == "" && !b.IsHTML {
		// Use first 100 chars of body as preheader
		preheader = b.Body
		if len(preheader) > 100 {
			preheader = preheader[:100] + "..."
		}
	}

	// Process body content
	bodyContent := b.Body
	if b.IsHTML {
		// Body is already HTML
		bodyContent = b.sanitizeHTML(bodyContent)
	} else {
		// Convert plain text to HTML with proper formatting
		bodyContent = b.plainTextToHTML(bodyContent)
	}

	// Build the full HTML email
	html := fmt.Sprintf(`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <title>%s</title>
  <style type="text/css">
    /* Client-specific Styles */
    body, table, td, a { -webkit-text-size-adjust: 100%%; -ms-text-size-adjust: 100%%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%%; outline: none; text-decoration: none; }
    
    /* Reset Styles */
    body { margin: 0; padding: 0; width: 100%% !important; }
    img { border: 0; }
    
    /* iOS BLUE LINKS */
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }
    
    /* Dark Mode Styles */
    @media (prefers-color-scheme: dark) {
      .dark-mode-bg { background-color: #1F2937 !important; }
      .dark-mode-text { color: #F9FAFB !important; }
      .dark-mode-border { border-color: #374151 !important; }
    }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100%% !important; }
      .mobile-padding { padding: 15px !important; }
      .mobile-font-size { font-size: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  
  <!-- Preheader Text (hidden but shown in email preview) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    %s
  </div>
  
  <!-- Spacer to push content away from preheader in some clients -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <!-- Email Container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%" style="margin: 0; padding: 0; background-color: #F3F4F6;">
    <tr>
      <td style="padding: 20px 0;">
        
        <!-- Centered Email Content -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-container" align="center" width="600" style="margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
          
          <!-- Header with Logo -->
          %s
          
          <!-- Main Content -->
          <tr>
            <td class="mobile-padding" style="padding: 40px 40px 20px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%">
                <tr>
                  <td style="color: #1F2937; font-size: 16px; line-height: 1.6;">
                    %s
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="mobile-padding" style="padding: 20px 40px 40px 40px; border-top: 1px solid #E5E7EB;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%">
                <tr>
                  <td style="color: #6B7280; font-size: 12px; line-height: 1.5; text-align: center;">
                    %s
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`,
		b.Subject,
		preheader,
		b.buildHeader(),
		bodyContent,
		b.buildFooter(),
	)

	return html
}

// buildHeader creates the email header with optional logo
func (b *EmailTemplateBuilder) buildHeader() string {
	if b.CompanyLogo == "" {
		return ""
	}

	return fmt.Sprintf(`
          <tr>
            <td style="padding: 30px 40px; text-align: center; border-bottom: 1px solid #E5E7EB;">
              <img src="%s" alt="%s" width="150" style="max-width: 150px; height: auto;" />
            </td>
          </tr>`, b.CompanyLogo, b.CompanyName)
}

// buildFooter creates the email footer
func (b *EmailTemplateBuilder) buildFooter() string {
	footerText := b.FooterText
	if footerText == "" {
		footerText = fmt.Sprintf("&copy; %s. All rights reserved.", b.CompanyName)
	}

	return footerText
}

// sanitizeHTML cleans up user-provided HTML for email compatibility
func (b *EmailTemplateBuilder) sanitizeHTML(html string) string {
	// Remove dangerous tags and attributes
	// This is a basic sanitizer - in production, use a proper HTML sanitizer library

	// Remove script tags
	html = strings.ReplaceAll(html, "<script", "")
	html = strings.ReplaceAll(html, "</script>", "")

	// Remove style tags (inline styles are okay)
	html = strings.ReplaceAll(html, "<style", "")
	html = strings.ReplaceAll(html, "</style>", "")

	// Ensure images have proper attributes for email
	// Add display:block to prevent spacing issues
	html = strings.ReplaceAll(html, "<img ", `<img style="display: block; max-width: 100%; height: auto;" `)

	return html
}

// plainTextToHTML converts plain text to email-safe HTML
func (b *EmailTemplateBuilder) plainTextToHTML(text string) string {
	if text == "" {
		return ""
	}

	// Escape HTML special characters
	text = strings.ReplaceAll(text, "&", "&amp;")
	text = strings.ReplaceAll(text, "<", "&lt;")
	text = strings.ReplaceAll(text, ">", "&gt;")
	text = strings.ReplaceAll(text, "\"", "&quot;")

	// Convert URLs to clickable links
	text = b.linkifyURLs(text)

	// Convert line breaks to paragraphs
	paragraphs := strings.Split(text, "\n\n")
	var html strings.Builder

	for _, para := range paragraphs {
		if strings.TrimSpace(para) == "" {
			continue
		}

		// Replace single line breaks with <br>
		para = strings.ReplaceAll(para, "\n", "<br />")

		html.WriteString(fmt.Sprintf(`<p style="margin: 0 0 16px 0; color: #1F2937; font-size: 16px; line-height: 1.6;">%s</p>`, para))
	}

	return html.String()
}

// linkifyURLs converts plain text URLs to clickable links
func (b *EmailTemplateBuilder) linkifyURLs(text string) string {
	// Simple URL detection - in production, use a proper URL regex
	words := strings.Fields(text)
	for i, word := range words {
		if strings.HasPrefix(word, "http://") || strings.HasPrefix(word, "https://") {
			words[i] = fmt.Sprintf(`<a href="%s" style="color: %s; text-decoration: underline;">%s</a>`,
				word, b.BrandColor, word)
		}
	}
	return strings.Join(words, " ")
}

// BuildPlainText creates a plain text version from HTML or plain text
func (b *EmailTemplateBuilder) BuildPlainText() string {
	if !b.IsHTML {
		return b.Body
	}

	// Strip HTML tags for plain text version
	text := b.Body

	// Remove script and style content
	text = strings.ReplaceAll(text, "<script", "")
	text = strings.ReplaceAll(text, "</script>", "")
	text = strings.ReplaceAll(text, "<style", "")
	text = strings.ReplaceAll(text, "</style>", "")

	// Replace common HTML tags with text equivalents
	text = strings.ReplaceAll(text, "<br>", "\n")
	text = strings.ReplaceAll(text, "<br/>", "\n")
	text = strings.ReplaceAll(text, "<br />", "\n")
	text = strings.ReplaceAll(text, "</p>", "\n\n")
	text = strings.ReplaceAll(text, "</div>", "\n")
	text = strings.ReplaceAll(text, "</h1>", "\n\n")
	text = strings.ReplaceAll(text, "</h2>", "\n\n")
	text = strings.ReplaceAll(text, "</h3>", "\n\n")

	// Remove all remaining HTML tags
	for strings.Contains(text, "<") {
		start := strings.Index(text, "<")
		end := strings.Index(text[start:], ">")
		if end == -1 {
			break
		}
		text = text[:start] + text[start+end+1:]
	}

	// Decode common HTML entities
	text = strings.ReplaceAll(text, "&nbsp;", " ")
	text = strings.ReplaceAll(text, "&amp;", "&")
	text = strings.ReplaceAll(text, "&lt;", "<")
	text = strings.ReplaceAll(text, "&gt;", ">")
	text = strings.ReplaceAll(text, "&quot;", "\"")

	// Clean up excessive whitespace
	for strings.Contains(text, "  ") {
		text = strings.ReplaceAll(text, "  ", " ")
	}
	for strings.Contains(text, "\n\n\n") {
		text = strings.ReplaceAll(text, "\n\n\n", "\n\n")
	}

	return strings.TrimSpace(text)
}

// ParseUserAgent extracts browser and OS information from user agent string
func ParseUserAgent(userAgent string) (browser, os, deviceType string) {
	ua := strings.ToLower(userAgent)

	// Detect browser
	switch {
	case strings.Contains(ua, "edge"):
		browser = "Microsoft Edge"
	case strings.Contains(ua, "edg/"):
		browser = "Microsoft Edge"
	case strings.Contains(ua, "chrome") && !strings.Contains(ua, "edg"):
		browser = "Google Chrome"
	case strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome"):
		browser = "Safari"
	case strings.Contains(ua, "firefox"):
		browser = "Firefox"
	case strings.Contains(ua, "opera") || strings.Contains(ua, "opr/"):
		browser = "Opera"
	default:
		browser = "Unknown Browser"
	}

	// Detect OS
	switch {
	case strings.Contains(ua, "windows"):
		os = "Windows"
	case strings.Contains(ua, "mac os x") || strings.Contains(ua, "macos"):
		os = "macOS"
	case strings.Contains(ua, "iphone"):
		os = "iOS"
	case strings.Contains(ua, "ipad"):
		os = "iPadOS"
	case strings.Contains(ua, "android"):
		os = "Android"
	case strings.Contains(ua, "linux"):
		os = "Linux"
	default:
		os = "Unknown OS"
	}

	// Detect device type
	switch {
	case strings.Contains(ua, "mobile") || strings.Contains(ua, "iphone") || strings.Contains(ua, "android"):
		deviceType = "Mobile"
	case strings.Contains(ua, "tablet") || strings.Contains(ua, "ipad"):
		deviceType = "Tablet"
	default:
		deviceType = "Desktop"
	}

	return browser, os, deviceType
}

// BuildAuthEmail creates a Vercel/Notion-style authentication email
func (a *AuthEmailTemplate) BuildAuthEmail() (htmlBody, plainTextBody, subject string) {
	brandColor := a.BrandColor
	if brandColor == "" {
		brandColor = "#3B82F6"
	}

	companyName := a.CompanyName
	if companyName == "" {
		companyName = "Matic Platform"
	}

	// Build subject line
	switch a.Type {
	case "magic-link":
		subject = fmt.Sprintf("Sign in to %s", companyName)
	case "password-reset":
		subject = fmt.Sprintf("Reset your password — %s", companyName)
	case "verification":
		subject = fmt.Sprintf("Verify your email — %s", companyName)
	default:
		subject = fmt.Sprintf("Action required — %s", companyName)
	}

	// Build preheader
	var preheader string
	switch a.Type {
	case "magic-link":
		preheader = "Click to sign in to your account"
	case "password-reset":
		preheader = "Click to reset your password securely"
	case "verification":
		preheader = "Verify your email address to continue"
	}

	// Build body content
	var title, description, buttonText, buttonURL, securityNote string

	switch a.Type {
	case "magic-link":
		title = "Sign in to your account"
		description = "Click the button below to securely sign in. This link will expire soon."
		buttonText = "Sign in"
		buttonURL = a.ActionURL
		securityNote = "This link will expire in 15 minutes and can only be used once. For security, do not forward this email."
	case "password-reset":
		title = "Reset your password"
		description = "You requested to reset your password. Click the button below to create a new password."
		buttonText = "Reset password"
		buttonURL = a.ActionURL
		securityNote = fmt.Sprintf("This link will expire in %d minutes. If you didn't request this, you can safely ignore this email.", a.ExpiryMinutes)
	case "verification":
		title = "Verify your email"
		description = "Welcome! Please verify your email address to complete your account setup."
		buttonText = "Verify email"
		buttonURL = a.ActionURL
		securityNote = "This link will expire in 24 hours."
	}

	// Build device info section
	deviceHTML := ""
	devicePlainText := ""
	if a.Device != nil {
		deviceHTML = a.buildDeviceInfoHTML()
		devicePlainText = a.buildDeviceInfoPlainText()
	}

	// Build HTML email
	htmlBody = fmt.Sprintf(`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>%s</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%%; -ms-text-size-adjust: 100%%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100%% !important; }
    @media (prefers-color-scheme: dark) {
      .dark-bg { background-color: #111111 !important; }
      .dark-card { background-color: #1a1a1a !important; }
      .dark-text { color: #e5e5e5 !important; }
      .dark-muted { color: #a3a3a3 !important; }
      .dark-border { border-color: #333333 !important; }
    }
    @media only screen and (max-width: 600px) {
      .container { width: 100%% !important; }
      .padding { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;" class="dark-bg">
  
  <!-- Preheader -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">%s</div>
  
  <!-- Container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%" style="background-color: #f7f7f7;" class="dark-bg">
    <tr>
      <td style="padding: 40px 20px;">
        
        <!-- Email Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="container" align="center" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);" class="dark-card">
          
          <!-- Logo Header -->
          %s
          
          <!-- Main Content -->
          <tr>
            <td class="padding" style="padding: 40px 40px 32px 40px;">
              
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; line-height: 1.3; color: #1a1a1a;" class="dark-text">%s</h1>
              
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #525252;" class="dark-muted">%s</p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius: 8px; background-color: %s;">
                    <a href="%s" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 500; color: #ffffff; text-decoration: none; border-radius: 8px;">%s</a>
                  </td>
                </tr>
              </table>
              
              <!-- Or copy link -->
              <p style="margin: 24px 0 0 0; font-size: 14px; color: #737373;" class="dark-muted">
                Or copy and paste this URL into your browser:<br />
                <a href="%s" style="color: %s; word-break: break-all;">%s</a>
              </p>
              
            </td>
          </tr>
          
          <!-- Device Info Section -->
          %s
          
          <!-- Security Note -->
          <tr>
            <td style="padding: 0 40px 32px 40px; border-top: 1px solid #e5e5e5;" class="dark-border">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%" style="margin-top: 24px; padding: 16px; background-color: #f9f9f9; border-radius: 8px;" class="dark-card">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #525252;" class="dark-muted">
                      🔒 %s
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;" class="dark-card">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a3a3a3; text-align: center;" class="dark-muted">
                &copy; %d %s. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`,
		subject,
		preheader,
		a.buildLogoHTML(),
		title,
		description,
		brandColor,
		buttonURL,
		buttonText,
		buttonURL,
		brandColor,
		buttonURL,
		deviceHTML,
		securityNote,
		time.Now().Year(),
		companyName,
	)

	// Build plain text version
	userName := a.UserName
	if userName == "" {
		userName = "there"
	}

	plainTextBody = fmt.Sprintf(`%s

Hi %s,

%s

%s

%s

---
%s

© %d %s. All rights reserved.
`,
		subject,
		userName,
		description,
		buttonURL,
		devicePlainText,
		securityNote,
		time.Now().Year(),
		companyName,
	)

	return htmlBody, plainTextBody, subject
}

// buildLogoHTML creates the logo header section
func (a *AuthEmailTemplate) buildLogoHTML() string {
	if a.CompanyLogo == "" {
		return ""
	}

	return fmt.Sprintf(`
          <tr>
            <td style="padding: 32px 40px 24px 40px;">
              <img src="%s" alt="%s" width="120" style="max-width: 120px; height: auto;" />
            </td>
          </tr>`,
		a.CompanyLogo,
		a.CompanyName,
	)
}

// buildDeviceInfoHTML creates the device information section for HTML emails
func (a *AuthEmailTemplate) buildDeviceInfoHTML() string {
	if a.Device == nil {
		return ""
	}

	timeStr := a.Device.Timestamp.Format("Monday, January 2, 2006 at 3:04 PM MST")

	locationInfo := ""
	if a.Device.Location != "" {
		locationInfo = fmt.Sprintf(`
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="font-weight: 500; color: #525252;">Location:</span>
                        <span style="color: #737373;">%s</span>
                      </td>
                    </tr>`, a.Device.Location)
	}

	ipInfo := ""
	if a.Device.IPAddress != "" {
		ipInfo = fmt.Sprintf(`
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="font-weight: 500; color: #525252;">IP Address:</span>
                        <span style="color: #737373;">%s</span>
                      </td>
                    </tr>`, a.Device.IPAddress)
	}

	return fmt.Sprintf(`
          <tr>
            <td style="padding: 24px 40px 0 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%" style="padding: 16px; background-color: #f9f9f9; border-radius: 8px;" class="dark-card">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #1a1a1a;" class="dark-text">Request Details</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%%">
                      <tr>
                        <td style="padding: 4px 0;">
                          <span style="font-weight: 500; color: #525252;">Device:</span>
                          <span style="color: #737373;">%s %s on %s</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <span style="font-weight: 500; color: #525252;">Time:</span>
                          <span style="color: #737373;">%s</span>
                        </td>
                      </tr>
                      %s
                      %s
                    </table>
                    <p style="margin: 12px 0 0 0; font-size: 12px; color: #a3a3a3;" class="dark-muted">
                      If this wasn't you, please ignore this email or contact support.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`,
		a.Device.DeviceType,
		a.Device.Browser,
		a.Device.OS,
		timeStr,
		locationInfo,
		ipInfo,
	)
}

// buildDeviceInfoPlainText creates the device information section for plain text emails
func (a *AuthEmailTemplate) buildDeviceInfoPlainText() string {
	if a.Device == nil {
		return ""
	}

	timeStr := a.Device.Timestamp.Format("Monday, January 2, 2006 at 3:04 PM MST")

	deviceInfo := fmt.Sprintf(`
REQUEST DETAILS:
- Device: %s %s on %s
- Time: %s`,
		a.Device.DeviceType,
		a.Device.Browser,
		a.Device.OS,
		timeStr,
	)

	if a.Device.Location != "" {
		deviceInfo += fmt.Sprintf("\n- Location: %s", a.Device.Location)
	}

	if a.Device.IPAddress != "" {
		deviceInfo += fmt.Sprintf("\n- IP Address: %s", a.Device.IPAddress)
	}

	deviceInfo += "\n\nIf this wasn't you, please ignore this email or contact support."

	return deviceInfo
}
