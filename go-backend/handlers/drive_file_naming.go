package handlers

import (
	"fmt"
	"strings"

	"github.com/Jsanchez767/matic-platform/services"
)

func normalizeDriveFieldLabel(label string) string {
	trimmed := strings.TrimSpace(label)
	if trimmed == "" {
		return ""
	}

	normalized := services.SanitizeFolderName(trimmed)
	normalized = strings.TrimSpace(strings.ReplaceAll(normalized, "_", " "))
	normalized = strings.Join(strings.Fields(normalized), " ")

	lower := strings.ToLower(normalized)
	if normalized == "" || lower == "submission raw data" || lower == "submission raw_data" || lower == "raw data" {
		return ""
	}

	return normalized
}

func buildDriveUploadFileName(fieldLabel, originalFileName string) string {
	name := strings.TrimSpace(originalFileName)
	if name == "" {
		name = "document"
	}

	label := normalizeDriveFieldLabel(fieldLabel)
	if label == "" {
		return name
	}

	prefix := strings.ToLower(label + " - ")
	if strings.HasPrefix(strings.ToLower(name), prefix) {
		return name
	}

	return fmt.Sprintf("%s - %s", label, name)
}
