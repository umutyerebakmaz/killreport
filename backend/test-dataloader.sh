#!/bin/bash

# DataLoader Test Script
# Server'ın çalıştığından emin ol, sonra bu query'leri çalıştır

echo "🧪 Testing DataLoader Batching..."
echo ""

# Test 1: Corporation'ları alliance bilgisi ile çek
echo "📋 Test 1: Fetching corporations with alliances (DataLoader batch expected)"
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { corporations(first: 10) { edges { node { id name alliance { id name } } } } }"
  }' | head -20

echo ""
echo ""

# Test 2: Alliance'ları corporation'ları ile çek
echo "📋 Test 2: Fetching alliances with corporations (DataLoader batch expected)"
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { alliances(first: 5) { edges { node { id name corporations(first: 3) { edges { node { id name } } } } } } }"
  }' | head -20

echo ""
echo ""
echo "✅ Check server console for DataLoader batch logs!"
echo "   Look for: 🔄 DataLoader: Batching X queries"
