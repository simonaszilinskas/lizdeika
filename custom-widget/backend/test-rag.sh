#!/bin/bash

# Test RAG system via API
echo "Testing RAG system..."

# Start a conversation
CONV_RESPONSE=$(curl -s -X POST http://localhost:3002/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-rag-session"}')

CONV_ID=$(echo $CONV_RESPONSE | grep -o '"conversationId":"[^"]*"' | cut -d'"' -f4)

echo "Created conversation: $CONV_ID"

# Send a test message
curl -X POST "http://localhost:3002/api/conversations/$CONV_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Kiek kainuoja bibliotekos kortelė?",
    "agentId": "vilnius-assistant"
  }' | jq .

echo -e "\n\nTesting English query..."

# Test English query
curl -X POST "http://localhost:3002/api/conversations/$CONV_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What documents do I need for school registration?",
    "agentId": "vilnius-assistant"
  }' | jq .