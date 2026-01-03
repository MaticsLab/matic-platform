# Fix Git Secret Scanning Issue

## Problem
GitHub detected an API key in commit `2b0812b` and blocked the push.

## Solution

The file `ENV_SETUP_INSTRUCTIONS.md` has been fixed (API key replaced with placeholder). Now we need to fix the commit history.

### Option 1: Amend the Last Commit (Recommended)

```bash
# Stage the fixed file
git add ENV_SETUP_INSTRUCTIONS.md

# Amend the last commit (this will rewrite history)
git commit --amend --no-edit

# Force push (since we rewrote history)
git push origin main --force
```

### Option 2: Create a New Commit (Safer)

```bash
# Stage the fixed file
git add ENV_SETUP_INSTRUCTIONS.md

# Create a new commit
git commit -m "fix: Remove API key from ENV_SETUP_INSTRUCTIONS.md"

# Push normally
git push origin main
```

**Note:** Option 2 is safer but the secret will still be in the previous commit. Option 1 removes it from history entirely.

### Option 3: Use GitHub's Secret Scanning Allowlist

If you want to keep the commit as-is (not recommended for security):
1. Visit: https://github.com/Jsanchez767/matic-platform/security/secret-scanning/unblock-secret/37lSTE3arrXcYh2OOjVi6unCGXZ
2. Follow GitHub's instructions to allow the secret

**⚠️ WARNING:** This is NOT recommended as it exposes your API key publicly.

## Recommended Action

Use **Option 1** to completely remove the secret from git history:

```bash
git add ENV_SETUP_INSTRUCTIONS.md
git commit --amend --no-edit
git push origin main --force
```

## Prevention

To prevent this in the future:
1. ✅ Never commit real API keys to git
2. ✅ Use `.env.local` (already in `.gitignore`)
3. ✅ Use placeholder values in documentation
4. ✅ Use GitHub Secrets for CI/CD

