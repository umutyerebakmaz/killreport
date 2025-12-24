#!/bin/bash

# Test script to create a fake killmail and test the subscription system

echo "🧪 Testing New Killmail Subscription System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if backend is running
if ! curl -s http://localhost:4000/graphql > /dev/null; then
    echo "❌ Backend is not running on port 4000"
    echo "   Start it with: cd backend && yarn dev"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Check if frontend is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "⚠️  Frontend is not running on port 3000"
    echo "   Start it with: cd frontend && yarn dev"
    echo ""
fi

echo "📋 Test Steps:"
echo "1. Open browser: http://localhost:3000/killmails"
echo "2. Open browser console (F12)"
echo "3. Run this command in another terminal:"
echo ""
echo "   cd backend && yarn queue:user-killmails && yarn worker:user-killmails"
echo ""
echo "4. Watch the console for subscription events:"
echo "   - 🔔 Subscription state"
echo "   - 📨 New killmail received"
echo ""
echo "5. New killmails should appear at the top of the list with animation"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
