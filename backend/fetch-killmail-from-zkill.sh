#!/bin/bash

# Fetch killmail from zKillboard and save to database
# Usage: ./fetch-killmail-from-zkill.sh <killmail_id>

if [ -z "$1" ]; then
    echo ""
    echo "❌ Usage: ./fetch-killmail-from-zkill.sh <killmail_id>"
    echo "   Example: ./fetch-killmail-from-zkill.sh 131757087"
    echo ""
    exit 1
fi

KILLMAIL_ID=$1

echo ""
echo "=========================================="
echo "🔍 Fetching Killmail $KILLMAIL_ID from zKillboard"
echo "=========================================="
echo ""

# Fetch from zKillboard
echo "📡 Querying zKillboard API..."
ZKILL_DATA=$(curl -s "https://zkillboard.com/api/killID/$KILLMAIL_ID/" -H "User-Agent: KillReport/1.0")

# Check if data is empty
if [ -z "$ZKILL_DATA" ] || [ "$ZKILL_DATA" = "[]" ]; then
    echo "❌ Killmail $KILLMAIL_ID not found on zKillboard"
    echo ""
    exit 1
fi

# Extract hash using jq
KILLMAIL_HASH=$(echo "$ZKILL_DATA" | jq -r '.[0].zkb.hash // empty')

if [ -z "$KILLMAIL_HASH" ]; then
    echo "❌ Could not extract killmail hash from zKillboard response"
    echo ""
    exit 1
fi

echo "✅ Found killmail hash: $KILLMAIL_HASH"
echo ""

# Fetch and save to database
echo "📥 Fetching from ESI and saving to database..."
echo ""

yarn fetch:killmail "$KILLMAIL_ID" "$KILLMAIL_HASH"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✨ Successfully saved killmail $KILLMAIL_ID"
    echo "=========================================="
    echo ""
else
    echo ""
    echo "❌ Failed to save killmail"
    echo ""
    exit 1
fi
