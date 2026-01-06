package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

// SetPermission sets sharing permissions on a file or folder (user or anyone)
func (s *GoogleDriveService) SetPermission(ctx context.Context, srv *drive.Service, fileID string, permType string, role string, email string) error {
	perm := &drive.Permission{
		Type: permType, // "user", "anyone", etc.
		Role: role,     // "reader", "writer", etc.
	}
	if permType == "user" && email != "" {
		perm.EmailAddress = email
	}
	_, err := srv.Permissions.Create(fileID, perm).Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("failed to set permission: %w", err)
	}
	return nil
}

// RenderFileNameTemplate renders a file name template using row data and fallback name
func RenderFileNameTemplate(template string, rowData map[string]interface{}, fallback string) string {
	name := template
	for k, v := range rowData {
		placeholder := fmt.Sprintf("${%s}", k)
		val := fmt.Sprintf("%v", v)
		name = strings.ReplaceAll(name, placeholder, val)
	}
	// If template is unchanged or empty, fallback
	if name == template || strings.TrimSpace(name) == "" {
		return fallback
	}
	return name
}

// GoogleDriveService handles Google Drive operations
type GoogleDriveService struct {
	config *oauth2.Config
}

// GoogleDriveCredentials holds the OAuth credentials for Google Drive
type GoogleDriveCredentials struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	RedirectURI  string `json:"redirect_uri"`
}

// NewGoogleDriveService creates a new Google Drive service instance
func NewGoogleDriveService(clientID, clientSecret, redirectURI string) *GoogleDriveService {
	config := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURI,
		Scopes: []string{
			drive.DriveFileScope,     // Full access to user's files
			drive.DriveMetadataScope, // View and manage file metadata
		},
		Endpoint: google.Endpoint,
	}

	return &GoogleDriveService{
		config: config,
	}
}

// GetAuthURL returns the URL to redirect users for OAuth authorization
func (s *GoogleDriveService) GetAuthURL(state string) string {
	return s.config.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce)
}

// ExchangeCode exchanges an authorization code for tokens
func (s *GoogleDriveService) ExchangeCode(ctx context.Context, code string) (*oauth2.Token, error) {
	token, err := s.config.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	return token, nil
}

// RefreshToken refreshes an expired access token
func (s *GoogleDriveService) RefreshToken(ctx context.Context, refreshToken string) (*oauth2.Token, error) {
	token := &oauth2.Token{
		RefreshToken: refreshToken,
	}
	tokenSource := s.config.TokenSource(ctx, token)
	newToken, err := tokenSource.Token()
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}
	return newToken, nil
}

// GetDriveClient creates a Drive API client from tokens
func (s *GoogleDriveService) GetDriveClient(ctx context.Context, accessToken, refreshToken string, expiresAt time.Time) (*drive.Service, error) {
	token := &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		Expiry:       expiresAt,
	}

	client := s.config.Client(ctx, token)
	srv, err := drive.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, fmt.Errorf("failed to create drive service: %w", err)
	}

	return srv, nil
}

// DriveFolder represents a folder in Google Drive
type DriveFolder struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	URL     string   `json:"url"`
	Parents []string `json:"parents,omitempty"`
}

// DriveFile represents a file in Google Drive
type DriveFile struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	MimeType string `json:"mime_type"`
	URL      string `json:"url"`
	Size     int64  `json:"size"`
}

// CreateFolder creates a new folder in Google Drive
func (s *GoogleDriveService) CreateFolder(ctx context.Context, srv *drive.Service, name string, parentID string) (*DriveFolder, error) {
	folder := &drive.File{
		Name:     name,
		MimeType: "application/vnd.google-apps.folder",
	}

	if parentID != "" {
		folder.Parents = []string{parentID}
	}

	created, err := srv.Files.Create(folder).
		Fields("id, name, webViewLink, parents").
		Context(ctx).
		Do()
	if err != nil {
		return nil, fmt.Errorf("failed to create folder: %w", err)
	}

	return &DriveFolder{
		ID:      created.Id,
		Name:    created.Name,
		URL:     created.WebViewLink,
		Parents: created.Parents,
	}, nil
}

// GetFolder retrieves folder information by ID
func (s *GoogleDriveService) GetFolder(ctx context.Context, srv *drive.Service, folderID string) (*DriveFolder, error) {
	folder, err := srv.Files.Get(folderID).
		Fields("id, name, webViewLink, parents").
		Context(ctx).
		Do()
	if err != nil {
		return nil, fmt.Errorf("failed to get folder: %w", err)
	}

	return &DriveFolder{
		ID:      folder.Id,
		Name:    folder.Name,
		URL:     folder.WebViewLink,
		Parents: folder.Parents,
	}, nil
}

// FindFolder searches for a folder by name within a parent folder
func (s *GoogleDriveService) FindFolder(ctx context.Context, srv *drive.Service, name, parentID string) (*DriveFolder, error) {
	query := fmt.Sprintf("name = '%s' and mimeType = 'application/vnd.google-apps.folder' and trashed = false", name)
	if parentID != "" {
		query += fmt.Sprintf(" and '%s' in parents", parentID)
	}

	result, err := srv.Files.List().
		Q(query).
		Fields("files(id, name, webViewLink, parents)").
		Context(ctx).
		Do()
	if err != nil {
		return nil, fmt.Errorf("failed to search folder: %w", err)
	}

	if len(result.Files) == 0 {
		return nil, nil // Not found
	}

	folder := result.Files[0]
	return &DriveFolder{
		ID:      folder.Id,
		Name:    folder.Name,
		URL:     folder.WebViewLink,
		Parents: folder.Parents,
	}, nil
}

// FindOrCreateFolder finds an existing folder or creates a new one
func (s *GoogleDriveService) FindOrCreateFolder(ctx context.Context, srv *drive.Service, name, parentID string) (*DriveFolder, error) {
	folder, err := s.FindFolder(ctx, srv, name, parentID)
	if err != nil {
		return nil, err
	}
	if folder != nil {
		return folder, nil
	}

	return s.CreateFolder(ctx, srv, name, parentID)
}

// UploadFile uploads a file to Google Drive
func (s *GoogleDriveService) UploadFile(ctx context.Context, srv *drive.Service, name string, mimeType string, content io.Reader, parentID string) (*DriveFile, error) {
	file := &drive.File{
		Name:     name,
		MimeType: mimeType,
	}

	if parentID != "" {
		file.Parents = []string{parentID}
	}

	uploaded, err := srv.Files.Create(file).
		Media(content).
		Fields("id, name, mimeType, webViewLink, size").
		Context(ctx).
		Do()
	if err != nil {
		return nil, fmt.Errorf("failed to upload file: %w", err)
	}

	return &DriveFile{
		ID:       uploaded.Id,
		Name:     uploaded.Name,
		MimeType: uploaded.MimeType,
		URL:      uploaded.WebViewLink,
		Size:     uploaded.Size,
	}, nil
}

// UploadFileFromURL downloads a file from URL and uploads to Google Drive
func (s *GoogleDriveService) UploadFileFromURL(ctx context.Context, srv *drive.Service, name string, sourceURL string, parentID string) (*DriveFile, error) {
	// Download the file
	resp, err := http.Get(sourceURL)
	if err != nil {
		return nil, fmt.Errorf("failed to download file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to download file: status %d", resp.StatusCode)
	}

	mimeType := resp.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	return s.UploadFile(ctx, srv, name, mimeType, resp.Body, parentID)
}

// DeleteFile deletes a file from Google Drive
func (s *GoogleDriveService) DeleteFile(ctx context.Context, srv *drive.Service, fileID string) error {
	err := srv.Files.Delete(fileID).Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	return nil
}

// ListFilesInFolder lists files in a specific folder
func (s *GoogleDriveService) ListFilesInFolder(ctx context.Context, srv *drive.Service, folderID string) ([]*DriveFile, error) {
	query := fmt.Sprintf("'%s' in parents and trashed = false", folderID)

	result, err := srv.Files.List().
		Q(query).
		Fields("files(id, name, mimeType, webViewLink, size)").
		OrderBy("name").
		Context(ctx).
		Do()
	if err != nil {
		return nil, fmt.Errorf("failed to list files: %w", err)
	}

	files := make([]*DriveFile, len(result.Files))
	for i, f := range result.Files {
		files[i] = &DriveFile{
			ID:       f.Id,
			Name:     f.Name,
			MimeType: f.MimeType,
			URL:      f.WebViewLink,
			Size:     f.Size,
		}
	}

	return files, nil
}

// GetUserEmail retrieves the email of the authenticated user
func (s *GoogleDriveService) GetUserEmail(ctx context.Context, srv *drive.Service) (string, error) {
	about, err := srv.About.Get().Fields("user(emailAddress)").Context(ctx).Do()
	if err != nil {
		return "", fmt.Errorf("failed to get user info: %w", err)
	}
	return about.User.EmailAddress, nil
}

// SanitizeFolderName removes invalid characters from folder names
func SanitizeFolderName(name string) string {
	// Remove characters not allowed in Google Drive folder names
	invalid := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	result := name
	for _, char := range invalid {
		result = strings.ReplaceAll(result, char, "_")
	}
	// Trim spaces and dots from start/end
	result = strings.TrimSpace(result)
	result = strings.Trim(result, ".")
	if result == "" {
		result = "Unnamed"
	}
	return result
}

// GenerateApplicantFolderName generates a folder name for an applicant
func GenerateApplicantFolderName(template string, data map[string]interface{}) string {
	if template == "" {
		template = "{{name}} - {{email}}"
	}

	result := template

	// Replace placeholders with actual values
	for key, value := range data {
		placeholder := fmt.Sprintf("{{%s}}", key)
		strValue := fmt.Sprintf("%v", value)
		result = strings.ReplaceAll(result, placeholder, strValue)
	}

	// Clean up any remaining placeholders
	for strings.Contains(result, "{{") && strings.Contains(result, "}}") {
		start := strings.Index(result, "{{")
		end := strings.Index(result, "}}") + 2
		if start < end {
			result = result[:start] + result[end:]
		} else {
			break
		}
	}

	return SanitizeFolderName(strings.TrimSpace(result))
}

// CreateFormDataSummary creates a text summary of form data for upload
func CreateFormDataSummary(formName string, data map[string]interface{}) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Application: %s\n", formName))
	sb.WriteString(fmt.Sprintf("Submitted: %s\n", time.Now().Format("January 2, 2006 at 3:04 PM")))
	sb.WriteString("\n---\n\n")

	for key, value := range data {
		// Skip internal fields
		if strings.HasPrefix(key, "_") {
			continue
		}

		// Format the key nicely
		formattedKey := strings.ReplaceAll(key, "_", " ")
		formattedKey = strings.Title(strings.ToLower(formattedKey))

		// Format the value
		var formattedValue string
		switch v := value.(type) {
		case map[string]interface{}:
			jsonBytes, _ := json.MarshalIndent(v, "", "  ")
			formattedValue = string(jsonBytes)
		case []interface{}:
			jsonBytes, _ := json.MarshalIndent(v, "", "  ")
			formattedValue = string(jsonBytes)
		default:
			formattedValue = fmt.Sprintf("%v", v)
		}

		sb.WriteString(fmt.Sprintf("%s: %s\n", formattedKey, formattedValue))
	}

	return sb.String()
}
