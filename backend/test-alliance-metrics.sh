#!/bin/bash

# Alliance Snapshot ve Metrics Test Script
# Bu script alliance snapshot sistemini test eder

echo "🧪 Alliance Snapshot Sistemi Test Ediliyor..."
echo ""

# GraphQL endpoint
ENDPOINT="http://localhost:4000/graphql"

# Test query - İlk alliance'ı al ve metrics'i kontrol et
QUERY='
query TestAllianceMetrics {
  alliances(filter: { limit: 1 }) {
    edges {
      node {
        id
        name
        memberCount
        corporationCount
        metrics {
          memberCountDelta7d
          memberCountDelta30d
          corporationCountDelta7d
          corporationCountDelta30d
          memberCountGrowthRate7d
          memberCountGrowthRate30d
        }
        snapshots(days: 7) {
          date
          memberCount
          corporationCount
        }
      }
    }
  }
}
'

echo "📊 Query çalıştırılıyor..."
echo ""

# GraphQL query'yi çalıştır
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{\"query\":$(echo "$QUERY" | jq -Rs .)}" \
  | jq '.'

echo ""
echo "✅ Test tamamlandı!"
echo ""
echo "📝 Not: Eğer metrics null dönüyorsa, henüz yeterli snapshot verisi olmayabilir."
echo "   Çözüm: 'yarn snapshot:alliances' komutunu çalıştırın."
