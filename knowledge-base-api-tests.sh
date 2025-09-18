#!/bin/bash

# Knowledge Base API Test Suite
# Comprehensive testing of all knowledge base functionality
# Tests embeddings, RAG system, document processing, and AI integration

set -e  # Exit on any error

# Configuration
BASE_URL="http://localhost:3002"
TEST_USER_EMAIL="admin@vilnius.lt"
TEST_USER_PASSWORD="admin123"
TEST_DATA_DIR="test-data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to log test results
log_test() {
    local test_name=$1
    local status=$2
    local details=$3

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ "$status" = "PASS" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        print_status $GREEN "✓ $test_name"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        print_status $RED "✗ $test_name"
        if [ -n "$details" ]; then
            print_status $RED "  Details: $details"
        fi
    fi
}

# Function to check HTTP status
check_status() {
    local expected=$1
    local actual=$2
    local test_name=$3

    if [ "$actual" -eq "$expected" ]; then
        log_test "$test_name" "PASS"
        return 0
    else
        log_test "$test_name" "FAIL" "Expected HTTP $expected, got $actual"
        return 1
    fi
}

# Function to check if JSON contains expected fields
check_json_field() {
    local json=$1
    local field=$2
    local test_name=$3

    if echo "$json" | jq -e ".$field" > /dev/null 2>&1; then
        log_test "$test_name" "PASS"
        return 0
    else
        log_test "$test_name" "FAIL" "JSON missing field: $field"
        return 1
    fi
}

print_status $BLUE "🧪 Starting Knowledge Base API Test Suite"
print_status $BLUE "=========================================="

# Create test data directory
mkdir -p $TEST_DATA_DIR

print_status $YELLOW "📋 Phase 1: Authentication & Setup"

# Test 1: Authentication
print_status $BLUE "Getting authentication token..."
AUTH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}" \
  -w "HTTPSTATUS:%{http_code}")

HTTP_STATUS=$(echo $AUTH_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
AUTH_BODY=$(echo $AUTH_RESPONSE | sed -e 's/HTTPSTATUS:.*//')

check_status 200 $HTTP_STATUS "Authentication"

if [ "$HTTP_STATUS" -eq 200 ]; then
    TOKEN=$(echo $AUTH_BODY | jq -r '.data.tokens.accessToken')
    if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
        log_test "Token extraction" "PASS"
        print_status $GREEN "Auth token: ${TOKEN:0:20}..."
    else
        log_test "Token extraction" "FAIL" "No token in response"
        exit 1
    fi
else
    print_status $RED "Authentication failed. Cannot continue tests."
    exit 1
fi

print_status $YELLOW "📋 Phase 2: Baseline API Testing"

# Test 2: Knowledge Stats
print_status $BLUE "Testing knowledge stats endpoint..."
STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/knowledge/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -w "HTTPSTATUS:%{http_code}")

HTTP_STATUS=$(echo $STATS_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
STATS_BODY=$(echo $STATS_RESPONSE | sed -e 's/HTTPSTATUS:.*//')

check_status 200 $HTTP_STATUS "Knowledge stats endpoint"
if [ "$HTTP_STATUS" -eq 200 ]; then
    check_json_field "$STATS_BODY" "data" "Stats contains data field"
    check_json_field "$STATS_BODY" "data.totalDocuments" "Stats contains documents count"

    # Display current stats
    CURRENT_DOCS=$(echo $STATS_BODY | jq -r '.data.totalDocuments // 0')
    CURRENT_CHUNKS=$(echo $STATS_BODY | jq -r '.data.totalChunks // 0')
    print_status $GREEN "Current stats: $CURRENT_DOCS documents, $CURRENT_CHUNKS chunks"

    # Check AI provider info from indexed endpoint
    PROVIDER_INFO=$(curl -s -X GET "$BASE_URL/api/knowledge/indexed" -H "Authorization: Bearer $TOKEN")
    AI_PROVIDER_STATUS=$(echo $PROVIDER_INFO | jq -r '.data.note // "External vector DB"')
    print_status $BLUE "AI Provider: $AI_PROVIDER_STATUS"
fi

# Test 3: Document Listing
print_status $BLUE "Testing document listing endpoint..."
DOCS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/knowledge/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -w "HTTPSTATUS:%{http_code}")

HTTP_STATUS=$(echo $DOCS_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
check_status 200 $HTTP_STATUS "Document listing endpoint"

# Test 4: Vector Database Status
print_status $BLUE "Testing vector database status..."
INDEXED_RESPONSE=$(curl -s -X GET "$BASE_URL/api/knowledge/indexed" \
  -H "Authorization: Bearer $TOKEN" \
  -w "HTTPSTATUS:%{http_code}")

HTTP_STATUS=$(echo $INDEXED_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
check_status 200 $HTTP_STATUS "Vector database status endpoint"

print_status $YELLOW "📋 Phase 3: Document Upload & Processing Tests"

# Create test documents
print_status $BLUE "Creating test documents..."
cat > $TEST_DATA_DIR/test-document.txt << EOF
Vilnius municipal services include waste management, public transportation, and citizen support.
The municipality provides assistance with permits and documentation for residents.
Citizens can apply for housing permits, business licenses, and community programs through the city administration.
Public transportation in Vilnius includes buses and trolleybuses serving all districts.
For waste management services, residents should contact the municipal environmental department.
EOF

cat > $TEST_DATA_DIR/test-doc-1.txt << EOF
Vilnius city administration offers various services including housing permits and business registration.
The municipal office processes applications for construction permits and zoning approvals.
Citizens can access online services for tax payments and document requests.
EOF

cat > $TEST_DATA_DIR/test-doc-2.txt << EOF
Public services in Vilnius include healthcare facilities, educational institutions, and cultural centers.
The city provides social services for elderly residents and family support programs.
Municipal libraries offer digital services and community programs throughout the year.
EOF

# Test 5: Text Document Upload
print_status $BLUE "Testing document upload..."
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/knowledge/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_DATA_DIR/test-document.txt" \
  -w "HTTPSTATUS:%{http_code}")

HTTP_STATUS=$(echo $UPLOAD_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
UPLOAD_BODY=$(echo $UPLOAD_RESPONSE | sed -e 's/HTTPSTATUS:.*//')

if [ "$HTTP_STATUS" -eq 201 ] || [ "$HTTP_STATUS" -eq 200 ]; then
    log_test "Document upload" "PASS"
    if echo "$UPLOAD_BODY" | jq -e '.id' > /dev/null 2>&1; then
        UPLOADED_DOC_ID=$(echo $UPLOAD_BODY | jq -r '.id')
        print_status $GREEN "Uploaded document ID: $UPLOADED_DOC_ID"
    fi
else
    log_test "Document upload" "FAIL" "HTTP status: $HTTP_STATUS"
fi

# Test 6: Wait for processing and check stats
print_status $BLUE "Waiting for document processing..."
sleep 10

NEW_STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/knowledge/stats" \
  -H "Authorization: Bearer $TOKEN")

NEW_DOCS=$(echo $NEW_STATS_RESPONSE | jq -r '.data.totalDocuments // 0')
NEW_CHUNKS=$(echo $NEW_STATS_RESPONSE | jq -r '.data.totalChunks // 0')

if [ "$NEW_DOCS" -gt "$CURRENT_DOCS" ]; then
    log_test "Document count increased" "PASS"
    print_status $GREEN "Documents increased from $CURRENT_DOCS to $NEW_DOCS"
else
    log_test "Document count increased" "FAIL" "Count did not increase: $CURRENT_DOCS -> $NEW_DOCS"
fi

if [ "$NEW_CHUNKS" -gt "$CURRENT_CHUNKS" ]; then
    log_test "Document chunks generated" "PASS"
    print_status $GREEN "Chunks increased from $CURRENT_CHUNKS to $NEW_CHUNKS"
else
    log_test "Document chunks generated" "FAIL" "Chunks did not increase: $CURRENT_CHUNKS -> $NEW_CHUNKS"
fi

print_status $YELLOW "📋 Phase 4: Vector Search Tests (CRITICAL)"

# Test 7: Vector Search - Basic Query
print_status $BLUE "Testing vector search..."
SEARCH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/knowledge/documents/search?query=vilnius+municipal+services" \
  -H "Authorization: Bearer $TOKEN" \
  -w "HTTPSTATUS:%{http_code}")

HTTP_STATUS=$(echo $SEARCH_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
SEARCH_BODY=$(echo $SEARCH_RESPONSE | sed -e 's/HTTPSTATUS:.*//')

check_status 200 $HTTP_STATUS "Vector search endpoint"

if [ "$HTTP_STATUS" -eq 200 ]; then
    # Check if results are returned
    RESULTS_COUNT=$(echo $SEARCH_BODY | jq '.results | length' 2>/dev/null || echo "0")
    if [ "$RESULTS_COUNT" -gt 0 ]; then
        log_test "Vector search returns results" "PASS"
        print_status $GREEN "Found $RESULTS_COUNT search results"

        # Display first result content (truncated)
        FIRST_RESULT=$(echo $SEARCH_BODY | jq -r '.results[0].content' 2>/dev/null | head -c 100)
        print_status $GREEN "First result: $FIRST_RESULT..."
    else
        log_test "Vector search returns results" "FAIL" "No results returned"
    fi
fi

# Test 8: Multiple Search Queries
print_status $BLUE "Testing multiple search queries..."
QUERIES=("municipal assistance" "permits documentation" "public transportation" "city services")

for query in "${QUERIES[@]}"; do
    QUERY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/knowledge/documents/search?query=$query" \
      -H "Authorization: Bearer $TOKEN" \
      -w "HTTPSTATUS:%{http_code}")

    HTTP_STATUS=$(echo $QUERY_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

    if [ "$HTTP_STATUS" -eq 200 ]; then
        log_test "Search query: $query" "PASS"
    else
        log_test "Search query: $query" "FAIL" "HTTP status: $HTTP_STATUS"
    fi
done

print_status $YELLOW "📋 Phase 5: AI Integration & RAG System Tests (CRITICAL)"

# Test 9: Create Test Conversation
print_status $BLUE "Creating test conversation for RAG testing..."
CONV_RESPONSE=$(curl -s -X POST "$BASE_URL/api/conversations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","subject":"Test RAG System"}' \
  -w "HTTPSTATUS:%{http_code}")

HTTP_STATUS=$(echo $CONV_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
CONV_BODY=$(echo $CONV_RESPONSE | sed -e 's/HTTPSTATUS:.*//')

if [ "$HTTP_STATUS" -eq 201 ] || [ "$HTTP_STATUS" -eq 200 ]; then
    CONVERSATION_ID=$(echo $CONV_BODY | jq -r '.id')
    log_test "Conversation creation" "PASS"
    print_status $GREEN "Created conversation: $CONVERSATION_ID"
else
    log_test "Conversation creation" "FAIL" "HTTP status: $HTTP_STATUS"
    # Can't continue RAG tests without conversation
    print_status $RED "Cannot continue RAG tests without conversation"
fi

# Test 10: Send Message Requiring Knowledge Base
if [ -n "$CONVERSATION_ID" ] && [ "$CONVERSATION_ID" != "null" ]; then
    print_status $BLUE "Sending message that requires knowledge base..."
    MSG_RESPONSE=$(curl -s -X POST "$BASE_URL/api/messages" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"conversation_id\":\"$CONVERSATION_ID\",\"content\":\"How can I get municipal services in Vilnius? What permits do I need for housing?\",\"sender_type\":\"customer\"}" \
      -w "HTTPSTATUS:%{http_code}")

    HTTP_STATUS=$(echo $MSG_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

    if [ "$HTTP_STATUS" -eq 201 ] || [ "$HTTP_STATUS" -eq 200 ]; then
        log_test "Message sending" "PASS"

        # Test 11: Wait and Check AI Suggestion
        print_status $BLUE "Waiting for AI suggestion generation..."
        sleep 20  # Give more time for AI processing

        AI_RESPONSE=$(curl -s -X GET "$BASE_URL/api/conversations/$CONVERSATION_ID/ai-suggestion" \
          -H "Authorization: Bearer $TOKEN" \
          -w "HTTPSTATUS:%{http_code}")

        HTTP_STATUS=$(echo $AI_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
        AI_BODY=$(echo $AI_RESPONSE | sed -e 's/HTTPSTATUS:.*//')

        if [ "$HTTP_STATUS" -eq 200 ]; then
            log_test "AI suggestion endpoint" "PASS"

            # Check if suggestion exists
            HAS_SUGGESTION=$(echo $AI_BODY | jq -r '.suggestion != null and .suggestion != ""' 2>/dev/null || echo "false")
            if [ "$HAS_SUGGESTION" = "true" ]; then
                log_test "AI suggestion generated" "PASS"

                # Check if context from knowledge base is used
                HAS_CONTEXT=$(echo $AI_BODY | jq -r '.context_used != null' 2>/dev/null || echo "false")
                if [ "$HAS_CONTEXT" = "true" ]; then
                    log_test "RAG context usage" "PASS"
                    print_status $GREEN "✓ CRITICAL: RAG system is working - AI used knowledge base context"
                else
                    log_test "RAG context usage" "FAIL" "No context from knowledge base used"
                fi

                # Display suggestion preview
                SUGGESTION_PREVIEW=$(echo $AI_BODY | jq -r '.suggestion' 2>/dev/null | head -c 150)
                print_status $GREEN "AI suggestion preview: $SUGGESTION_PREVIEW..."
            else
                log_test "AI suggestion generated" "FAIL" "No suggestion in response"
            fi
        else
            log_test "AI suggestion endpoint" "FAIL" "HTTP status: $HTTP_STATUS"
        fi
    else
        log_test "Message sending" "FAIL" "HTTP status: $HTTP_STATUS"
    fi
fi

print_status $YELLOW "📋 Phase 6: Error Handling Tests"

# Test 12: Invalid File Upload
print_status $BLUE "Testing invalid file upload..."
echo "invalid content" > $TEST_DATA_DIR/invalid.xyz
INVALID_RESPONSE=$(curl -s -X POST "$BASE_URL/api/knowledge/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_DATA_DIR/invalid.xyz" \
  -w "HTTPSTATUS:%{http_code}")

HTTP_STATUS=$(echo $INVALID_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

# Should return 400 or similar error status
if [ "$HTTP_STATUS" -ge 400 ] && [ "$HTTP_STATUS" -lt 500 ]; then
    log_test "Invalid file upload error handling" "PASS"
else
    log_test "Invalid file upload error handling" "FAIL" "Expected 4xx status, got $HTTP_STATUS"
fi

# Test 13: Empty Search Query
print_status $BLUE "Testing empty search query..."
EMPTY_SEARCH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/knowledge/documents/search?query=" \
  -H "Authorization: Bearer $TOKEN" \
  -w "HTTPSTATUS:%{http_code}")

HTTP_STATUS=$(echo $EMPTY_SEARCH_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

# Should handle empty query gracefully (200 with empty results or 400)
if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 400 ]; then
    log_test "Empty search query handling" "PASS"
else
    log_test "Empty search query handling" "FAIL" "Unexpected status: $HTTP_STATUS"
fi

# Test 14: Invalid Document ID
print_status $BLUE "Testing invalid document ID..."
INVALID_DOC_RESPONSE=$(curl -s -X GET "$BASE_URL/api/knowledge/documents/invalid-id-123" \
  -H "Authorization: Bearer $TOKEN" \
  -w "HTTPSTATUS:%{http_code}")

HTTP_STATUS=$(echo $INVALID_DOC_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

if [ "$HTTP_STATUS" -eq 404 ]; then
    log_test "Invalid document ID error handling" "PASS"
else
    log_test "Invalid document ID error handling" "FAIL" "Expected 404, got $HTTP_STATUS"
fi

print_status $YELLOW "📋 Phase 7: Performance Check"

# Test 15: System Health
print_status $BLUE "Checking system health..."
HEALTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/health" \
  -w "HTTPSTATUS:%{http_code}")

HTTP_STATUS=$(echo $HEALTH_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
check_status 200 $HTTP_STATUS "System health check"

# Cleanup
print_status $BLUE "Cleaning up test files..."
rm -rf $TEST_DATA_DIR

print_status $BLUE "🏁 Test Suite Complete"
print_status $BLUE "====================="

# Final results
print_status $GREEN "Tests Run: $TESTS_RUN"
print_status $GREEN "Tests Passed: $TESTS_PASSED"
if [ $TESTS_FAILED -gt 0 ]; then
    print_status $RED "Tests Failed: $TESTS_FAILED"
else
    print_status $GREEN "Tests Failed: $TESTS_FAILED"
fi

# Calculate success rate
SUCCESS_RATE=$(( (TESTS_PASSED * 100) / TESTS_RUN ))
print_status $BLUE "Success Rate: $SUCCESS_RATE%"

# Overall result
if [ $TESTS_FAILED -eq 0 ]; then
    print_status $GREEN "🎉 ALL TESTS PASSED - Knowledge base system is working correctly!"
    exit 0
else
    print_status $RED "❌ SOME TESTS FAILED - Please review failures before proceeding with migration"
    exit 1
fi