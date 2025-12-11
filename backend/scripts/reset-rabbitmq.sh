#!/bin/bash

# Reset RabbitMQ - Clear all queues and restart with clean state
# Use this when you get PRECONDITION_FAILED errors

echo "🐰 Resetting RabbitMQ..."
echo ""

# Stop RabbitMQ
echo "🛑 Stopping RabbitMQ..."
brew services stop rabbitmq
sleep 2

# Remove data directory (clears all queues, exchanges, etc.)
echo "🗑️  Clearing data directory..."
rm -rf /usr/local/var/lib/rabbitmq/mnesia

# Start RabbitMQ
echo "▶️  Starting RabbitMQ..."
brew services start rabbitmq
sleep 5

# Check status
echo ""
echo "✅ RabbitMQ reset complete!"
echo ""
echo "📊 Current status:"
rabbitmqctl status | head -15
echo ""
echo "📦 Queues (should be empty):"
rabbitmqctl list_queues name messages consumers
echo ""
echo "💡 All workers will create queues with correct parameters on first run"
