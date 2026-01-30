package handlers

import (
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
)

// PreviewAuthEmail generates a preview of authentication email templates
// GET /api/v1/auth/preview-email?type=magic-link
func PreviewAuthEmail(c *gin.Context) {
	emailType := c.DefaultQuery("type", "magic-link")

	// Validate type
	if emailType != "magic-link" && emailType != "password-reset" && emailType != "verification" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email type. Use: magic-link, password-reset, or verification"})
		return
	}

	// Sample device info
	deviceInfo := &services.DeviceInfo{
		IPAddress:  "192.168.1.100",
		UserAgent:  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		Browser:    "Google Chrome",
		OS:         "macOS",
		Location:   "San Francisco, CA",
		DeviceType: "Desktop",
		Timestamp:  time.Now(),
	}

	// Build email template
	authTemplate := services.AuthEmailTemplate{
		Type:          emailType,
		Email:         "user@example.com",
		UserName:      "John Doe",
		ActionURL:     "https://maticsapp.com/verify?token=sample_token_abc123",
		ExpiryMinutes: 15,
		CompanyName:   "Matic Platform",
		CompanyLogo:   "https://maticsapp.com/logo.png",
		BrandColor:    "#2563eb",
		Device:        deviceInfo,
	}

	htmlBody, plainTextBody, subject := authTemplate.BuildAuthEmail()

	// Return HTML for browser preview
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Email Preview - %s</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
			margin: 0;
			padding: 0;
			background-color: #f5f5f5;
		}
		.preview-container {
			max-width: 1200px;
			margin: 0 auto;
			padding: 20px;
		}
		.preview-header {
			background: white;
			padding: 20px;
			border-radius: 8px;
			margin-bottom: 20px;
			box-shadow: 0 1px 3px rgba(0,0,0,0.1);
		}
		.preview-header h1 {
			margin: 0 0 10px 0;
			font-size: 24px;
			color: #1a1a1a;
		}
		.preview-header p {
			margin: 5px 0;
			color: #666;
			font-size: 14px;
		}
		.preview-tabs {
			display: flex;
			gap: 10px;
			margin-bottom: 20px;
		}
		.tab {
			padding: 10px 20px;
			background: white;
			border: none;
			border-radius: 6px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 500;
			transition: all 0.2s;
		}
		.tab:hover {
			background: #f0f0f0;
		}
		.tab.active {
			background: #2563eb;
			color: white;
		}
		.preview-content {
			background: white;
			border-radius: 8px;
			box-shadow: 0 1px 3px rgba(0,0,0,0.1);
			overflow: hidden;
		}
		.tab-content {
			display: none;
			padding: 20px;
		}
		.tab-content.active {
			display: block;
		}
		.email-preview {
			background: #f7f7f7;
			padding: 40px 20px;
			border-radius: 4px;
		}
		.plain-text-preview {
			white-space: pre-wrap;
			font-family: 'Courier New', monospace;
			font-size: 13px;
			line-height: 1.6;
			color: #333;
		}
		.type-selector {
			margin-bottom: 20px;
		}
		.type-selector a {
			display: inline-block;
			padding: 8px 16px;
			margin-right: 10px;
			background: #f0f0f0;
			color: #333;
			text-decoration: none;
			border-radius: 6px;
			font-size: 14px;
			transition: all 0.2s;
		}
		.type-selector a:hover {
			background: #e0e0e0;
		}
		.type-selector a.active {
			background: #2563eb;
			color: white;
		}
	</style>
</head>
<body>
	<div class="preview-container">
		<div class="preview-header">
			<h1>Authentication Email Preview</h1>
			<p><strong>Type:</strong> %s</p>
			<p><strong>Subject:</strong> %s</p>
		</div>

		<div class="type-selector">
			<a href="?type=magic-link" class="%s">Magic Link</a>
			<a href="?type=password-reset" class="%s">Password Reset</a>
			<a href="?type=verification" class="%s">Email Verification</a>
		</div>

		<div class="preview-tabs">
			<button class="tab active" onclick="showTab('html')">HTML Preview</button>
			<button class="tab" onclick="showTab('plain')">Plain Text</button>
			<button class="tab" onclick="showTab('html-source')">HTML Source</button>
		</div>

		<div class="preview-content">
			<div id="html" class="tab-content active">
				<div class="email-preview">
					%s
				</div>
			</div>
			<div id="plain" class="tab-content">
				<div class="plain-text-preview">%s</div>
			</div>
			<div id="html-source" class="tab-content">
				<pre style="overflow-x: auto; background: #f5f5f5; padding: 20px; border-radius: 4px; font-size: 12px;">%s</pre>
			</div>
		</div>
	</div>

	<script>
		function showTab(tabName) {
			// Hide all tabs
			document.querySelectorAll('.tab-content').forEach(content => {
				content.classList.remove('active');
			});
			document.querySelectorAll('.tab').forEach(tab => {
				tab.classList.remove('active');
			});

			// Show selected tab
			document.getElementById(tabName).classList.add('active');
			event.target.classList.add('active');
		}
	</script>
</body>
</html>`,
		subject,
		emailType,
		subject,
		activeCls("magic-link", emailType),
		activeCls("password-reset", emailType),
		activeCls("verification", emailType),
		htmlBody,
		plainTextBody,
		htmlEscape(htmlBody),
	)
}

// Helper to determine active class
func activeCls(expected, actual string) string {
	if expected == actual {
		return "active"
	}
	return ""
}

// htmlEscape escapes HTML for display in <pre> tags
func htmlEscape(s string) string {
	s = replaceAll(s, "&", "&amp;")
	s = replaceAll(s, "<", "&lt;")
	s = replaceAll(s, ">", "&gt;")
	s = replaceAll(s, "\"", "&quot;")
	return s
}

func replaceAll(s, old, new string) string {
	result := ""
	for i := 0; i < len(s); i++ {
		if i+len(old) <= len(s) && s[i:i+len(old)] == old {
			result += new
			i += len(old) - 1
		} else {
			result += string(s[i])
		}
	}
	return result
}
