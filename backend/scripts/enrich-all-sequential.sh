#!/bin/bash

# Sequential Enrichment Script
# Runs enrichment workers in dependency order (smallest to largest)
# 1. Alliances → 2. Corporations → 3. Characters → 4. Types

echo "🚀 Starting Sequential Enrichment (Dependency Order)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Scan killmails for missing entities
echo "📊 Step 1/5: Scanning killmails for missing entities..."
yarn scan:entities
if [ $? -ne 0 ]; then
    echo "❌ Scan failed!"
    exit 1
fi
echo ""

# Step 2: Enrich Alliances (SMALLEST, no dependencies)
echo "🤝 Step 2/5: Enriching Alliances..."
echo "   ⏱️  Expected: ~50-200 alliances (fastest)"
echo "   Starting alliance enrichment worker..."
yarn worker:enrichment:alliances
if [ $? -ne 0 ]; then
    echo "   ⚠️  Alliance enrichment had errors, but continuing..."
fi
echo "   ✅ Alliance enrichment completed"
echo ""

# Step 3: Enrich Corporations (depends on alliances)
echo "🏢 Step 3/5: Enriching Corporations..."
echo "   ⏱️  Expected: ~500-2,000 corporations"
echo "   Note: Corporations reference alliances (alliance_id)"
echo "   Starting corporation enrichment worker..."
yarn worker:enrichment:corporations
if [ $? -ne 0 ]; then
    echo "   ⚠️  Corporation enrichment had errors, but continuing..."
fi
echo "   ✅ Corporation enrichment completed"
echo ""

# Step 4: Enrich Characters (depends on corporations)
echo "👤 Step 4/5: Enriching Characters..."
echo "   ⏱️  Expected: ~5,000-15,000 characters"
echo "   Note: Characters reference corporations (corporation_id)"
echo "   Starting character enrichment worker..."
yarn worker:enrichment:characters
if [ $? -ne 0 ]; then
    echo "   ⚠️  Character enrichment had errors, but continuing..."
fi
echo "   ✅ Character enrichment completed"
echo ""

# Step 5: Enrich Types (LARGEST, no dependencies)
echo "📦 Step 5/5: Enriching Types (ships, items, weapons)..."
echo "   ⏱️  Expected: ~30,000-60,000 types (LONGEST step)"
echo "   Note: No dependencies, just many items"
echo "   Starting type enrichment worker..."
yarn worker:enrichment:types
if [ $? -ne 0 ]; then
    echo "   ⚠️  Type enrichment had errors, but continuing..."
fi
echo "   ✅ Type enrichment completed"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Sequential enrichment completed!"
echo ""
echo "📊 Summary:"
echo "   1. Alliances enriched (smallest)"
echo "   2. Corporations enriched (references alliances)"
echo "   3. Characters enriched (references corporations)"
echo "   4. Types enriched (largest, no dependencies)"
echo ""
echo "🔍 Check database for enriched data:"
echo "   yarn prisma:studio"
echo ""
