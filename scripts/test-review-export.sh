#!/bin/bash

# Test script for Review Export API
# Usage: ./test-review-export.sh <workspace_id> [auth_token]

WORKSPACE_ID=$1
AUTH_TOKEN=${2:-""}

if [ -z "$WORKSPACE_ID" ]; then
  echo "Usage: ./test-review-export.sh <workspace_id> [auth_token]"
  echo ""
  echo "Example:"
  echo "  ./test-review-export.sh abc123-def456-..."
  exit 1
fi

API_URL="http://localhost:8080/api/v1/review-export"

echo "🧪 Testing Review Export API"
echo "=============================="
echo "Workspace ID: $WORKSPACE_ID"
echo "API URL: $API_URL"
echo ""

# Build query string
QUERY="workspace_id=$WORKSPACE_ID"

# Make request
echo "📡 Sending request..."
if [ -z "$AUTH_TOKEN" ]; then
  RESPONSE=$(curl -s "$API_URL?$QUERY")
else
  RESPONSE=$(curl -s "$API_URL?$QUERY" -H "Authorization: Bearer $AUTH_TOKEN")
fi

# Check if response is valid JSON
if echo "$RESPONSE" | jq empty 2>/dev/null; then
  echo "✅ Valid JSON response"
  echo ""
  
  # Extract key metrics
  COUNT=$(echo "$RESPONSE" | jq -r '.count // 0')
  FIRST_NAME=$(echo "$RESPONSE" | jq -r '.data[0].applicant_name // "N/A"')
  FIRST_FORM=$(echo "$RESPONSE" | jq -r '.data[0].form_name // "N/A"')
  
  echo "📊 Results:"
  echo "  Total Submissions: $COUNT"
  echo "  First Applicant: $FIRST_NAME"
  echo "  Form: $FIRST_FORM"
  echo ""
  
  # Show first submission (pretty printed)
  echo "📋 First Submission (preview):"
  echo "$RESPONSE" | jq '.data[0] | {
    submission_id,
    applicant_name,
    applicant_email,
    status,
    completion_percentage,
    recommendations_count,
    form_name
  }'
  
  echo ""
  echo "✅ API test successful!"
  echo ""
  echo "💾 Full response saved to: review-export-test.json"
  echo "$RESPONSE" | jq '.' > review-export-test.json
  
else
  echo "❌ Invalid response (not JSON)"
  echo ""
  echo "Response:"
  echo "$RESPONSE"
  exit 1
fi
