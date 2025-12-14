// Test GraphQL Yoga subscription directly
const http = require('http');

const postData = JSON.stringify({
    query: 'subscription { newKillmail { id killmailId } }',
});

const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/graphql',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Content-Length': Buffer.byteLength(postData),
    },
};

console.log('🧪 Testing GraphQL Yoga SSE subscription...\n');

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    console.log('\n📡 Waiting for events...\n');

    res.on('data', (chunk) => {
        console.log('📨 Received:', chunk.toString());
    });

    res.on('end', () => {
        console.log('\n✅ Connection ended');
    });
});

req.on('error', (e) => {
    console.error(`❌ Error: ${e.message}`);
});

req.write(postData);
req.end();

// Keep alive for 30 seconds
setTimeout(() => {
    console.log('\n⏱️  30 seconds elapsed, closing...');
    process.exit(0);
}, 30000);
