# Password Reset Guide for Staff

## For Staff Members (CRM)

### How to Reset an Applicant's Password

1. **Access the CRM**
   - Navigate to your workspace's CRM/Applicants page
   - Find the applicant who needs a password reset

2. **Reset Password**
   - Click the action menu (⋮) next to the applicant's name
   - Select "Reset Password"
   - System will generate a secure temporary password
   - Copy the displayed password

3. **Share with Applicant**
   - **DO NOT** send via plain email
   - **Recommended**: Call them directly or use secure messaging
   - Tell them this is a temporary password they should change after first login

4. **Confirm Sign-In**
   - Have them visit the portal
   - Sign in with their email and the temporary password
   - Remind them to change their password in account settings

### Technical Notes

- Passwords are 12 characters: uppercase, lowercase, numbers, and symbols
- Passwords are properly hashed using scrypt (Better Auth compatible)
- Users can sign in immediately with the new password
- Old password is replaced; user cannot use old password anymore

---

## For Developers

### Manual Password Reset (Command Line)

If you need to reset passwords for migrated users or bulk resets:

```bash
# Reset single user
npx tsx scripts/reset-password-scrypt.ts user@example.com

# Reset multiple users
npx tsx scripts/reset-password-scrypt.ts user1@example.com user2@example.com
```

The script will:
1. Generate secure random passwords
2. Hash them using Better Auth's scrypt configuration
3. Update the `ba_accounts` table
4. Display credentials for you to share

### How It Works

**Backend** (`go-backend/handlers/crm.go`):
- Endpoint: `POST /api/v1/crm/applicants/reset-password`
- Hashing: scrypt (N=16384, r=16, p=1, dkLen=64)
- Format: `{salt}:{key}` where both are hex-encoded
- Password Generation: 12 characters with mixed case + symbols

**Frontend** (`src/components/CRM/ApplicantCRMPage.tsx`):
- Calls CRM client to reset password
- Displays temporary password in dialog
- Staff can copy and share with applicant

### Password Requirements

- Minimum 8 characters (generated passwords are 12)
- Must contain uppercase and lowercase letters
- Must contain numbers
- Special characters recommended

### Testing

```bash
# Test the password reset functionality
npx tsx scripts/test-crm-password-reset.ts
```

This will:
1. Reset a test user's password
2. Attempt sign-in with new password
3. Verify the complete flow works
