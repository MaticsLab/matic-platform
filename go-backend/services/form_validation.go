package services

import (
	"fmt"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/models"
)

// FormValidationService handles field validation
type FormValidationService struct{}

func NewFormValidationService() *FormValidationService {
	return &FormValidationService{}
}

// ValidateField validates a single field value against its validation rules
func (s *FormValidationService) ValidateField(field models.FormField, value interface{}, validation *models.FieldValidation) []string {
	errors := []string{}

	if validation == nil {
		return errors
	}

	// Required check (handled at field level, not validation level)
	if field.Required && (value == nil || value == "") {
		errors = append(errors, fmt.Sprintf("%s is required", field.Label))
		return errors // Don't run other validations if empty and required
	}

	// Skip validation if empty and not required
	if value == nil || value == "" {
		return errors
	}

	// Validation type-specific checks
	if validation.ValidationType != "" {
		switch validation.ValidationType {
		case "email":
			if errs := s.validateEmail(value, validation.EmailValidation); len(errs) > 0 {
				errors = append(errors, errs...)
			}
		case "phone":
			if errs := s.validatePhone(value, validation.PhoneValidation); len(errs) > 0 {
				errors = append(errors, errs...)
			}
		case "url":
			if errs := s.validateURL(value, validation.URLValidation); len(errs) > 0 {
				errors = append(errors, errs...)
			}
		case "date":
			if errs := s.validateDate(value, validation.DateValidation); len(errs) > 0 {
				errors = append(errors, errs...)
			}
		}
	}

	// Numeric validation
	if validation.Min != nil || validation.Max != nil {
		if errs := s.validateNumeric(value, validation.Min, validation.Max); len(errs) > 0 {
			errors = append(errors, errs...)
		}
	}

	// String length validation
	if validation.MinLength != nil || validation.MaxLength != nil {
		if errs := s.validateLength(value, validation.MinLength, validation.MaxLength); len(errs) > 0 {
			errors = append(errors, errs...)
		}
	}

	// Custom pattern validation
	if validation.Pattern != "" {
		if !s.matchesPattern(value, validation.Pattern) {
			msg := validation.PatternMessage
			if msg == "" {
				msg = "Value does not match required pattern"
			}
			errors = append(errors, msg)
		}
	}

	// File validation (if applicable)
	if field.FieldType == "file" || field.FieldType == "image" {
		if errs := s.validateFile(value, validation); len(errs) > 0 {
			errors = append(errors, errs...)
		}
	}

	return errors
}

// Email validation
func (s *FormValidationService) validateEmail(value interface{}, rules *models.EmailValidation) []string {
	errors := []string{}
	emailStr := fmt.Sprint(value)

	// Basic format check
	if _, err := mail.ParseAddress(emailStr); err != nil {
		errors = append(errors, "Invalid email address format")
		return errors
	}

	if rules == nil {
		return errors
	}

	// Extract domain
	parts := strings.Split(emailStr, "@")
	if len(parts) != 2 {
		return errors
	}
	domain := strings.ToLower(parts[1])

	// Check blocked domains
	for _, blocked := range rules.BlockedDomains {
		if strings.EqualFold(domain, blocked) {
			errors = append(errors, fmt.Sprintf("Email from domain %s is not allowed", blocked))
			return errors
		}
	}

	// Check allowed domains
	if len(rules.AllowedDomains) > 0 {
		allowed := false
		for _, allowedDomain := range rules.AllowedDomains {
			if strings.EqualFold(domain, allowedDomain) {
				allowed = true
				break
			}
		}
		if !allowed {
			errors = append(errors, "Email domain is not in the allowed list")
		}
	}

	// Check corporate requirement
	if rules.RequireCorporate {
		freeProviders := []string{
			"gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
			"aol.com", "icloud.com", "mail.com", "protonmail.com",
		}
		for _, provider := range freeProviders {
			if strings.EqualFold(domain, provider) {
				errors = append(errors, "Please use a corporate email address")
				break
			}
		}
	}

	return errors
}

// Phone validation
func (s *FormValidationService) validatePhone(value interface{}, rules *models.PhoneValidation) []string {
	errors := []string{}
	phoneStr := fmt.Sprint(value)

	// Remove common formatting characters
	cleaned := regexp.MustCompile(`[^\d+]`).ReplaceAllString(phoneStr, "")

	if rules != nil && rules.Format != "" {
		// Check against custom format
		formatRegex := strings.ReplaceAll(rules.Format, "#", `\d`)
		matched, _ := regexp.MatchString(formatRegex, phoneStr)
		if !matched {
			errors = append(errors, fmt.Sprintf("Phone must match format: %s", rules.Format))
		}
	} else {
		// Basic validation: 10-15 digits
		if len(cleaned) < 10 || len(cleaned) > 15 {
			errors = append(errors, "Invalid phone number")
		}
	}

	return errors
}

// URL validation
func (s *FormValidationService) validateURL(value interface{}, rules *models.URLValidation) []string {
	errors := []string{}
	urlStr := fmt.Sprint(value)

	// Parse URL
	parsedURL, err := url.Parse(urlStr)
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		errors = append(errors, "Invalid URL format")
		return errors
	}

	if rules == nil {
		return errors
	}

	// HTTPS requirement
	if rules.RequireHTTPS && parsedURL.Scheme != "https" {
		errors = append(errors, "URL must use HTTPS")
	}

	domain := strings.ToLower(parsedURL.Host)

	// Check blocked domains
	for _, blocked := range rules.BlockedDomains {
		if strings.Contains(domain, strings.ToLower(blocked)) {
			errors = append(errors, fmt.Sprintf("Domain %s is not allowed", blocked))
			return errors
		}
	}

	// Check allowed domains
	if len(rules.AllowedDomains) > 0 {
		allowed := false
		for _, allowedDomain := range rules.AllowedDomains {
			if strings.Contains(domain, strings.ToLower(allowedDomain)) {
				allowed = true
				break
			}
		}
		if !allowed {
			errors = append(errors, "URL domain is not in the allowed list")
		}
	}

	return errors
}

// Date validation
func (s *FormValidationService) validateDate(value interface{}, rules *models.DateValidation) []string {
	errors := []string{}

	var dateValue time.Time
	switch v := value.(type) {
	case time.Time:
		dateValue = v
	case string:
		parsed, err := time.Parse("2006-01-02", v)
		if err != nil {
			errors = append(errors, "Invalid date format. Expected YYYY-MM-DD")
			return errors
		}
		dateValue = parsed
	default:
		errors = append(errors, "Invalid date type")
		return errors
	}

	if rules == nil {
		return errors
	}

	now := time.Now()

	// Min/Max date checks
	if rules.MinDate != nil && dateValue.Before(*rules.MinDate) {
		errors = append(errors, fmt.Sprintf("Date must be on or after %s", rules.MinDate.Format("2006-01-02")))
	}

	if rules.MaxDate != nil && dateValue.After(*rules.MaxDate) {
		errors = append(errors, fmt.Sprintf("Date must be on or before %s", rules.MaxDate.Format("2006-01-02")))
	}

	// Past/Future checks
	if rules.AllowPast != nil && !*rules.AllowPast && dateValue.Before(now) {
		errors = append(errors, "Past dates are not allowed")
	}

	if rules.AllowFuture != nil && !*rules.AllowFuture && dateValue.After(now) {
		errors = append(errors, "Future dates are not allowed")
	}

	// Disabled dates
	dateStr := dateValue.Format("2006-01-02")
	for _, disabled := range rules.DisabledDates {
		if disabled == dateStr {
			errors = append(errors, "This date is not available")
			break
		}
	}

	// Disabled days of week
	if len(rules.DisabledDays) > 0 {
		weekday := int(dateValue.Weekday())
		for _, disabledDay := range rules.DisabledDays {
			if weekday == disabledDay {
				errors = append(errors, "This day of the week is not available")
				break
			}
		}
	}

	return errors
}

// Numeric validation
func (s *FormValidationService) validateNumeric(value interface{}, min, max *float64) []string {
	errors := []string{}

	var numValue float64
	switch v := value.(type) {
	case float64:
		numValue = v
	case float32:
		numValue = float64(v)
	case int:
		numValue = float64(v)
	case int64:
		numValue = float64(v)
	case string:
		_, err := fmt.Sscanf(v, "%f", &numValue)
		if err != nil {
			errors = append(errors, "Value must be a number")
			return errors
		}
	default:
		errors = append(errors, "Value must be a number")
		return errors
	}

	if min != nil && numValue < *min {
		errors = append(errors, fmt.Sprintf("Value must be at least %v", *min))
	}

	if max != nil && numValue > *max {
		errors = append(errors, fmt.Sprintf("Value must be at most %v", *max))
	}

	return errors
}

// String length validation
func (s *FormValidationService) validateLength(value interface{}, minLen, maxLen *int) []string {
	errors := []string{}
	strValue := fmt.Sprint(value)
	length := len(strValue)

	if minLen != nil && length < *minLen {
		errors = append(errors, fmt.Sprintf("Must be at least %d characters", *minLen))
	}

	if maxLen != nil && length > *maxLen {
		errors = append(errors, fmt.Sprintf("Must be at most %d characters", *maxLen))
	}

	return errors
}

// Pattern matching
func (s *FormValidationService) matchesPattern(value interface{}, pattern string) bool {
	strValue := fmt.Sprint(value)
	matched, err := regexp.MatchString(pattern, strValue)
	return err == nil && matched
}

// File validation
func (s *FormValidationService) validateFile(value interface{}, validation *models.FieldValidation) []string {
	errors := []string{}

	// This would need to be adapted based on how file uploads are handled
	// Placeholder implementation

	if validation.MaxFileSize != nil {
		// Check file size
	}

	if len(validation.AllowedFileTypes) > 0 {
		// Check file type/extension
	}

	return errors
}

// Built-in validation patterns
var ValidationPatterns = map[string]string{
	"email":        `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`,
	"phone_us":     `^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$`,
	"phone_intl":   `^\+?[1-9]\d{1,14}$`,
	"url":          `^https?://[^\s/$.?#].[^\s]*$`,
	"zip_us":       `^\d{5}(-\d{4})?$`,
	"ssn":          `^\d{3}-?\d{2}-?\d{4}$`,
	"credit_card":  `^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$`,
	"ipv4":         `^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$`,
	"alphanumeric": `^[a-zA-Z0-9]+$`,
	"alpha":        `^[a-zA-Z]+$`,
	"numeric":      `^[0-9]+$`,
}
