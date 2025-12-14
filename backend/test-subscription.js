// Test subscription with curl
const { execSync } = require('child_process');

console.log('Testing GraphQL Subscription...\n');

// Test subscription using SSE
const cmd = `curl -N -H "Accept: text/event-stream" -H "Content-Type: application/json" -X POST http://localhost:4000/graphql -d '{"query":"subscription { newKillmail { id killmailId } }"}' | head -20`;

try {
    const result = execSync(cmd, { timeout: 10000, encoding: 'utf-8' });
    console.log('Subscription response:');
    console.log(result);
} catch (error) {
    console.log('Subscription output (timeout is expected):');
    console.log(error.stdout || error.message);
}
