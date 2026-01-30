#!/bin/bash

# Script to remove student_information field from all table_rows
# This will call the backend API endpoint to clean up the data

echo "🧹 Cleaning up student_information field from database..."
echo ""

# Get workspace ID from user or use environment variable
if [ -z "$WORKSPACE_ID" ]; then
    read -p "Enter workspace ID (or press Enter to clean ALL workspaces): " WORKSPACE_ID
fi

# Get backend URL (default to localhost)
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"

# Get auth token
if [ -z "$AUTH_TOKEN" ]; then
    echo ""
    echo "⚠️  You need an authentication token to run this cleanup."
    echo "Please login to the app and get your token from:"
    echo "  - Browser DevTools > Application > Cookies > your-domain"
    echo "  - Look for 'better_call_saul_token' or 'auth_token'"
    echo ""
    read -p "Enter your auth token: " AUTH_TOKEN
fi

echo ""
echo "Calling cleanup endpoint..."
echo "URL: $BACKEND_URL/api/v1/admin/cleanup/remove-student-information"

# Make the API call
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    "$BACKEND_URL/api/v1/admin/cleanup/remove-student-information")

# Extract HTTP status and body
HTTP_BODY=$(echo "$RESPONSE" | sed -n '1,/^HTTP_STATUS:/p' | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

echo ""
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Success! Response:"
    echo "$HTTP_BODY" | python3 -m json.tool 2>/dev/null || echo "$HTTP_BODY"
else
    echo "❌ Error (HTTP $HTTP_STATUS):"
    echo "$HTTP_BODY"
fi

echo ""
echo "Done!"
