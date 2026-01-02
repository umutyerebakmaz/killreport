/**
 * Redis PubSub Diagnostic Script
 * 
 * This script performs comprehensive testing of Redis PubSub functionality
 * to help diagnose production issues.
 * 
 * Tests:
 * 1. Basic Redis connection (PING)
 * 2. PubSub publish/subscribe
 * 3. Connection error handling
 * 4. Environment variable validation
 * 
 * Usage:
 *   yarn ts-node redis/diagnose-redis-pubsub.ts
 */

import { createRedisEventTarget } from '@graphql-yoga/redis-event-target';
import { createPubSub } from 'graphql-yoga';
import Redis from 'ioredis';
import '../src/config'; // Load environment variables

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║      Redis PubSub Diagnostic Tool                       ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const USE_REDIS_PUBSUB = process.env.USE_REDIS_PUBSUB;

async function diagnose() {
  console.log('📋 Step 1: Environment Variables Check');
  console.log('─'.repeat(60));
  console.log('  REDIS_URL:', REDIS_URL.replace(/:[^:]*@/, ':****@'));
  console.log('  USE_REDIS_PUBSUB:', USE_REDIS_PUBSUB);
  
  if (USE_REDIS_PUBSUB !== 'true') {
    console.error('\n❌ USE_REDIS_PUBSUB is not set to "true"');
    console.error('   Real-time updates will use in-memory PubSub (single process only)');
    console.error('   Set USE_REDIS_PUBSUB=true in .env to enable Redis PubSub\n');
    return;
  }
  console.log('✅ Environment variables configured\n');

  console.log('📋 Step 2: Redis Connection Test');
  console.log('─'.repeat(60));
  
  let publishClient: Redis | null = null;
  let subscribeClient: Redis | null = null;
  
  try {
    // Create Redis clients with explicit configuration
    console.log('  Creating Redis clients...');
    publishClient = new Redis(REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });

    subscribeClient = new Redis(REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });

    // Add error handlers
    publishClient.on('error', (err) => {
      console.error('  ❌ Publish client error:', err.message);
    });

    subscribeClient.on('error', (err) => {
      console.error('  ❌ Subscribe client error:', err.message);
    });

    publishClient.on('connect', () => {
      console.log('  ✅ Publish client connected');
    });

    subscribeClient.on('connect', () => {
      console.log('  ✅ Subscribe client connected');
    });

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test PING
    console.log('\n  Testing PING command...');
    const pingResult = await publishClient.ping();
    console.log('  ✅ PING response:', pingResult);

    console.log('\n  Redis connection status:');
    console.log('    Publish client:', publishClient.status);
    console.log('    Subscribe client:', subscribeClient.status);

    if (publishClient.status !== 'ready' || subscribeClient.status !== 'ready') {
      console.error('\n  ❌ Redis clients are not ready!');
      console.error('    This will prevent PubSub from working');
      throw new Error('Redis clients not ready');
    }

    console.log('\n✅ Redis connection successful\n');

  } catch (error: any) {
    console.error('\n❌ Redis connection failed:', error.message);
    console.error('\n💡 Troubleshooting tips:');
    console.error('   1. Verify Redis is running: redis-cli ping');
    console.error('   2. Check REDIS_URL format: redis://[user:password@]host:port[/db]');
    console.error('   3. For production: Ensure TLS is configured if required');
    console.error('   4. Check firewall rules and network connectivity');
    console.error('   5. Verify Redis authentication if password is required\n');
    
    if (publishClient) await publishClient.quit();
    if (subscribeClient) await subscribeClient.quit();
    return;
  }

  console.log('📋 Step 3: GraphQL Yoga PubSub Test');
  console.log('─'.repeat(60));

  try {
    console.log('  Creating PubSub with Redis event target...');
    
    const pubsub = createPubSub({
      eventTarget: createRedisEventTarget({
        publishClient: publishClient!,
        subscribeClient: subscribeClient!,
      })
    });

    console.log('  ✅ PubSub created successfully\n');

    console.log('  Testing publish/subscribe...');
    
    // Subscribe to test channel
    const asyncIterator = pubsub.subscribe('TEST_CHANNEL');
    let messageReceived = false;
    let receivedMessage: any = null;

    // Start listening in background
    const listenerPromise = (async () => {
      for await (const message of asyncIterator) {
        console.log('  ✅ Message received:', JSON.stringify(message));
        receivedMessage = message;
        messageReceived = true;
        break;
      }
    })();

    // Wait for subscription to be ready
    console.log('  Waiting for subscription to be ready...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Publish a test message
    console.log('  Publishing test message...');
    await pubsub.publish('TEST_CHANNEL', { test: 'Hello from diagnostic script!', timestamp: new Date().toISOString() });

    // Wait for message
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (messageReceived) {
      console.log('\n✅ PubSub test successful!');
      console.log('   Published message was received by subscriber\n');
    } else {
      console.error('\n❌ PubSub test failed: Message was not received');
      console.error('   This indicates a problem with Redis PubSub configuration\n');
    }

  } catch (error: any) {
    console.error('\n❌ PubSub test failed:', error.message);
    console.error('   Stack:', error.stack);
  }

  console.log('📋 Step 4: NEW_KILLMAIL Subscription Test');
  console.log('─'.repeat(60));

  try {
    console.log('  Creating PubSub with NEW_KILLMAIL channel...');
    
    type PubSubChannels = {
      'NEW_KILLMAIL': [{ killmailId: number }];
    };

    const pubsub = createPubSub<PubSubChannels>({
      eventTarget: createRedisEventTarget({
        publishClient: publishClient!,
        subscribeClient: subscribeClient!,
      })
    });

    console.log('  ✅ PubSub created\n');

    console.log('  Testing NEW_KILLMAIL publish/subscribe...');
    
    // Subscribe to NEW_KILLMAIL channel
    const asyncIterator = pubsub.subscribe('NEW_KILLMAIL');
    let killmailReceived = false;

    // Start listening
    (async () => {
      for await (const message of asyncIterator) {
        console.log('  ✅ NEW_KILLMAIL received:', JSON.stringify(message));
        killmailReceived = true;
        break;
      }
    })();

    // Wait for subscription
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Publish test killmail
    console.log('  Publishing test NEW_KILLMAIL event...');
    await pubsub.publish('NEW_KILLMAIL', {
      killmailId: 999999999,
    });

    // Wait for message
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (killmailReceived) {
      console.log('\n✅ NEW_KILLMAIL test successful!');
      console.log('   Real-time killmail updates should work in production\n');
    } else {
      console.error('\n❌ NEW_KILLMAIL test failed');
      console.error('   Real-time updates will NOT work!\n');
    }

  } catch (error: any) {
    console.error('\n❌ NEW_KILLMAIL test failed:', error.message);
  }

  // Cleanup
  console.log('📋 Cleanup');
  console.log('─'.repeat(60));
  console.log('  Closing Redis connections...');
  
  if (publishClient) {
    await publishClient.quit();
    console.log('  ✅ Publish client closed');
  }
  
  if (subscribeClient) {
    await subscribeClient.quit();
    console.log('  ✅ Subscribe client closed');
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║      Diagnostic Complete                                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Diagnostic failed:', error);
    process.exit(1);
  });
