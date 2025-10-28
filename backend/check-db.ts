import './src/config';
import { pool } from './src/services/database';

async function checkDatabase() {
    try {
        // Total count
        const result = await pool.query('SELECT COUNT(*) FROM "Alliance"');
        const totalCount = parseInt(result.rows[0].count);
        console.log('📊 Number of alliances in database:', totalCount);

        // First and last IDs
        const firstLast = await pool.query(
            'SELECT MIN(id) as first_id, MAX(id) as last_id FROM "Alliance"'
        );
        console.log('🔢 First ID:', firstLast.rows[0].first_id);
        console.log('🔢 Last ID:', firstLast.rows[0].last_id);

        // Last 10 added alliances
        const latest = await pool.query(
            'SELECT id, name, created_at FROM "Alliance" ORDER BY created_at DESC LIMIT 10'
        );
        console.log('\n📋 Last 10 added alliances:');
        latest.rows.forEach((row, idx) => {
            console.log(`  ${idx + 1}. ${row.id}: ${row.name}`);
        });

        // First 10 added alliances
        const earliest = await pool.query(
            'SELECT id, name, created_at FROM "Alliance" ORDER BY created_at ASC LIMIT 10'
        );
        console.log('\n📋 First 10 added alliances:');
        earliest.rows.forEach((row, idx) => {
            console.log(`  ${idx + 1}. ${row.id}: ${row.name}`);
        });

        // Get current count from ESI
        console.log('\n🌐 Checking ESI API...');
        const axios = require('axios');
        const esiResponse = await axios.get('https://esi.evetech.net/latest/alliances/');
        const esiCount = esiResponse.data.length;
        console.log('📊 Number of alliances in ESI:', esiCount);

        console.log('\n' + '='.repeat(50));
        if (totalCount === esiCount) {
            console.log('✅ RESULT: All alliances are in the database!');
        } else {
            console.log('⚠️  RESULT: Missing records!');
            console.log(`   Database: ${totalCount}`);
            console.log(`   ESI: ${esiCount}`);
            console.log(`   Difference: ${esiCount - totalCount}`);
        }
        console.log('='.repeat(50));

        await pool.end();
    } catch (error) {
        console.error('❌ Hata:', error);
        await pool.end();
    }
}

checkDatabase();
