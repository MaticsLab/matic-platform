package handlers

import (
	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
)

// getUserIDForQuery returns the user ID as a string for use in queries
// that check both legacy UUID and Better Auth TEXT columns
func getUserIDForQuery(userID string) string {
	return userID
}

// getLegacyUserID attempts to parse the Better Auth user ID as a UUID
// for backward compatibility with legacy columns
func getLegacyUserID(userID string) *uuid.UUID {
	if parsedUUID, err := uuid.Parse(userID); err == nil {
		return &parsedUUID
	}
	return nil
}

// checkWorkspaceMembership checks if a user is a member of a workspace
// using both legacy UUID and Better Auth TEXT user IDs
func checkWorkspaceMembership(workspaceID uuid.UUID, userID string) (models.WorkspaceMember, bool) {
	var member models.WorkspaceMember
	err := database.DB.Where(
		"workspace_id = ? AND (user_id::text = ? OR ba_user_id = ?) AND status = ?",
		workspaceID, userID, userID, "active",
	).First(&member).Error
	return member, err == nil
}

// checkWorkspaceRole checks if a user has a specific role in a workspace
// using both legacy UUID and Better Auth TEXT user IDs
func checkWorkspaceRole(workspaceID uuid.UUID, userID string, roles ...string) bool {
	var member models.WorkspaceMember
	query := database.DB.Where(
		"workspace_id = ? AND (user_id::text = ? OR ba_user_id = ?) AND status = ?",
		workspaceID, userID, userID, "active",
	)
	if len(roles) > 0 {
		query = query.Where("role IN ?", roles)
	}
	err := query.First(&member).Error
	return err == nil
}

