package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	urlpkg "net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/Jsanchez767/matic-platform/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/resend/resend-go/v2"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// generateRecommendationToken creates a secure random token for recommendation links
func generateRecommendationToken() string {
	bytes := make([]byte, 24)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// uploadRecommendationToSupabase uploads a file to Supabase Storage and returns the public URL
func uploadRecommendationToSupabase(fileData io.Reader, storagePath string, contentType string) (string, error) {
	supabaseURL := os.Getenv("NEXT_PUBLIC_SUPABASE_URL")
	serviceRoleKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	if supabaseURL == "" || serviceRoleKey == "" {
		return "", fmt.Errorf("Supabase credentials not configured")
	}

	bucket := "workspace-assets"
	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucket, storagePath)

	req, err := http.NewRequest("POST", uploadURL, fileData)
	if err != nil {
		return "", fmt.Errorf("failed to create upload request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+serviceRoleKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "false")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("upload request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("Supabase upload failed (%d): %s", resp.StatusCode, string(body))
	}

	// Return the public URL
	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", supabaseURL, bucket, storagePath)
	return publicURL, nil
}

// rewriteLocalhostURLs fixes old localhost URLs in recommendation response JSONB
func rewriteLocalhostURLs(response []byte) ([]byte, error) {
	if len(response) == 0 {
		return response, nil
	}

	var responseData map[string]interface{}
	if err := json.Unmarshal(response, &responseData); err != nil {
		return response, nil // Return original if can't parse
	}

	// Check if uploaded_document exists and has a url
	if uploadedDoc, ok := responseData["uploaded_document"].(map[string]interface{}); ok {
		if url, ok := uploadedDoc["url"].(string); ok {
			// Rewrite localhost URLs
			if strings.Contains(url, "localhost:8080") || strings.Contains(url, "localhost:8000") {
				url = strings.ReplaceAll(url, "http://localhost:8080", "https://api.maticsapp.com")
				url = strings.ReplaceAll(url, "http://localhost:8000", "https://api.maticsapp.com")
				url = strings.ReplaceAll(url, "https://localhost:8080", "https://api.maticsapp.com")
				uploadedDoc["url"] = url
				responseData["uploaded_document"] = uploadedDoc
			}
		}
	}

	return json.Marshal(responseData)
}

// getFormLogoURL extracts the logo URL from form settings
func getFormLogoURL(form *models.Table) string {
	if form.Settings == nil {
		return ""
	}
	var settings map[string]interface{}
	if err := json.Unmarshal(form.Settings, &settings); err != nil {
		return ""
	}
	// 1. Check emailSettings overrride (snake_case or camelCase)
	if es, ok := settings["emailSettings"].(map[string]interface{}); ok {
		for _, k := range []string{"logo_url", "logoUrl"} {
			if lu, ok := es[k].(string); ok && lu != "" {
				return lu
			}
		}
	}
	// 2. Top-level logoUrl / logo_url (form theme editor stores it here)
	for _, k := range []string{"logoUrl", "logo_url"} {
		if lu, ok := settings[k].(string); ok && lu != "" {
			return lu
		}
	}
	// 3. portal_theme fallback
	if pt, ok := settings["portal_theme"].(map[string]interface{}); ok {
		for _, k := range []string{"logo_url", "logoUrl"} {
			if lu, ok := pt[k].(string); ok && lu != "" {
				return lu
			}
		}
	}
	return ""
}

// buildRecommendationEmailHTML generates a clean, white Vercel-style email for recommendation requests
func buildRecommendationEmailHTML(recommenderName, mainText, formTitle, logoURL, link, deadline string, isReminder bool) string {
	heading := "Recommendation Request"
	ctaText := "Submit Recommendation →"
	if isReminder {
		heading = "Reminder: Recommendation Request"
	}
	logoHTML := ""
	if logoURL != "" {
		logoHTML = fmt.Sprintf(`<img src="%s" alt="" style="max-height:40px;max-width:160px;object-fit:contain;display:block;margin:0 0 20px 0;" />`, logoURL)
	}
	return fmt.Sprintf(`<!DOCTYPE html><html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>%s</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;-webkit-font-smoothing:antialiased;">
<table width="100%%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fafafa;padding:40px 16px;">
  <tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%%">
    <tr>
      <td style="background:#ffffff;border-radius:8px;border:1px solid #e5e5e5;overflow:hidden;">
        <table width="100%%" cellpadding="0" cellspacing="0" role="presentation">
          <tr><td height="3" style="background:#09090b;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
        <table width="100%%" cellpadding="0" cellspacing="0" role="presentation" style="padding:36px 40px 32px;">
          <tr><td>
            %s
            <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#a3a3a3;">%s</p>
            <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;line-height:1.25;color:#09090b;">%s</h1>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#3f3f46;">Dear <strong>%s</strong>,</p>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#52525b;">%s</p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;">
              <tr>
                <td style="border-radius:6px;background:#09090b;">
                  <a href="%s" style="display:inline-block;padding:11px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:.01em;">%s</a>
                </td>
              </tr>
            </table>
            <table width="100%%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e5e5e5;border-radius:6px;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:.08em;">Deadline</p>
                  <p style="margin:0;font-size:14px;font-weight:500;color:#09090b;">%s</p>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.6;">Or copy this link:<br><a href="%s" style="color:#737373;word-break:break-all;">%s</a></p>
          </td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 0 0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#a3a3a3;">Thank you for supporting this application. Reply to this email with any questions.</p>
      </td>
    </tr>
  </table>
  </td></tr>
</table>
</body>
</html>`,
		heading,
		logoHTML,
		formTitle,
		heading,
		recommenderName,
		mainText,
		link,
		ctaText,
		deadline,
		link,
		link,
	)
}

// isLegacyRecommendationReminderHTML detects older orange reminder templates so we can upgrade
// them to the current white email shell automatically.
func isLegacyRecommendationReminderHTML(body string) bool {
	bodyLower := strings.ToLower(body)
	hasReminderHeading := strings.Contains(bodyLower, "reminder: recommendation request")
	hasLegacyOrange := strings.Contains(bodyLower, "#f59e0b") || strings.Contains(bodyLower, "#f59e0")
	hasSubmitCTA := strings.Contains(bodyLower, "submit recommendation")

	return hasReminderHeading && (hasLegacyOrange || hasSubmitCTA)
}

func normalizeMergeTagName(name string) string {
	name = strings.TrimSpace(strings.ToLower(name))
	name = strings.ReplaceAll(name, "_", "")
	name = strings.ReplaceAll(name, "-", "")
	name = strings.ReplaceAll(name, " ", "")
	return name
}

func stringifyMergeTagValue(value interface{}) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(v)
	case float64:
		return fmt.Sprintf("%.0f", v)
	case bool:
		if v {
			return "Yes"
		}
		return "No"
	case []interface{}:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			itemValue := stringifyMergeTagValue(item)
			if itemValue != "" {
				parts = append(parts, itemValue)
			}
		}
		return strings.Join(parts, ", ")
	case map[string]interface{}:
		for _, key := range []string{"label", "name", "title", "text", "display", "display_value"} {
			if raw, ok := v[key]; ok {
				if s := stringifyMergeTagValue(raw); s != "" {
					return s
				}
			}
		}
		if raw, ok := v["value"]; ok {
			if s := stringifyMergeTagValue(raw); s != "" {
				return s
			}
		}
		encoded, err := json.Marshal(v)
		if err == nil {
			return string(encoded)
		}
	}

	return fmt.Sprintf("%v", value)
}

func normalizeMergeFieldID(fieldID string) string {
	fieldID = strings.TrimSpace(fieldID)
	for {
		trimmed := strings.TrimPrefix(fieldID, "{")
		trimmed = strings.TrimSuffix(trimmed, "}")
		trimmed = strings.TrimSpace(trimmed)
		if trimmed == fieldID {
			break
		}
		fieldID = trimmed
	}
	return fieldID
}

func recommendationFormIDCandidates(formID uuid.UUID) []uuid.UUID {
	seen := map[uuid.UUID]struct{}{}
	ids := make([]uuid.UUID, 0, 3)

	addID := func(id uuid.UUID) {
		if id == uuid.Nil {
			return
		}
		if _, ok := seen[id]; ok {
			return
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}

	addID(formID)

	var byID models.Form
	if err := database.DB.Select("id", "legacy_table_id").Where("id = ?", formID).First(&byID).Error; err == nil {
		addID(byID.ID)
		if byID.LegacyTableID != nil {
			addID(*byID.LegacyTableID)
		}
	}

	var byLegacy models.Form
	if err := database.DB.Select("id", "legacy_table_id").Where("legacy_table_id = ?", formID).First(&byLegacy).Error; err == nil {
		addID(byLegacy.ID)
		if byLegacy.LegacyTableID != nil {
			addID(*byLegacy.LegacyTableID)
		}
	}

	return ids
}

func resolveSubmissionFieldValue(formID uuid.UUID, fieldID string, submissionData map[string]interface{}) (string, bool) {
	trimmedID := normalizeMergeFieldID(fieldID)
	if trimmedID == "" {
		return "", false
	}

	if val, ok := submissionData[trimmedID]; ok {
		if rendered := stringifyMergeTagValue(val); rendered != "" {
			return rendered, true
		}
	}

	normalizedWanted := normalizeMergeTagName(trimmedID)
	for key, val := range submissionData {
		if normalizeMergeTagName(key) == normalizedWanted {
			if rendered := stringifyMergeTagValue(val); rendered != "" {
				return rendered, true
			}
		}
	}

	fieldUUID, err := uuid.Parse(trimmedID)
	if err != nil {
		return "", false
	}

	// raw_data may be keyed by v2 form_fields.id while templates can reference legacy fields.id (and vice-versa).
	for _, candidateFormID := range recommendationFormIDCandidates(formID) {
		var formField models.FormField
		if err := database.DB.Select("id", "legacy_field_id").Where("form_id = ? AND id = ?", candidateFormID, fieldUUID).First(&formField).Error; err == nil {
			if formField.LegacyFieldID != nil {
				if val, ok := submissionData[formField.LegacyFieldID.String()]; ok {
					if rendered := stringifyMergeTagValue(val); rendered != "" {
						return rendered, true
					}
				}
			}
		}

		if err := database.DB.Select("id", "legacy_field_id").Where("form_id = ? AND legacy_field_id = ?", candidateFormID, fieldUUID).First(&formField).Error; err == nil {
			if val, ok := submissionData[formField.ID.String()]; ok {
				if rendered := stringifyMergeTagValue(val); rendered != "" {
					return rendered, true
				}
			}
		}
	}

	return "", false
}

func applyRecommendationMergeTags(content string, mergeData map[string]string, submissionData map[string]interface{}, formID uuid.UUID) string {
	if content == "" {
		return content
	}

	for key, value := range mergeData {
		content = strings.ReplaceAll(content, fmt.Sprintf("{{%s}}", key), value)
		content = strings.ReplaceAll(content, fmt.Sprintf("{{{%s}}}", key), value)
	}

	mergeTagRegex := regexp.MustCompile(`\{\{\{?\s*([^{}]+?)\s*\}\}\}?`)
	return mergeTagRegex.ReplaceAllStringFunc(content, func(match string) string {
		parts := mergeTagRegex.FindStringSubmatch(match)
		if len(parts) < 2 {
			return match
		}

		tagKey := strings.TrimSpace(parts[1])
		cleanTagKey := normalizeMergeFieldID(tagKey)
		if tagKey == "" {
			return match
		}
		if cleanTagKey == "" {
			return match
		}

		if value, ok := mergeData[tagKey]; ok {
			return value
		}
		if value, ok := mergeData[cleanTagKey]; ok {
			return value
		}

		normalizedTagKey := normalizeMergeTagName(cleanTagKey)
		for key, value := range mergeData {
			if normalizeMergeTagName(key) == normalizedTagKey {
				return value
			}
		}

		if value, ok := resolveSubmissionFieldValue(formID, cleanTagKey, submissionData); ok {
			return value
		}

		return match
	})
}

func findFirstMatchingSubmissionValue(submissionData map[string]interface{}, keys []string) string {
	for _, key := range keys {
		if value, ok := resolveSubmissionFieldValue(uuid.Nil, key, submissionData); ok {
			if strings.TrimSpace(value) != "" {
				return strings.TrimSpace(value)
			}
		}
		if raw, ok := submissionData[key]; ok {
			if value := strings.TrimSpace(stringifyMergeTagValue(raw)); value != "" {
				return value
			}
		}
	}

	for rawKey, rawValue := range submissionData {
		normalizedKey := normalizeMergeTagName(rawKey)
		for _, key := range keys {
			if normalizedKey == normalizeMergeTagName(key) {
				if value := strings.TrimSpace(stringifyMergeTagValue(rawValue)); value != "" {
					return value
				}
			}
		}
	}

	return ""
}

func resolveApplicantFromSubmissionData(formID uuid.UUID, config *models.RecommendationFieldConfig, submissionData map[string]interface{}) (string, string) {
	if len(submissionData) == 0 {
		return "", ""
	}

	applicantName := ""
	applicantEmail := ""

	if config != nil {
		if config.MergeTagFields.ApplicantName != "" {
			if value, ok := resolveSubmissionFieldValue(formID, config.MergeTagFields.ApplicantName, submissionData); ok {
				applicantName = strings.TrimSpace(value)
			}
		}
		if config.MergeTagFields.ApplicantEmail != "" {
			if value, ok := resolveSubmissionFieldValue(formID, config.MergeTagFields.ApplicantEmail, submissionData); ok {
				applicantEmail = strings.TrimSpace(value)
			}
		}
	}

	if applicantName == "" {
		applicantName = findFirstMatchingSubmissionValue(submissionData, []string{
			"_applicant_name", "applicant_name", "applicantName", "full_name", "fullName", "name", "first_name", "firstName",
		})
	}
	if applicantEmail == "" {
		applicantEmail = findFirstMatchingSubmissionValue(submissionData, []string{
			"_applicant_email", "applicant_email", "applicantEmail", "email", "email_address", "emailAddress", "personalEmail",
		})
	}

	return applicantName, applicantEmail
}

func loadRecommendationSubmissionData(submissionID uuid.UUID) map[string]interface{} {
	data := map[string]interface{}{}

	var submission models.FormSubmission
	if err := database.DB.Select("raw_data").Where("id = ?", submissionID).First(&submission).Error; err == nil {
		if len(submission.RawData) > 0 {
			if err := json.Unmarshal(submission.RawData, &data); err == nil && len(data) > 0 {
				return data
			}
		}
	}

	var legacySubmission models.Row
	if err := database.DB.Select("data").Where("id = ?", submissionID).First(&legacySubmission).Error; err == nil {
		if len(legacySubmission.Data) > 0 {
			_ = json.Unmarshal(legacySubmission.Data, &data)
		}
	}

	return data
}

func resolveApplicantInfo(submissionID uuid.UUID) (string, string, error) {
	applicantName := ""
	applicantEmail := ""

	var formSubmission models.FormSubmission
	if err := database.DB.Select("user_id").Where("id = ?", submissionID).First(&formSubmission).Error; err != nil {
		return applicantName, applicantEmail, fmt.Errorf("failed to find form_submission %s: %w", submissionID.String(), err)
	}

	betterAuthUserID := strings.TrimSpace(formSubmission.UserID)
	if betterAuthUserID == "" {
		return applicantName, applicantEmail, fmt.Errorf("form_submission %s has empty user_id", submissionID.String())
	}

	var user models.BetterAuthUser
	if err := database.DB.Where("id = ?", betterAuthUserID).First(&user).Error; err != nil {
		return applicantName, applicantEmail, fmt.Errorf("failed to find ba_user %s: %w", betterAuthUserID, err)
	}

	if user.FullName != nil && strings.TrimSpace(*user.FullName) != "" {
		applicantName = strings.TrimSpace(*user.FullName)
	} else if strings.TrimSpace(user.Name) != "" {
		applicantName = strings.TrimSpace(user.Name)
	}

	if strings.TrimSpace(user.Email) != "" {
		applicantEmail = strings.TrimSpace(user.Email)
	}

	if applicantName == "" {
		return applicantName, applicantEmail, fmt.Errorf("ba_user %s has empty name", betterAuthUserID)
	}
	if applicantEmail == "" {
		return applicantName, applicantEmail, fmt.Errorf("ba_user %s has empty email", betterAuthUserID)
	}

	return applicantName, applicantEmail, nil
}

func isWeakRecommendationFolderName(name string) bool {
	trimmed := strings.TrimSpace(strings.ToLower(name))
	if trimmed == "" {
		return true
	}

	// Names like "-" or "___" happen when template placeholders are unresolved.
	hasLetterOrNumber := false
	for _, ch := range trimmed {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') {
			hasLetterOrNumber = true
			break
		}
	}

	if !hasLetterOrNumber {
		return true
	}

	return trimmed == "unnamed" || trimmed == "submission"
}

func syncRecommendationDocumentToGoogleDrive(request *models.RecommendationRequest, documentURL, originalFileName, fieldLabel string, allowExistingCheck bool) (map[string]interface{}, error) {
	if strings.TrimSpace(documentURL) == "" {
		return nil, fmt.Errorf("document URL is required")
	}

	formIntegration, err := lookupGoogleDriveFormIntegration(request.FormID)
	if err != nil {
		return nil, fmt.Errorf("google drive integration not enabled for this form")
	}

	formName := resolveDriveFormName(formIntegration.FormID)
	if strings.TrimSpace(formName) == "" {
		formName = resolveDriveFormName(request.FormID)
	}
	if strings.TrimSpace(formName) == "" {
		formName = fmt.Sprintf("Form %s", formIntegration.FormID.String()[:8])
	}

	ctx := context.Background()
	srv, err := getGoogleDriveClient(ctx, &formIntegration.WorkspaceIntegration)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to google drive: %w", err)
	}

	formFolderID := strings.TrimSpace(formIntegration.ExternalFolderID)
	formFolderURL := strings.TrimSpace(formIntegration.ExternalFolderURL)
	var driveConfig models.GoogleDriveConfig
	if len(formIntegration.WorkspaceIntegration.Config) > 0 {
		_ = json.Unmarshal(formIntegration.WorkspaceIntegration.Config, &driveConfig)
	}
	parentFolderID := strings.TrimSpace(driveConfig.RootFolderID)
	desiredFormFolderName := services.SanitizeFolderName(strings.TrimSpace(formName))
	if desiredFormFolderName == "" || strings.EqualFold(desiredFormFolderName, "unnamed") {
		desiredFormFolderName = fmt.Sprintf("Form %s", formIntegration.FormID.String()[:8])
	}

	needsFolderRebind := formFolderID == ""
	if formFolderID != "" {
		if existingFolder, folderErr := googleDriveService.GetFolder(ctx, srv, formFolderID); folderErr != nil {
			needsFolderRebind = true
		} else if !strings.EqualFold(strings.TrimSpace(existingFolder.Name), desiredFormFolderName) {
			needsFolderRebind = true
		}
	}

	if needsFolderRebind {
		formFolder, err := googleDriveService.FindOrCreateFolder(ctx, srv, desiredFormFolderName, parentFolderID)
		if err != nil {
			return nil, fmt.Errorf("failed to create form folder: %w", err)
		}
		_ = googleDriveService.SetPermission(ctx, srv, formFolder.ID, "anyone", "reader", "")

		formFolderID = formFolder.ID
		formFolderURL = formFolder.URL

		if saveErr := database.DB.Model(&models.FormIntegrationSetting{}).
			Where("id = ?", formIntegration.ID).
			Updates(map[string]interface{}{
				"external_folder_id":  formFolderID,
				"external_folder_url": formFolderURL,
			}).Error; saveErr != nil {
			fmt.Printf("[Recommendations] Warning: failed to persist form folder for form %s: %v\n", request.FormID.String(), saveErr)
		}
	}

	var submission models.FormSubmission
	if err := database.DB.Select("raw_data").Where("id = ?", request.SubmissionID).First(&submission).Error; err != nil {
		return nil, fmt.Errorf("failed to load submission data: %w", err)
	}

	rowData := map[string]interface{}{}
	if len(submission.RawData) > 0 {
		if err := json.Unmarshal(submission.RawData, &rowData); err != nil {
			rowData = map[string]interface{}{}
		}
	}

	var formSettings models.FormDriveSettings
	if len(formIntegration.Settings) > 0 {
		_ = json.Unmarshal(formIntegration.Settings, &formSettings)
	}

	applicantName, applicantEmail := resolveApplicantFromSubmissionData(formIntegration.FormID, nil, rowData)
	if resolvedName, resolvedEmail, infoErr := resolveApplicantInfo(request.SubmissionID); infoErr == nil {
		if strings.TrimSpace(applicantName) == "" {
			applicantName = strings.TrimSpace(resolvedName)
		}
		if strings.TrimSpace(applicantEmail) == "" {
			applicantEmail = strings.TrimSpace(resolvedEmail)
		}
	}

	if strings.TrimSpace(applicantName) != "" {
		if _, ok := rowData["name"]; !ok {
			rowData["name"] = applicantName
		}
		if _, ok := rowData["full_name"]; !ok {
			rowData["full_name"] = applicantName
		}
	}
	if strings.TrimSpace(applicantEmail) != "" {
		if _, ok := rowData["email"]; !ok {
			rowData["email"] = applicantEmail
		}
	}

	folderName := services.GenerateApplicantFolderName(formSettings.ApplicantFolderTemplate, rowData)
	if isWeakRecommendationFolderName(folderName) {
		switch {
		case strings.TrimSpace(applicantName) != "" && strings.TrimSpace(applicantEmail) != "":
			folderName = services.SanitizeFolderName(fmt.Sprintf("%s - %s", applicantName, applicantEmail))
		case strings.TrimSpace(applicantName) != "":
			folderName = services.SanitizeFolderName(applicantName)
		case strings.TrimSpace(applicantEmail) != "":
			folderName = services.SanitizeFolderName(applicantEmail)
		default:
			folderName = services.SanitizeFolderName(fmt.Sprintf("Submission %s", request.SubmissionID.String()[:8]))
		}
	}

	folder, err := googleDriveService.FindOrCreateFolder(ctx, srv, folderName, formFolderID)
	if err != nil {
		return nil, fmt.Errorf("failed to find/create submission folder: %w", err)
	}
	_ = googleDriveService.SetPermission(ctx, srv, folder.ID, "anyone", "reader", "")

	fileName := originalFileName
	if strings.TrimSpace(formSettings.FileNameTemplate) != "" {
		fileName = services.RenderFileNameTemplate(formSettings.FileNameTemplate, rowData, originalFileName)
	}
	fileName = buildDriveUploadFileName(fieldLabel, fileName)
	fileName = strings.TrimSpace(fileName)
	if fileName == "" {
		fileName = buildDriveUploadFileName(fieldLabel, strings.TrimSpace(originalFileName))
	}
	if fileName == "" {
		fileName = fmt.Sprintf("document-%s", request.SubmissionID.String()[:8])
	}

	if allowExistingCheck {
		if existingFiles, listErr := googleDriveService.ListFilesInFolder(ctx, srv, folder.ID); listErr == nil {
			for _, existingFile := range existingFiles {
				if strings.EqualFold(strings.TrimSpace(existingFile.Name), fileName) {
					return map[string]interface{}{
						"parent_folder_id":   formFolderID,
						"parent_folder_url":  formFolderURL,
						"parent_folder_name": formName,
						"folder_id":          folder.ID,
						"folder_url":         folder.URL,
						"folder_name":        folder.Name,
						"file_id":            existingFile.ID,
						"file_url":           existingFile.URL,
						"file_name":          existingFile.Name,
						"existing":           true,
					}, nil
				}
			}
		}
	}

	driveFile, err := googleDriveService.UploadFileFromURL(ctx, srv, fileName, documentURL, folder.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to upload file to google drive: %w", err)
	}
	_ = googleDriveService.SetPermission(ctx, srv, driveFile.ID, "anyone", "reader", "")

	return map[string]interface{}{
		"parent_folder_id":   formFolderID,
		"parent_folder_url":  formFolderURL,
		"parent_folder_name": formName,
		"folder_id":          folder.ID,
		"folder_url":         folder.URL,
		"folder_name":        folder.Name,
		"file_id":            driveFile.ID,
		"file_url":           driveFile.URL,
		"file_name":          driveFile.Name,
	}, nil
}

func lookupGoogleDriveFormIntegration(formID uuid.UUID) (models.FormIntegrationSetting, error) {
	candidateFormIDs := candidateFormIDsForDriveIntegration(formID)

	for _, candidateID := range candidateFormIDs {
		var formIntegration models.FormIntegrationSetting
		err := database.DB.Preload("WorkspaceIntegration").
			Joins("JOIN workspace_integrations ON workspace_integrations.id = form_integration_settings.workspace_integration_id").
			Where("form_integration_settings.form_id = ? AND form_integration_settings.is_enabled = ? AND workspace_integrations.integration_type = ? AND workspace_integrations.is_connected = ?", candidateID, true, "google_drive", true).
			First(&formIntegration).Error
		if err == nil {
			return formIntegration, nil
		}
	}

	return models.FormIntegrationSetting{}, gorm.ErrRecordNotFound
}

func candidateFormIDsForDriveIntegration(formID uuid.UUID) []uuid.UUID {
	ids := make([]uuid.UUID, 0, 4)
	addUnique := func(id uuid.UUID) {
		if id == uuid.Nil {
			return
		}
		for _, existing := range ids {
			if existing == id {
				return
			}
		}
		ids = append(ids, id)
	}

	addUnique(formID)

	// If this is a v2 form, include its legacy table id (common location of integrations).
	var v2Form models.Form
	if err := database.DB.Select("id", "legacy_table_id").Where("id = ?", formID).First(&v2Form).Error; err == nil {
		if v2Form.LegacyTableID != nil {
			addUnique(*v2Form.LegacyTableID)
		}
	}

	// If this is a legacy table id, include mapped v2 forms.
	var mappedForms []models.Form
	if err := database.DB.Select("id").Where("legacy_table_id = ?", formID).Find(&mappedForms).Error; err == nil {
		for i := range mappedForms {
			addUnique(mappedForms[i].ID)
		}
	}

	return ids
}

func resolveDriveFormName(formID uuid.UUID) string {
	if formID == uuid.Nil {
		return ""
	}

	var table models.Table
	if err := database.DB.Select("id", "name").Where("id = ?", formID).First(&table).Error; err == nil {
		if strings.TrimSpace(table.Name) != "" {
			return table.Name
		}
	}

	var v2Form models.Form
	if err := database.DB.Select("id", "name").Where("id = ?", formID).First(&v2Form).Error; err == nil {
		if strings.TrimSpace(v2Form.Name) != "" {
			return v2Form.Name
		}
	}

	return ""
}

type recommendationUploadedDocument struct {
	URL      string
	Filename string
}

type backfillDocumentCandidate struct {
	RequestID  string
	Source     string
	URL        string
	Filename   string
	FieldLabel string
}

func extractRecommendationUploadedDocuments(response datatypes.JSON) []recommendationUploadedDocument {
	if len(response) == 0 {
		return nil
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(response, &payload); err != nil {
		return nil
	}

	documents := make([]recommendationUploadedDocument, 0)

	if doc, ok := payload["uploaded_document"].(map[string]interface{}); ok {
		if url, ok := doc["url"].(string); ok && strings.TrimSpace(url) != "" {
			filename, _ := doc["filename"].(string)
			documents = append(documents, recommendationUploadedDocument{URL: url, Filename: filename})
		}
	}

	if rawDocs, ok := payload["uploaded_documents"].([]interface{}); ok {
		for _, raw := range rawDocs {
			doc, ok := raw.(map[string]interface{})
			if !ok {
				continue
			}
			url, _ := doc["url"].(string)
			if strings.TrimSpace(url) == "" {
				continue
			}
			filename, _ := doc["filename"].(string)
			documents = append(documents, recommendationUploadedDocument{URL: url, Filename: filename})
		}
	}

	return documents
}

func collectRawDataDocumentCandidates(value interface{}, sourceKey string, out *[]backfillDocumentCandidate) {
	isUploadField := func(key string) bool {
		lowerKey := strings.ToLower(key)
		uploadKeywords := []string{"upload", "document", "attachment", "resume", "cv", "file", "portfolio", "transcript", "letter", "recommendation"}
		for _, kw := range uploadKeywords {
			if strings.Contains(lowerKey, kw) {
				return true
			}
		}
		return false
	}

	switch v := value.(type) {
	case map[string]interface{}:
		pathJoin := func(parent, key string) string {
			key = strings.TrimSpace(key)
			if parent == "" {
				return key
			}
			if key == "" {
				return parent
			}
			return parent + "." + key
		}

		// Try to extract URL + filename from object
		for _, key := range []string{"url", "public_url", "file_url", "download_url", "link", "href"} {
			rawURL, ok := v[key]
			if !ok {
				continue
			}
			url, ok := rawURL.(string)
			if !ok || strings.TrimSpace(url) == "" {
				continue
			}

			filename := ""
			for _, nameKey := range []string{"filename", "file_name", "original_filename", "name", "title"} {
				if rawName, exists := v[nameKey]; exists {
					if s, ok := rawName.(string); ok && strings.TrimSpace(s) != "" {
						filename = strings.TrimSpace(s)
						break
					}
				}
			}

			fieldLabel := strings.TrimSpace(sourceKey)
			for _, labelKey := range []string{"field_label", "fieldLabel", "label", "question", "field", "field_name", "fieldName"} {
				if rawLabel, exists := v[labelKey]; exists {
					if s, ok := rawLabel.(string); ok && strings.TrimSpace(s) != "" {
						fieldLabel = strings.TrimSpace(s)
						break
					}
				}
			}

			*out = append(*out, backfillDocumentCandidate{
				Source:     sourceKey,
				URL:        strings.TrimSpace(url),
				Filename:   filename,
				FieldLabel: fieldLabel,
			})
			break
		}

		// Recurse into nested objects
		for key, nested := range v {
			childSource := pathJoin(sourceKey, key)
			collectRawDataDocumentCandidates(nested, childSource, out)
		}
	case []interface{}:
		// Handle arrays - especially file arrays from upload fields
		for idx, item := range v {
			itemSource := sourceKey
			if isUploadField(sourceKey) {
				itemSource = fmt.Sprintf("%s[%d]", sourceKey, idx)
			}
			collectRawDataDocumentCandidates(item, itemSource, out)
		}
	case string:
		s := strings.TrimSpace(v)
		if strings.HasPrefix(strings.ToLower(s), "http://") || strings.HasPrefix(strings.ToLower(s), "https://") {
			// Check if this string URL is in an upload field context
			if isUploadField(sourceKey) {
				*out = append(*out, backfillDocumentCandidate{
					Source:     sourceKey,
					URL:        s,
					Filename:   "",
					FieldLabel: sourceKey,
				})
			}
		}
	}
}

func resolveFieldLabelsForSyncForm(formID uuid.UUID) map[uuid.UUID]string {
	labels := map[uuid.UUID]string{}

	addLegacyTableFieldLabels := func(tableID uuid.UUID) {
		if tableID == uuid.Nil {
			return
		}
		var fields []models.Field
		if err := database.DB.Select("id", "label").Where("table_id = ?", tableID).Find(&fields).Error; err != nil {
			return
		}
		for i := range fields {
			if strings.TrimSpace(fields[i].Label) != "" {
				labels[fields[i].ID] = strings.TrimSpace(fields[i].Label)
			}
		}
	}

	addV2FormFieldLabels := func(v2FormID uuid.UUID) {
		if v2FormID == uuid.Nil {
			return
		}
		var fields []models.FormField
		if err := database.DB.Select("id", "label", "legacy_field_id").Where("form_id = ?", v2FormID).Find(&fields).Error; err != nil {
			return
		}
		for i := range fields {
			label := strings.TrimSpace(fields[i].Label)
			if label == "" {
				continue
			}
			labels[fields[i].ID] = label
			if fields[i].LegacyFieldID != nil && *fields[i].LegacyFieldID != uuid.Nil {
				labels[*fields[i].LegacyFieldID] = label
			}
		}
	}

	addLegacyTableFieldLabels(formID)
	addV2FormFieldLabels(formID)

	var mappedForms []models.Form
	if err := database.DB.Select("id", "legacy_table_id").Where("id = ? OR legacy_table_id = ?", formID, formID).Find(&mappedForms).Error; err == nil {
		for i := range mappedForms {
			addV2FormFieldLabels(mappedForms[i].ID)
			if mappedForms[i].LegacyTableID != nil {
				addLegacyTableFieldLabels(*mappedForms[i].LegacyTableID)
			}
		}
	}

	return labels
}

func fieldLabelFromRawSource(source string, labels map[uuid.UUID]string) string {
	source = strings.TrimSpace(source)
	if source == "" {
		return ""
	}

	parts := strings.FieldsFunc(source, func(r rune) bool {
		switch r {
		case '.', '[', ']', '/':
			return true
		default:
			return false
		}
	})

	for _, part := range parts {
		id, err := uuid.Parse(strings.TrimSpace(part))
		if err != nil {
			continue
		}
		if label, ok := labels[id]; ok {
			return label
		}
	}

	ignore := map[string]struct{}{
		"":    {},
		"url": {}, "public_url": {}, "file_url": {}, "download_url": {}, "link": {}, "href": {},
		"filename": {}, "file_name": {}, "original_filename": {}, "name": {}, "title": {},
		"uploaded_document": {}, "uploaded_documents": {},
		"submission": {}, "raw": {}, "data": {}, "submission_raw_data": {},
	}

	for i := len(parts) - 1; i >= 0; i-- {
		p := strings.TrimSpace(parts[i])
		if _, skip := ignore[strings.ToLower(p)]; skip {
			continue
		}
		if _, err := uuid.Parse(p); err == nil {
			continue
		}
		if _, err := fmt.Sscanf(p, "%d", new(int)); err == nil {
			continue
		}
		return p
	}

	return source
}

func extractSubmissionRawDataDocuments(rawData datatypes.JSON) []backfillDocumentCandidate {
	if len(rawData) == 0 {
		return nil
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(rawData, &payload); err != nil {
		return nil
	}

	results := make([]backfillDocumentCandidate, 0)
	collectRawDataDocumentCandidates(payload, "", &results)

	// Deduplicate by URL + filename while preserving order.
	seen := make(map[string]struct{}, len(results))
	deduped := make([]backfillDocumentCandidate, 0, len(results))
	for _, item := range results {
		key := strings.TrimSpace(strings.ToLower(item.URL)) + "|" + strings.TrimSpace(strings.ToLower(item.Filename))
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		deduped = append(deduped, item)
	}

	return deduped
}

type recommendationDriveSyncResult struct {
	RequestID  string                 `json:"request_id"`
	Source     string                 `json:"source,omitempty"`
	FieldLabel string                 `json:"field_label,omitempty"`
	Filename   string                 `json:"filename,omitempty"`
	URL        string                 `json:"url,omitempty"`
	Existing   bool                   `json:"existing,omitempty"`
	DriveMeta  map[string]interface{} `json:"drive,omitempty"`
	Error      string                 `json:"error,omitempty"`
}

type recommendationSubmissionBackfillSummary struct {
	SubmissionID      uuid.UUID                       `json:"submission_id"`
	RequestsChecked   int                             `json:"requests_checked"`
	SubmissionFiles   int                             `json:"submission_files"`
	DocumentsFound    int                             `json:"documents_found"`
	DocumentsSynced   int                             `json:"documents_synced"`
	DocumentsExisting int                             `json:"documents_existing"`
	DocumentsFailed   int                             `json:"documents_failed"`
	SyncResults       []recommendationDriveSyncResult `json:"sync_results"`
}

func backfillRecommendationDocumentsForSubmission(submissionID uuid.UUID, fallbackFormID *uuid.UUID) (*recommendationSubmissionBackfillSummary, error) {
	var submission models.FormSubmission
	hasFormSubmission := false
	if err := database.DB.Select("id", "form_id", "legacy_row_id", "raw_data").Where("id = ?", submissionID).First(&submission).Error; err == nil {
		hasFormSubmission = true
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to load submission")
	}

	formID := uuid.Nil
	if hasFormSubmission {
		formID = submission.FormID
	}
	if formID == uuid.Nil {
		var req models.RecommendationRequest
		if err := database.DB.Select("form_id").Where("submission_id = ?", submissionID).Order("created_at ASC").First(&req).Error; err == nil {
			formID = req.FormID
		}
	}
	if formID == uuid.Nil && fallbackFormID != nil && *fallbackFormID != uuid.Nil {
		formID = *fallbackFormID
	}
	if formID == uuid.Nil {
		var row models.Row
		if err := database.DB.Select("table_id").Where("id = ?", submissionID).First(&row).Error; err == nil {
			formID = row.TableID
		}
	}
	if formID == uuid.Nil {
		return nil, fmt.Errorf("submission not found")
	}

	syncRequest := models.RecommendationRequest{
		SubmissionID: submissionID,
		FormID:       formID,
	}

	var requests []models.RecommendationRequest
	if err := database.DB.Where("submission_id = ? AND status = ?", submissionID, "submitted").Find(&requests).Error; err != nil {
		return nil, fmt.Errorf("failed to load recommendation requests")
	}

	rowIDSet := map[uuid.UUID]struct{}{}
	rowIDSet[submissionID] = struct{}{}
	if hasFormSubmission && submission.LegacyRowID != nil && *submission.LegacyRowID != uuid.Nil {
		rowIDSet[*submission.LegacyRowID] = struct{}{}
	}
	if !hasFormSubmission {
		var linked []models.FormSubmission
		if err := database.DB.Select("id").Where("legacy_row_id = ?", submissionID).Find(&linked).Error; err == nil {
			for i := range linked {
				if linked[i].ID != uuid.Nil {
					rowIDSet[linked[i].ID] = struct{}{}
				}
			}
		}
	}

	rowIDs := make([]uuid.UUID, 0, len(rowIDSet))
	for id := range rowIDSet {
		rowIDs = append(rowIDs, id)
	}

	var rowFiles []models.TableFile
	if err := database.DB.Where("row_id IN ? AND deleted_at IS NULL", rowIDs).Find(&rowFiles).Error; err != nil {
		return nil, fmt.Errorf("failed to load uploaded files")
	}

	rawDataDocs := make([]backfillDocumentCandidate, 0)
	if hasFormSubmission {
		rawDataDocs = append(rawDataDocs, extractSubmissionRawDataDocuments(submission.RawData)...)
	}
	var legacyRows []models.Row
	if err := database.DB.Select("id", "data").Where("id IN ?", rowIDs).Find(&legacyRows).Error; err == nil {
		for i := range legacyRows {
			rawDataDocs = append(rawDataDocs, extractSubmissionRawDataDocuments(legacyRows[i].Data)...)
		}
	}

	results := make([]recommendationDriveSyncResult, 0)
	totalDocs := 0
	syncedDocs := 0
	existingDocs := 0
	fieldLabels := resolveFieldLabelsForSyncForm(formID)

	for i := range requests {
		documents := extractRecommendationUploadedDocuments(requests[i].Response)
		if len(documents) == 0 {
			continue
		}

		for _, doc := range documents {
			totalDocs++
			filename := strings.TrimSpace(doc.Filename)
			if filename == "" {
				filename = fmt.Sprintf("recommendation-%s", requests[i].ID.String())
			}

			driveMeta, syncErr := syncRecommendationDocumentToGoogleDrive(&requests[i], doc.URL, filename, "Recommendation Letter", true)
			if syncErr != nil {
				results = append(results, recommendationDriveSyncResult{
					RequestID:  requests[i].ID.String(),
					Source:     "recommendation",
					FieldLabel: "Recommendation Letter",
					Filename:   filename,
					URL:        doc.URL,
					Error:      syncErr.Error(),
				})
				continue
			}

			isExisting := false
			if rawExisting, ok := driveMeta["existing"].(bool); ok && rawExisting {
				isExisting = true
				existingDocs++
			} else {
				syncedDocs++
			}

			results = append(results, recommendationDriveSyncResult{
				RequestID:  requests[i].ID.String(),
				Source:     "recommendation",
				FieldLabel: "Recommendation Letter",
				Filename:   filename,
				URL:        doc.URL,
				Existing:   isExisting,
				DriveMeta:  driveMeta,
			})
		}
	}

	for i := range rowFiles {
		fieldLabel := ""
		if rowFiles[i].FieldID != nil {
			fieldLabel = fieldLabels[*rowFiles[i].FieldID]
		}

		filename := strings.TrimSpace(rowFiles[i].OriginalFilename)
		if filename == "" {
			filename = strings.TrimSpace(rowFiles[i].Filename)
		}
		if filename == "" {
			filename = fmt.Sprintf("file-%s", rowFiles[i].ID.String()[:8])
		}
		filename = buildDriveUploadFileName(fieldLabel, filename)

		url := strings.TrimSpace(rowFiles[i].PublicURL)
		if url == "" {
			continue
		}

		totalDocs++
		driveMeta, syncErr := syncRecommendationDocumentToGoogleDrive(&syncRequest, url, filename, fieldLabel, true)
		if syncErr != nil {
			results = append(results, recommendationDriveSyncResult{
				RequestID:  submissionID.String(),
				Source:     "submission_file",
				FieldLabel: fieldLabel,
				Filename:   filename,
				URL:        url,
				Error:      syncErr.Error(),
			})
			continue
		}

		isExisting := false
		if rawExisting, ok := driveMeta["existing"].(bool); ok && rawExisting {
			isExisting = true
			existingDocs++
		} else {
			syncedDocs++
		}

		results = append(results, recommendationDriveSyncResult{
			RequestID:  submissionID.String(),
			Source:     "submission_file",
			FieldLabel: fieldLabel,
			Filename:   filename,
			URL:        url,
			Existing:   isExisting,
			DriveMeta:  driveMeta,
		})
	}

	for i := range rawDataDocs {
		url := strings.TrimSpace(rawDataDocs[i].URL)
		if url == "" {
			continue
		}

		fieldLabel := strings.TrimSpace(rawDataDocs[i].FieldLabel)
		if resolvedLabel := strings.TrimSpace(fieldLabelFromRawSource(rawDataDocs[i].Source, fieldLabels)); resolvedLabel != "" {
			fieldLabel = resolvedLabel
		}

		filename := strings.TrimSpace(rawDataDocs[i].Filename)
		if filename == "" {
			if parsed, parseErr := urlpkg.Parse(url); parseErr == nil {
				if base := strings.TrimSpace(filepath.Base(parsed.Path)); base != "" && base != "." && base != "/" {
					filename = base
				}
			}
		}
		if filename == "" {
			filename = fmt.Sprintf("linked-document-%d", i+1)
		}
		filename = buildDriveUploadFileName(fieldLabel, filename)

		totalDocs++
		driveMeta, syncErr := syncRecommendationDocumentToGoogleDrive(&syncRequest, url, filename, fieldLabel, true)
		if syncErr != nil {
			results = append(results, recommendationDriveSyncResult{
				RequestID:  submissionID.String(),
				Source:     "submission_raw_data",
				FieldLabel: fieldLabel,
				Filename:   filename,
				URL:        url,
				Error:      syncErr.Error(),
			})
			continue
		}

		isExisting := false
		if rawExisting, ok := driveMeta["existing"].(bool); ok && rawExisting {
			isExisting = true
			existingDocs++
		} else {
			syncedDocs++
		}

		results = append(results, recommendationDriveSyncResult{
			RequestID:  submissionID.String(),
			Source:     "submission_raw_data",
			FieldLabel: fieldLabel,
			Filename:   filename,
			URL:        url,
			Existing:   isExisting,
			DriveMeta:  driveMeta,
		})
	}

	summary := &recommendationSubmissionBackfillSummary{
		SubmissionID:      submissionID,
		RequestsChecked:   len(requests),
		SubmissionFiles:   len(rowFiles),
		DocumentsFound:    totalDocs,
		DocumentsSynced:   syncedDocs,
		DocumentsExisting: existingDocs,
		DocumentsFailed:   totalDocs - syncedDocs - existingDocs,
		SyncResults:       results,
	}

	return summary, nil
}

func collectSubmissionIDsForForm(formID uuid.UUID) ([]uuid.UUID, error) {
	seen := map[uuid.UUID]struct{}{}
	add := func(id uuid.UUID) {
		if id == uuid.Nil {
			return
		}
		seen[id] = struct{}{}
	}

	// Recommendation requests already tied to this form/table.
	var recSubmissionIDs []uuid.UUID
	if err := database.DB.Model(&models.RecommendationRequest{}).
		Where("form_id = ?", formID).
		Distinct("submission_id").
		Pluck("submission_id", &recSubmissionIDs).Error; err != nil {
		return nil, fmt.Errorf("failed to load recommendation submissions")
	}
	for _, id := range recSubmissionIDs {
		add(id)
	}

	// Legacy rows under the table/form id.
	var legacyRows []models.Row
	if err := database.DB.Select("id").Where("table_id = ?", formID).Find(&legacyRows).Error; err != nil {
		return nil, fmt.Errorf("failed to load legacy form rows")
	}
	for i := range legacyRows {
		add(legacyRows[i].ID)
	}

	// Files attached directly at table scope can still reference row IDs.
	var tableFiles []models.TableFile
	if err := database.DB.Select("row_id").Where("table_id = ? AND deleted_at IS NULL", formID).Find(&tableFiles).Error; err == nil {
		for i := range tableFiles {
			if tableFiles[i].RowID != nil {
				add(*tableFiles[i].RowID)
			}
		}
	}

	// V2 forms may be linked to this legacy table id.
	formIDs := map[uuid.UUID]struct{}{}
	var mappedForms []models.Form
	if err := database.DB.Select("id", "legacy_table_id").Where("id = ? OR legacy_table_id = ?", formID, formID).Find(&mappedForms).Error; err != nil {
		return nil, fmt.Errorf("failed to load mapped forms")
	}
	for i := range mappedForms {
		formIDs[mappedForms[i].ID] = struct{}{}
	}

	if len(formIDs) > 0 {
		ids := make([]uuid.UUID, 0, len(formIDs))
		for id := range formIDs {
			ids = append(ids, id)
		}

		var submissions []models.FormSubmission
		if err := database.DB.Select("id", "legacy_row_id").Where("form_id IN ?", ids).Find(&submissions).Error; err != nil {
			return nil, fmt.Errorf("failed to load v2 form submissions")
		}
		for i := range submissions {
			add(submissions[i].ID)
			if submissions[i].LegacyRowID != nil {
				add(*submissions[i].LegacyRowID)
			}
		}
	}

	result := make([]uuid.UUID, 0, len(seen))
	for id := range seen {
		result = append(result, id)
	}

	return result, nil
}

// SyncSubmissionRecommendationDocumentsToGoogleDrive syncs all uploaded recommendation docs for a submission.
// POST /api/v1/recommendations/submission/:submissionId/google-drive/sync
func SyncSubmissionRecommendationDocumentsToGoogleDrive(c *gin.Context) {
	submissionID, err := uuid.Parse(c.Param("submissionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid submission ID"})
		return
	}

	summary, syncErr := backfillRecommendationDocumentsForSubmission(submissionID, nil)
	if syncErr != nil {
		status := http.StatusInternalServerError
		if strings.Contains(strings.ToLower(syncErr.Error()), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": syncErr.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// BackfillFormRecommendationDocumentsToGoogleDrive syncs historical recommendation and uploaded docs for all submissions in a form.
// POST /api/v1/recommendations/form/:formId/google-drive/backfill
func BackfillFormRecommendationDocumentsToGoogleDrive(c *gin.Context) {
	formID, err := uuid.Parse(c.Param("formId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
		return
	}

	submissionIDs, err := collectSubmissionIDsForForm(formID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type submissionResult struct {
		SubmissionID      string                          `json:"submission_id"`
		RequestsChecked   int                             `json:"requests_checked"`
		SubmissionFiles   int                             `json:"submission_files"`
		DocumentsFound    int                             `json:"documents_found"`
		DocumentsSynced   int                             `json:"documents_synced"`
		DocumentsExisting int                             `json:"documents_existing"`
		DocumentsFailed   int                             `json:"documents_failed"`
		SyncResults       []recommendationDriveSyncResult `json:"sync_results"`
		Error             string                          `json:"error,omitempty"`
	}

	results := make([]submissionResult, 0, len(submissionIDs))
	totalFound := 0
	totalSynced := 0
	totalExisting := 0
	totalFailed := 0

	for _, submissionID := range submissionIDs {
		summary, syncErr := backfillRecommendationDocumentsForSubmission(submissionID, &formID)
		if syncErr != nil {
			results = append(results, submissionResult{
				SubmissionID: submissionID.String(),
				Error:        syncErr.Error(),
			})
			totalFailed++
			continue
		}

		results = append(results, submissionResult{
			SubmissionID:      summary.SubmissionID.String(),
			RequestsChecked:   summary.RequestsChecked,
			SubmissionFiles:   summary.SubmissionFiles,
			DocumentsFound:    summary.DocumentsFound,
			DocumentsSynced:   summary.DocumentsSynced,
			DocumentsExisting: summary.DocumentsExisting,
			DocumentsFailed:   summary.DocumentsFailed,
			SyncResults:       summary.SyncResults,
		})

		totalFound += summary.DocumentsFound
		totalSynced += summary.DocumentsSynced
		totalExisting += summary.DocumentsExisting
		totalFailed += summary.DocumentsFailed
	}

	c.JSON(http.StatusOK, gin.H{
		"form_id":             formID,
		"submissions_checked": len(submissionIDs),
		"documents_found":     totalFound,
		"documents_synced":    totalSynced,
		"documents_existing":  totalExisting,
		"documents_failed":    totalFailed,
		"results":             results,
	})
}

// GetRecommendationRequests returns all recommendation requests for a submission
func GetRecommendationRequests(c *gin.Context) {
	submissionID := c.Query("submission_id")
	if submissionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "submission_id is required"})
		return
	}

	var requests []models.RecommendationRequest
	if err := database.DB.Where("submission_id = ?", submissionID).
		Order("created_at ASC").
		Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendation requests"})
		return
	}

	// Rewrite localhost URLs in responses
	for i := range requests {
		if len(requests[i].Response) > 0 {
			rewritten, err := rewriteLocalhostURLs(requests[i].Response)
			if err == nil {
				requests[i].Response = rewritten
			}
		}
	}

	c.JSON(http.StatusOK, requests)
}

// GetRecommendationRequest returns a single recommendation request by ID
func GetRecommendationRequest(c *gin.Context) {
	id := c.Param("id")

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found"})
		return
	}

	// Rewrite localhost URLs in response
	if len(request.Response) > 0 {
		rewritten, err := rewriteLocalhostURLs(request.Response)
		if err == nil {
			request.Response = rewritten
		}
	}

	c.JSON(http.StatusOK, request)
}

// UpdateRecommendationRequest updates recommender details for a pending recommendation request
func UpdateRecommendationRequest(c *gin.Context) {
	id := c.Param("id")

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found"})
		return
	}

	if request.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only pending recommendation requests can be edited"})
		return
	}

	var input struct {
		RecommenderName         *string `json:"recommender_name"`
		RecommenderEmail        *string `json:"recommender_email"`
		RecommenderRelationship *string `json:"recommender_relationship"`
		RecommenderOrganization *string `json:"recommender_organization"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.RecommenderName == nil && input.RecommenderEmail == nil && input.RecommenderRelationship == nil && input.RecommenderOrganization == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields provided for update"})
		return
	}

	if input.RecommenderName != nil {
		request.RecommenderName = strings.TrimSpace(*input.RecommenderName)
	}

	if input.RecommenderEmail != nil {
		email := strings.TrimSpace(*input.RecommenderEmail)
		if email == "" || !strings.Contains(email, "@") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "A valid recommender_email is required"})
			return
		}
		request.RecommenderEmail = email
	}

	if input.RecommenderRelationship != nil {
		request.RecommenderRelationship = strings.TrimSpace(*input.RecommenderRelationship)
	}

	if input.RecommenderOrganization != nil {
		request.RecommenderOrganization = strings.TrimSpace(*input.RecommenderOrganization)
	}

	if err := database.DB.Save(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update recommendation request"})
		return
	}

	c.JSON(http.StatusOK, request)
}

// GetRecommendationByToken returns a recommendation request by its token (public endpoint)
func GetRecommendationByToken(c *gin.Context) {
	token := c.Param("token")

	fmt.Printf("[Recommendations] GetByToken called with token: %s\n", token)

	// Special preview token used in test emails
	if token == "sample-token-preview" {
		c.JSON(http.StatusOK, gin.H{
			"request": gin.H{
				"id":               "00000000-0000-0000-0000-000000000000",
				"recommender_name": "Preview Recommender",
				"status":           "pending",
			},
			"applicant_name":       "Sample Applicant",
			"applicant_email":      "applicant@example.com",
			"form_title":           "Sample Application Form",
			"questions":            []interface{}{},
			"show_file_upload":     true,
			"require_relationship": false,
			"logo_url":             "",
		})
		return
	}

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "token = ?", token).Error; err != nil {
		fmt.Printf("[Recommendations] Token not found in database: %s\n", token)
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found or link has expired"})
		return
	}

	fmt.Printf("[Recommendations] Found request ID: %s, Status: %s, SubmissionID: %s\n",
		request.ID.String(), request.Status, request.SubmissionID.String())

	// Get form info
	var form models.Table
	database.DB.First(&form, "id = ?", request.FormID)

	// Get field config for questions and merge tag mappings
	var fieldConfig models.RecommendationFieldConfig
	var field models.Field
	if err := database.DB.Where("table_id = ? AND id = ?", request.FormID, request.FieldID).First(&field).Error; err == nil {
		if field.Config != nil {
			json.Unmarshal(field.Config, &fieldConfig)
		}
	}

	submissionData := loadRecommendationSubmissionData(request.SubmissionID)
	applicantName, applicantEmail, err := resolveApplicantInfo(request.SubmissionID)
	if err != nil {
		fallbackName, fallbackEmail := resolveApplicantFromSubmissionData(form.ID, &fieldConfig, submissionData)
		applicantName = fallbackName
		applicantEmail = fallbackEmail
	}
	if strings.TrimSpace(applicantName) == "" {
		applicantName = "the applicant"
	}

	// Check if expired
	if request.ExpiresAt != nil && time.Now().After(*request.ExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "This recommendation request has expired"})
		return
	}

	// If already submitted, return the full data so the recommender can view their submission
	if request.Status == "submitted" {
		if len(request.Response) > 0 {
			if rewritten, err := rewriteLocalhostURLs(request.Response); err == nil {
				request.Response = rewritten
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"request":           request,
			"applicant_name":    applicantName,
			"applicant_email":   applicantEmail,
			"form_title":        form.Name,
			"questions":         fieldConfig.Questions,
			"instructions":      fieldConfig.Instructions,
			"already_submitted": true,
			"logo_url":          getFormLogoURL(&form),
		})
		return
	}

	// Rewrite localhost URLs in response before returning
	if len(request.Response) > 0 {
		rewritten, err := rewriteLocalhostURLs(request.Response)
		if err == nil {
			request.Response = rewritten
		}
	}

	response := gin.H{
		"request":              request,
		"applicant_name":       applicantName,
		"applicant_email":      applicantEmail,
		"form_title":           form.Name,
		"questions":            fieldConfig.Questions,
		"instructions":         fieldConfig.Instructions,
		"require_relationship": fieldConfig.RequireRelationship,
		"show_file_upload":     fieldConfig.ShowFileUpload,
		"logo_url":             getFormLogoURL(&form),
	}

	c.JSON(http.StatusOK, response)
}

// CreateRecommendationRequest creates a new recommendation request and sends email
func CreateRecommendationRequest(c *gin.Context) {
	var input models.CreateRecommendationRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate submission exists in form_submissions
	var formSubmission models.FormSubmission
	if err := database.DB.First(&formSubmission, "id = ?", input.SubmissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Build a synthetic Row for compatibility with the email function
	submission := models.Row{
		Data: formSubmission.RawData,
	}
	submission.ID = formSubmission.ID

	// Validate form exists
	var form models.Table
	if err := database.DB.First(&form, "id = ?", input.FormID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Get field config
	var fieldConfig models.RecommendationFieldConfig
	var field models.Field
	if err := database.DB.Where("table_id = ? AND id = ?", input.FormID, input.FieldID).First(&field).Error; err == nil {
		if field.Config != nil {
			fmt.Printf("[Recommendations] Raw field.Config: %s\n", string(field.Config))
			if err := json.Unmarshal(field.Config, &fieldConfig); err != nil {
				fmt.Printf("[Recommendations] Failed to unmarshal field config: %v\n", err)
			}
		} else {
			fmt.Printf("[Recommendations] Field config is nil\n")
		}
	} else {
		fmt.Printf("[Recommendations] Could not find field: %v\n", err)
	}

	// Set defaults if not configured
	if fieldConfig.MaxRecommenders == 0 {
		fieldConfig.MaxRecommenders = 3
	}
	if fieldConfig.DeadlineDays == 0 {
		fieldConfig.DeadlineDays = 14
	}

	// Check max recommenders
	var existingCount int64
	database.DB.Model(&models.RecommendationRequest{}).
		Where("submission_id = ? AND field_id = ? AND status != ?", input.SubmissionID, input.FieldID, "cancelled").
		Count(&existingCount)

	if int(existingCount) >= fieldConfig.MaxRecommenders {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Maximum of %d recommenders allowed", fieldConfig.MaxRecommenders)})
		return
	}

	// Check for duplicate email - if exists and pending, send reminder instead
	var existingRequest models.RecommendationRequest
	if err := database.DB.Where("submission_id = ? AND field_id = ? AND recommender_email = ? AND status != ?",
		input.SubmissionID, input.FieldID, input.RecommenderEmail, "cancelled").
		First(&existingRequest).Error; err == nil {
		// Request already exists - send a reminder if still pending
		if existingRequest.Status == "pending" {
			// Check if the request has expired or is about to expire
			// If expired or expiring soon, extend the expiration date
			now := time.Now()
			shouldExtend := false
			var newExpiresAt *time.Time

			if existingRequest.ExpiresAt != nil {
				// If already expired or expiring within 3 days, extend it
				if now.After(*existingRequest.ExpiresAt) || existingRequest.ExpiresAt.Sub(now) < 3*24*time.Hour {
					shouldExtend = true
				}
			} else {
				// If no expiration was set, set one now (30 days from reminder)
				shouldExtend = true
			}

			if shouldExtend {
				// Extend expiration by 30 days from now, or use the field config deadline if available
				deadlineDays := fieldConfig.DeadlineDays
				if deadlineDays == 0 {
					deadlineDays = fieldConfig.DeadlineDaysFE
				}
				if deadlineDays == 0 {
					deadlineDays = 30 // Default to 30 days if no deadline configured
				}
				expiry := now.AddDate(0, 0, deadlineDays)
				newExpiresAt = &expiry
				existingRequest.ExpiresAt = newExpiresAt
				fmt.Printf("[Recommendations] Extended expiration date to %v for reminder\n", newExpiresAt)
			}

			// Send reminder email (no specific sender account for initial creation)
			if err := sendRecommendationReminderEmail(&existingRequest, &submission, &form, &fieldConfig, nil); err != nil {
				fmt.Printf("[Recommendations] Failed to send reminder email: %v\n", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send reminder email"})
				return
			}

			// Update reminder count and timestamp
			existingRequest.ReminderCount++
			existingRequest.RemindedAt = &now
			database.DB.Save(&existingRequest)

			fmt.Printf("[Recommendations] Sent reminder for existing request ID: %s\n", existingRequest.ID.String())
			c.JSON(http.StatusOK, gin.H{
				"message":     "Reminder sent successfully",
				"request":     existingRequest,
				"is_reminder": true,
			})
			return
		}
		// If already submitted, fall through and create a new request
		// (same recommender may submit multiple letters)
	}

	// Calculate expiry date - support both fixed and relative deadlines
	var expiresAt *time.Time

	// Debug: Log the field config to see what we're getting
	configJSON, _ := json.Marshal(fieldConfig)
	fmt.Printf("[Recommendations] Field config: %s\n", string(configJSON))
	fmt.Printf("[Recommendations] DeadlineType: '%s', FixedDeadline: '%s'\n", fieldConfig.DeadlineType, fieldConfig.FixedDeadline)

	if fieldConfig.DeadlineType == "fixed" && fieldConfig.FixedDeadline != "" {
		// Parse the fixed deadline (ISO format from datetime-local input)
		// Handle both formats: with and without seconds
		fmt.Printf("[Recommendations] Using fixed deadline: %s\n", fieldConfig.FixedDeadline)
		parsed, err := time.Parse("2006-01-02T15:04", fieldConfig.FixedDeadline)
		if err != nil {
			fmt.Printf("[Recommendations] Failed to parse with format 2006-01-02T15:04: %v\n", err)
			parsed, err = time.Parse("2006-01-02T15:04:05", fieldConfig.FixedDeadline)
		}
		if err == nil {
			expiresAt = &parsed
			fmt.Printf("[Recommendations] Parsed deadline: %v\n", expiresAt)
		} else {
			fmt.Printf("[Recommendations] Failed to parse fixed deadline: %v\n", err)
		}
	} else {
		fmt.Printf("[Recommendations] Using relative deadline\n")
		// Relative deadline (days from now)
		deadlineDays := fieldConfig.DeadlineDays
		if deadlineDays == 0 {
			deadlineDays = fieldConfig.DeadlineDaysFE // Try frontend field name
		}
		if deadlineDays > 0 {
			expiry := time.Now().AddDate(0, 0, deadlineDays)
			expiresAt = &expiry
		}
	}

	// Create the request
	submissionUUID, _ := uuid.Parse(input.SubmissionID)
	formUUID, _ := uuid.Parse(input.FormID)

	request := models.RecommendationRequest{
		SubmissionID:            submissionUUID,
		FormID:                  formUUID,
		FieldID:                 input.FieldID,
		RecommenderName:         input.RecommenderName,
		RecommenderEmail:        input.RecommenderEmail,
		RecommenderRelationship: input.RecommenderRelationship,
		RecommenderOrganization: input.RecommenderOrganization,
		Token:                   generateRecommendationToken(),
		Status:                  "pending",
		ExpiresAt:               expiresAt,
	}

	if err := database.DB.Create(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create recommendation request"})
		return
	}

	fmt.Printf("[Recommendations] Created recommendation request ID: %s for email: %s\n", request.ID.String(), request.RecommenderEmail)

	// Send email asynchronously
	go func() {
		if err := sendRecommendationRequestEmail(&request, &submission, &form, &fieldConfig); err != nil {
			fmt.Printf("[Recommendations] Email send failed: %v\n", err)
		}
	}()

	c.JSON(http.StatusCreated, request)
}

// sendRecommendationRequestEmail sends the recommendation request email via Gmail (or Resend fallback)
func sendRecommendationRequestEmail(request *models.RecommendationRequest, submission *models.Row, form *models.Table, config *models.RecommendationFieldConfig) error {
	fmt.Printf("[Recommendations] Starting to send email to: %s\n", request.RecommenderEmail)

	applicantName, applicantEmail, err := resolveApplicantInfo(request.SubmissionID)
	if err != nil {
		return fmt.Errorf("failed to resolve applicant info from ba_users: %w", err)
	}

	// Build the recommendation link - use APP_URL for production
	baseURL := os.Getenv("APP_URL")
	if baseURL == "" {
		baseURL = os.Getenv("NEXT_PUBLIC_APP_URL")
	}
	if baseURL == "" {
		baseURL = "https://www.maticsapp.com" // Production default
	}
	recommendationLink := fmt.Sprintf("%s/recommend/%s", baseURL, request.Token)

	// Format deadline with date and time
	deadline := "No deadline"
	if request.ExpiresAt != nil {
		deadline = request.ExpiresAt.Format("January 2, 2006 at 3:04 PM")
	}

	// Use custom template or default - check both backend and frontend field names
	subject := config.EmailTemplate.Subject
	if subject == "" {
		subject = config.EmailSubject // Frontend field name
	}
	if subject == "" {
		subject = fmt.Sprintf("Recommendation Request for %s", applicantName)
	}

	// Check for custom email body
	customBody := config.EmailTemplate.Body
	if customBody == "" {
		customBody = config.EmailMessage // Frontend field name
	}

	var body string
	submissionData := map[string]interface{}{}
	if submission != nil && submission.Data != nil {
		_ = json.Unmarshal(submission.Data, &submissionData)
	}
	mergeData := map[string]string{
		"recommender_name": request.RecommenderName,
		"applicant_name":   applicantName,
		"applicant_email":  applicantEmail,
		"form_title":       form.Name,
		"link":             recommendationLink,
		"deadline":         deadline,
	}

	if config.MergeTagFields.ApplicantName != "" {
		if resolvedName, ok := resolveSubmissionFieldValue(form.ID, config.MergeTagFields.ApplicantName, submissionData); ok {
			mergeData["applicant_name"] = resolvedName
			applicantName = resolvedName
		}
	}
	if config.MergeTagFields.ApplicantEmail != "" {
		if resolvedEmail, ok := resolveSubmissionFieldValue(form.ID, config.MergeTagFields.ApplicantEmail, submissionData); ok {
			mergeData["applicant_email"] = resolvedEmail
			applicantEmail = resolvedEmail
		}
	}
	if customBody != "" {
		// Use custom body with merge tags
		body = applyRecommendationMergeTags(customBody, mergeData, submissionData, form.ID)

		// Wrap plain text in clean HTML if it doesn't contain HTML tags
		if !strings.Contains(body, "<") {
			logoURL := getFormLogoURL(form)
			body = buildRecommendationEmailHTML(request.RecommenderName, body, form.Name, logoURL, recommendationLink, deadline, false)
		}

		// Also process subject merge tags
		subject = applyRecommendationMergeTags(subject, mergeData, submissionData, form.ID)
	} else {
		// Default template
		logoURL := getFormLogoURL(form)
		mainText := fmt.Sprintf("You have been requested to provide a letter of recommendation for <strong>%s</strong> (%s). Please click the button below to submit your recommendation.", applicantName, applicantEmail)
		body = buildRecommendationEmailHTML(request.RecommenderName, mainText, form.Name, logoURL, recommendationLink, deadline, false)
	}

	// Build sender name - check for custom emailSettings first
	senderName := form.Name
	var formSettings map[string]interface{}
	if err := json.Unmarshal(form.Settings, &formSettings); err == nil {
		if emailSettings, ok := formSettings["emailSettings"].(map[string]interface{}); ok {
			if customSenderName, ok := emailSettings["senderName"].(string); ok && customSenderName != "" {
				senderName = customSenderName
				fmt.Printf("[Recommendations] Using custom sender name from settings: %s\n", senderName)
			}
		}
	}
	if senderName == "" {
		senderName = "Matic"
	}
	fromEmail := fmt.Sprintf("%s <hello@notifications.maticsapp.com>", senderName)

	// Check for reply-to email in settings - default to support@maticsapp.com
	replyTo := "support@maticsapp.com"
	if err := json.Unmarshal(form.Settings, &formSettings); err == nil {
		if emailSettings, ok := formSettings["emailSettings"].(map[string]interface{}); ok {
			if replyToEmail, ok := emailSettings["replyToEmail"].(string); ok && replyToEmail != "" {
				replyTo = replyToEmail
				fmt.Printf("[Recommendations] Using reply-to from settings: %s\n", replyTo)
			}
		}
	}

	fmt.Printf("[Recommendations] Sending email from: %s to: %s, subject: %s\n", fromEmail, request.RecommenderEmail, subject)

	emailReq := services.EmailSendRequest{
		WorkspaceID: form.WorkspaceID,
		To:          request.RecommenderEmail,
		ToName:      request.RecommenderName,
		From:        fromEmail,
		FromName:    senderName,
		Subject:     subject,
		Body:        subject, // plain text fallback
		BodyHTML:    body,
		ReplyTo:     replyTo,
		FormID:      &request.FormID,
		ServiceType: services.ServiceTypeGmail, // Prefer Gmail
		TrackOpens:  true,
	}

	fmt.Printf("[Recommendations] Sending via EmailRouter (Gmail preferred)...\n")
	router := services.NewEmailRouter()
	result, err := router.SendEmail(context.Background(), emailReq)
	if err != nil {
		fmt.Printf("[Recommendations] ERROR: Failed to send email: %v\n", err)
		return err
	}
	if !result.Success {
		fmt.Printf("[Recommendations] ERROR: Email sending failed: %s\n", result.ErrorMessage)
		return fmt.Errorf("email sending failed: %s", result.ErrorMessage)
	}

	fmt.Printf("[Recommendations] SUCCESS: Email sent to %s via %s\n", request.RecommenderEmail, result.ServiceType)
	return nil
}

// SubmitRecommendation handles the recommender submitting their recommendation
func SubmitRecommendation(c *gin.Context) {
	token := c.Param("token")

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "token = ?", token).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found"})
		return
	}

	// Check if already submitted
	if request.Status == "submitted" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This recommendation has already been submitted"})
		return
	}

	// Check if expired
	if request.ExpiresAt != nil && time.Now().After(*request.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This recommendation request has expired"})
		return
	}

	// Parse the response - handle both JSON and multipart form data
	var responseData map[string]interface{}

	contentType := c.ContentType()
	if strings.Contains(contentType, "multipart/form-data") {
		// Handle multipart form with file
		responseStr := c.PostForm("response")
		if responseStr != "" {
			if err := json.Unmarshal([]byte(responseStr), &responseData); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid response format"})
				return
			}
		} else {
			responseData = make(map[string]interface{})
		}

		// Handle file upload
		file, header, err := c.Request.FormFile("document")
		if err == nil && file != nil {
			defer file.Close()

			// Validate file type
			allowedTypes := map[string]bool{
				"application/pdf":    true,
				"application/msword": true,
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
			}

			fileContentType := header.Header.Get("Content-Type")
			if !allowedTypes[fileContentType] {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Please upload a PDF or Word document."})
				return
			}

			// Validate file size (10MB max)
			if header.Size > 10*1024*1024 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "File size must be less than 10MB"})
				return
			}

			// Generate unique filename
			ext := filepath.Ext(header.Filename)
			filename := fmt.Sprintf("%s_%s%s", uuid.New().String()[:8], strings.TrimSuffix(header.Filename, ext), ext)

			// Upload to Supabase Storage (persistent, survives redeploys)
			storagePath := fmt.Sprintf("uploads/recommendations/%s/%s", request.ID.String(), filename)
			documentURL, err := uploadRecommendationToSupabase(file, storagePath, fileContentType)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to upload file: %s", err.Error())})
				return
			}

			responseData["uploaded_document"] = map[string]interface{}{
				"url":      documentURL,
				"filename": header.Filename,
				"size":     header.Size,
				"type":     fileContentType,
			}

			// Best-effort sync to Google Drive if form integration is enabled.
			if driveMeta, driveErr := syncRecommendationDocumentToGoogleDrive(&request, documentURL, header.Filename, "Recommendation Letter", true); driveErr == nil {
				if uploadedDoc, ok := responseData["uploaded_document"].(map[string]interface{}); ok {
					uploadedDoc["google_drive"] = driveMeta
					responseData["uploaded_document"] = uploadedDoc
				}
			} else {
				if uploadedDoc, ok := responseData["uploaded_document"].(map[string]interface{}); ok {
					uploadedDoc["google_drive_sync_error"] = driveErr.Error()
					responseData["uploaded_document"] = uploadedDoc
				}
			}
		}
	} else {
		// Handle regular JSON request
		var input struct {
			Response map[string]interface{} `json:"response" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		responseData = input.Response
	}

	// Update the request
	responseJSON, _ := json.Marshal(responseData)
	now := time.Now()

	request.Response = responseJSON
	request.Status = "submitted"
	request.SubmittedAt = &now

	if err := database.DB.Save(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save recommendation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Recommendation submitted successfully",
		"request": request,
	})
}

// SendRecommendationReminder sends a reminder email
func SendRecommendationReminder(c *gin.Context) {
	id := c.Param("id")

	// Parse request body for sender account ID
	var requestBody struct {
		SenderAccountID *string `json:"sender_account_id,omitempty"`
	}
	if err := c.ShouldBindJSON(&requestBody); err != nil {
		// Ignore binding errors, sender account is optional
	}

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found"})
		return
	}

	if request.Status == "submitted" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Recommendation has already been submitted"})
		return
	}

	// Get form and submission for email
	var submission models.Row
	database.DB.First(&submission, "id = ?", request.SubmissionID)

	var form models.Table
	database.DB.First(&form, "id = ?", request.FormID)

	// Get field config
	var fieldConfig models.RecommendationFieldConfig
	var field models.Field
	if err := database.DB.Where("table_id = ? AND id = ?", request.FormID, request.FieldID).First(&field).Error; err == nil {
		if field.Config != nil {
			json.Unmarshal(field.Config, &fieldConfig)
		}
	}

	// Check if the request has expired or is about to expire
	// If expired or expiring soon, extend the expiration date
	now := time.Now()
	shouldExtend := false
	var newExpiresAt *time.Time

	if request.ExpiresAt != nil {
		// If already expired or expiring within 3 days, extend it
		if now.After(*request.ExpiresAt) || request.ExpiresAt.Sub(now) < 3*24*time.Hour {
			shouldExtend = true
		}
	} else {
		// If no expiration was set, set one now (30 days from reminder)
		shouldExtend = true
	}

	if shouldExtend {
		// Extend expiration by 30 days from now, or use the field config deadline if available
		deadlineDays := fieldConfig.DeadlineDays
		if deadlineDays == 0 {
			deadlineDays = fieldConfig.DeadlineDaysFE
		}
		if deadlineDays == 0 {
			deadlineDays = 30 // Default to 30 days if no deadline configured
		}
		expiry := now.AddDate(0, 0, deadlineDays)
		newExpiresAt = &expiry
		request.ExpiresAt = newExpiresAt
		fmt.Printf("[Recommendations] Extended expiration date to %v for reminder\n", newExpiresAt)
	}

	// Send reminder email
	if err := sendRecommendationReminderEmail(&request, &submission, &form, &fieldConfig, requestBody.SenderAccountID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send reminder email"})
		return
	}

	// Update reminder tracking and expiration
	request.RemindedAt = &now
	request.ReminderCount++
	database.DB.Save(&request)

	c.JSON(http.StatusOK, gin.H{"message": "Reminder sent successfully"})
}

func sendRecommendationReminderEmail(request *models.RecommendationRequest, submission *models.Row, form *models.Table, config *models.RecommendationFieldConfig, senderAccountID *string) error {
	// Get workspace ID from form
	workspaceID := form.WorkspaceID

	applicantName, applicantEmail, err := resolveApplicantInfo(request.SubmissionID)
	if err != nil {
		return fmt.Errorf("failed to resolve applicant info from ba_users: %w", err)
	}

	// Build the recommendation link
	baseURL := os.Getenv("NEXT_PUBLIC_APP_URL")
	if baseURL == "" {
		baseURL = "https://www.maticsapp.com"
	}
	recommendationLink := fmt.Sprintf("%s/recommend/%s", baseURL, request.Token)

	// Format deadline
	deadline := "No deadline"
	if request.ExpiresAt != nil {
		deadline = request.ExpiresAt.Format("January 2, 2006 at 3:04 PM")
	}

	subject := config.EmailTemplate.ReminderSubject
	if subject == "" {
		subject = fmt.Sprintf("Reminder: Recommendation Request for %s", applicantName)
	}

	body := config.EmailTemplate.ReminderBody
	if body == "" {
		logoURL := getFormLogoURL(form)
		mainText := fmt.Sprintf("This is a friendly reminder that <strong>%s</strong> (%s) is waiting for your recommendation for their application to <strong>%s</strong>. Your support means a great deal to them.", applicantName, applicantEmail, form.Name)
		body = buildRecommendationEmailHTML(request.RecommenderName, mainText, form.Name, logoURL, recommendationLink, deadline, true)
	} else {
		logoURL := getFormLogoURL(form)
		defaultMainText := fmt.Sprintf("This is a friendly reminder that <strong>%s</strong> (%s) is waiting for your recommendation for their application to <strong>%s</strong>. Your support means a great deal to them.", applicantName, applicantEmail, form.Name)
		submissionData := map[string]interface{}{}
		if submission != nil && submission.Data != nil {
			_ = json.Unmarshal(submission.Data, &submissionData)
		}
		mergeData := map[string]string{
			"recommender_name": request.RecommenderName,
			"applicant_name":   applicantName,
			"applicant_email":  applicantEmail,
			"form_title":       form.Name,
			"link":             recommendationLink,
			"deadline":         deadline,
		}
		if config.MergeTagFields.ApplicantName != "" {
			if resolvedName, ok := resolveSubmissionFieldValue(form.ID, config.MergeTagFields.ApplicantName, submissionData); ok {
				mergeData["applicant_name"] = resolvedName
				applicantName = resolvedName
			}
		}
		if config.MergeTagFields.ApplicantEmail != "" {
			if resolvedEmail, ok := resolveSubmissionFieldValue(form.ID, config.MergeTagFields.ApplicantEmail, submissionData); ok {
				mergeData["applicant_email"] = resolvedEmail
				applicantEmail = resolvedEmail
			}
		}

		body = applyRecommendationMergeTags(body, mergeData, submissionData, form.ID)

		if !strings.Contains(body, "<") {
			body = buildRecommendationEmailHTML(request.RecommenderName, body, form.Name, logoURL, recommendationLink, deadline, true)
		} else if isLegacyRecommendationReminderHTML(body) {
			body = buildRecommendationEmailHTML(request.RecommenderName, defaultMainText, form.Name, logoURL, recommendationLink, deadline, true)
		}

		subject = applyRecommendationMergeTags(subject, mergeData, submissionData, form.ID)
	}

	// Determine sender email and name
	fromEmail := "hello@notifications.maticsapp.com"
	fromName := "Matic"

	// If sender account ID is provided, get the Gmail account details
	if senderAccountID != nil && *senderAccountID != "" {
		var account models.GmailConnection
		accountUUID, err := uuid.Parse(*senderAccountID)
		if err == nil {
			if err := database.DB.Where("id = ? AND workspace_id = ?", accountUUID, workspaceID).First(&account).Error; err == nil {
				fromEmail = account.Email
				fromName = account.DisplayName
				if fromName == "" {
					fromName = strings.Split(account.Email, "@")[0]
				}
			}
		}
	} else {
		// Use form settings for sender info
		senderName := form.Name
		var formSettings map[string]interface{}
		if err := json.Unmarshal(form.Settings, &formSettings); err == nil {
			if emailSettings, ok := formSettings["emailSettings"].(map[string]interface{}); ok {
				if customSenderName, ok := emailSettings["senderName"].(string); ok && customSenderName != "" {
					senderName = customSenderName
				}
			}
		}
		if senderName != "" {
			fromName = senderName
		}
	}

	// Check for reply-to email in settings
	replyTo := "support@maticsapp.com"
	var formSettings map[string]interface{}
	if err := json.Unmarshal(form.Settings, &formSettings); err == nil {
		if emailSettings, ok := formSettings["emailSettings"].(map[string]interface{}); ok {
			if replyToEmail, ok := emailSettings["replyToEmail"].(string); ok && replyToEmail != "" {
				replyTo = replyToEmail
			}
		}
	}

	// Create email request
	emailReq := services.EmailSendRequest{
		WorkspaceID: workspaceID,
		To:          request.RecommenderEmail,
		ToName:      request.RecommenderName,
		From:        fromEmail,
		FromName:    fromName,
		Subject:     subject,
		Body:        subject, // Plain text fallback
		BodyHTML:    body,
		ReplyTo:     replyTo,
		FormID:      &request.FormID,
		ServiceType: services.ServiceTypeGmail, // Prefer Gmail
		TrackOpens:  true,
	}

	// Send email via router
	router := services.NewEmailRouter()
	result, err := router.SendEmail(context.Background(), emailReq)
	if err != nil {
		return fmt.Errorf("failed to send reminder email: %v", err)
	}

	if !result.Success {
		return fmt.Errorf("email sending failed: %s", result.ErrorMessage)
	}

	return nil
}

// CancelRecommendationRequest cancels a pending recommendation request
func CancelRecommendationRequest(c *gin.Context) {
	id := c.Param("id")

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found"})
		return
	}

	if request.Status == "submitted" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot cancel a submitted recommendation"})
		return
	}

	request.Status = "cancelled"
	database.DB.Save(&request)

	c.JSON(http.StatusOK, gin.H{"message": "Recommendation request cancelled"})
}

// GetRecommendationsForReview returns all recommendations for a submission (for reviewers)
func GetRecommendationsForReview(c *gin.Context) {
	submissionID := c.Param("submissionId")

	var requests []models.RecommendationRequest
	if err := database.DB.Where("submission_id = ?", submissionID).
		Order("created_at ASC").
		Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendations"})
		return
	}

	// Rewrite localhost URLs in responses
	for i := range requests {
		if len(requests[i].Response) > 0 {
			rewritten, err := rewriteLocalhostURLs(requests[i].Response)
			if err == nil {
				requests[i].Response = rewritten
			}
		}
	}

	c.JSON(http.StatusOK, requests)
}

// SendTestRecommendationEmail sends a test recommendation email without needing a real submission
func SendTestRecommendationEmail(c *gin.Context) {
	var input struct {
		ToEmail       string `json:"to_email" binding:"required"`
		ToName        string `json:"to_name" binding:"required"`
		ApplicantName string `json:"applicant_name"`
		FormTitle     string `json:"form_title"`
		LogoURL       string `json:"logo_url"`
		WorkspaceID   string `json:"workspace_id"`
		FormID        string `json:"form_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if input.ApplicantName == "" {
		input.ApplicantName = "the applicant"
	}

	// If form_id is provided, look up the real form name and logo
	if input.FormID != "" {
		var form models.Table
		if err := database.DB.First(&form, "id = ?", input.FormID).Error; err == nil {
			if input.FormTitle == "" {
				input.FormTitle = form.Name
			}
			if input.LogoURL == "" {
				input.LogoURL = getFormLogoURL(&form)
			}
			if input.WorkspaceID == "" {
				input.WorkspaceID = form.WorkspaceID.String()
			}
		}
	}

	if input.FormTitle == "" {
		input.FormTitle = "the application"
	}

	baseURL := os.Getenv("APP_URL")
	if baseURL == "" {
		baseURL = "https://www.maticsapp.com"
	}
	sampleLink := fmt.Sprintf("%s/recommend/sample-token-preview", baseURL)
	deadline := "April 15, 2026 at 5:00 PM"

	mainText := fmt.Sprintf("<strong>%s</strong> has listed you as a recommender for their application to <strong>%s</strong>. Please click the button below to submit your recommendation.", input.ApplicantName, input.FormTitle)
	body := buildRecommendationEmailHTML(input.ToName, mainText, input.FormTitle, input.LogoURL, sampleLink, deadline, false)
	subject := fmt.Sprintf("Recommendation Request for %s", input.ApplicantName)

	// If a workspace_id is provided, use EmailRouter (Gmail preferred) - otherwise fall back to default Resend
	if input.WorkspaceID != "" {
		workspaceUUID, err := uuid.Parse(input.WorkspaceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
			return
		}
		emailReq := services.EmailSendRequest{
			WorkspaceID: workspaceUUID,
			To:          input.ToEmail,
			ToName:      input.ToName,
			From:        "hello@notifications.maticsapp.com",
			FromName:    "Matic",
			Subject:     subject,
			Body:        subject,
			BodyHTML:    body,
			ReplyTo:     "support@maticsapp.com",
			ServiceType: services.ServiceTypeGmail,
			TrackOpens:  false,
		}
		router := services.NewEmailRouter()
		result, err := router.SendEmail(context.Background(), emailReq)
		if err != nil || !result.Success {
			errMsg := ""
			if err != nil {
				errMsg = err.Error()
			} else {
				errMsg = result.ErrorMessage
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to send email: %s", errMsg)})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message":      "Test email sent successfully",
			"message_id":   result.MessageID,
			"service_used": result.ServiceType,
			"to":           input.ToEmail,
		})
		return
	}

	// Fallback: no workspace_id — use Resend directly
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "RESEND_API_KEY not configured and no workspace_id provided"})
		return
	}
	client := resend.NewClient(apiKey)
	params := &resend.SendEmailRequest{
		From:    "Matic <hello@notifications.maticsapp.com>",
		To:      []string{input.ToEmail},
		Subject: subject,
		Html:    body,
		ReplyTo: "support@maticsapp.com",
	}
	sent, err := client.Emails.Send(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to send email: %v", err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":      "Test email sent successfully",
		"resend_id":    sent.Id,
		"service_used": "resend",
		"to":           input.ToEmail,
	})
}
