#!/bin/bash

# Test Killmail Queries

echo "========================================"
echo "🧪 Testing Killmail GraphQL Queries"
echo "========================================"
echo ""

# Test 1: Get all killmails (paginated)
echo "📝 Test 1: Get All Killmails (first 3)"
echo "----------------------------------------"
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { killmails(first: 3) { edges { node { id killmailId killmailTime solarSystem { name } victim { character { name } shipType { name } } attackers { character { name } finalBlow } } } pageInfo { totalCount currentPage } } }"
  }' | jq '.'

echo ""
echo ""

# Test 2: Get single killmail by ID
echo "📝 Test 2: Get Single Killmail (if exists)"
echo "----------------------------------------"
KILLMAIL_ID=$(psql $DATABASE_URL -t -c "SELECT killmail_id FROM killmails LIMIT 1;" 2>/dev/null | xargs)
if [ ! -z "$KILLMAIL_ID" ]; then
  curl -s -X POST http://localhost:4000/graphql \
    -H "Content-Type: application/json" \
    -d "{
      \"query\": \"query { killmail(id: \\\"$KILLMAIL_ID\\\") { id killmailTime solarSystem { name securityStatus } victim { character { name } corporation { name } alliance { name } shipType { name group { name } } damageTaken } attackers { character { name } shipType { name } weaponType { name } finalBlow damageDone } items { itemType { name } quantityDropped quantityDestroyed } } }\"
    }" | jq '.'
else
  echo "No killmails found in database"
fi

echo ""
echo ""

# Test 3: Character killmails
echo "📝 Test 3: Character Killmails"
echo "----------------------------------------"
CHARACTER_ID=$(psql $DATABASE_URL -t -c "SELECT COALESCE(v.character_id, a.character_id) FROM killmails k LEFT JOIN victims v ON v.killmail_id = k.killmail_id LEFT JOIN attackers a ON a.killmail_id = k.killmail_id WHERE v.character_id IS NOT NULL OR a.character_id IS NOT NULL LIMIT 1;" 2>/dev/null | xargs)
if [ ! -z "$CHARACTER_ID" ]; then
  curl -s -X POST http://localhost:4000/graphql \
    -H "Content-Type: application/json" \
    -d "{
      \"query\": \"query { characterKillmails(characterId: $CHARACTER_ID, first: 2) { edges { node { id killmailTime victim { character { name } } } } pageInfo { totalCount } } }\"
    }" | jq '.'
else
  echo "No character killmails found"
fi

echo ""
echo ""

echo "========================================"
echo "✅ Tests Complete"
echo "========================================"
