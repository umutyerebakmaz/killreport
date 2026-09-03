import '../src/config';

console.log('🧪 Testing Redis Connection...\n');

async function testRedis() {
  try {
    const Redis = (await import('ioredis')).default;

    console.log('📡 Connecting to Redis...');
    const redis = new Redis('redis://localhost:6379');

    redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    console.log('✅ Redis client created');

    console.log('\n🔗 Testing PING...');
    const pingResult = await redis.ping();
    console.log('✅ Redis PING:', pingResult);

    console.log('\n📝 Testing SET/GET...');
    await redis.set('test:key', 'Hello Redis!');
    const value = await redis.get('test:key');
    console.log('✅ Value retrieved:', value);

    console.log('\n🗑️  Cleaning up...');
    await redis.del('test:key');
    await redis.quit();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SUCCESS! Redis is working correctly!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Redis PubSub is ready for use in your application.\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n💡 Make sure Redis is running:');
    console.error('   brew services start redis');
    console.error('   redis-cli ping\n');
    process.exit(1);
  }
}

testRedis();
