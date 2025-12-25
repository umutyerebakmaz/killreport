import { createRedisEventTarget } from '@graphql-yoga/redis-event-target';
import { createPubSub } from 'graphql-yoga';
import Redis from 'ioredis';

console.log('🧪 Testing Redis PubSub Connection...\n');

const REDIS_URL = 'redis://localhost:6379';

async function testRedisPubSub() {
  try {
    console.log('📡 Creating Redis clients...');
    const publishClient = new Redis(REDIS_URL);
    const subscribeClient = new Redis(REDIS_URL);

    publishClient.on('error', (err) => {
      console.error('❌ Publish client error:', err.message);
    });

    subscribeClient.on('error', (err) => {
      console.error('❌ Subscribe client error:', err.message);
    });

    console.log('✅ Redis clients created');

    console.log('\n🔗 Testing Redis connection...');
    const pingResult = await publishClient.ping();
    console.log('✅ Redis PING:', pingResult);

    console.log('\n📢 Creating PubSub with Redis event target...');
    const pubsub = createPubSub({
      eventTarget: createRedisEventTarget({
        publishClient,
        subscribeClient,
      })
    });
    console.log('✅ PubSub created successfully');

    console.log('\n📩 Testing publish/subscribe...');

    // Subscribe to test channel using async iterator
    const asyncIterator = pubsub.subscribe('TEST_CHANNEL');
    let messageReceived = false;

    // Start listening in background
    (async () => {
      for await (const message of asyncIterator) {
        console.log('✅ Message received:', message);
        messageReceived = true;
        break; // Exit after first message
      }
    })();

    // Wait for subscription to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Publish a test message
    console.log('📤 Publishing test message...');
    await pubsub.publish('TEST_CHANNEL', { test: 'Hello Redis PubSub!' });

    // Wait for message
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (messageReceived) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ SUCCESS! Redis PubSub is working correctly!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      console.log('\n❌ FAILED: Message was not received');
    }

    // Cleanup
    await publishClient.quit();
    await subscribeClient.quit();

    process.exit(messageReceived ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n💡 Make sure Redis is running:');
    console.error('   brew services start redis');
    console.error('   redis-cli ping\n');
    process.exit(1);
  }
}


testRedisPubSub();
