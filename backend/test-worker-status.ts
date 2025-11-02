import './src/config';
import { getAllQueueStats } from './src/services/rabbitmq';

async function test() {
    console.log('🧪 Testing getAllQueueStats...\n');

    try {
        const stats = await getAllQueueStats();
        console.log('✅ Success!');
        console.log(JSON.stringify(stats, null, 2));
    } catch (error) {
        console.error('❌ Error:', error);
    }

    process.exit(0);
}

test();
