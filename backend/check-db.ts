import './src/config';
import { pool } from './src/services/database';

async function checkDatabase() {
  try {
    // Toplam sayı
    const result = await pool.query('SELECT COUNT(*) FROM "Alliance"');
    const totalCount = parseInt(result.rows[0].count);
    console.log('📊 Veritabanındaki alliance sayısı:', totalCount);

    // İlk ve son ID'ler
    const firstLast = await pool.query(
      'SELECT MIN(id) as first_id, MAX(id) as last_id FROM "Alliance"'
    );
    console.log('🔢 İlk ID:', firstLast.rows[0].first_id);
    console.log('🔢 Son ID:', firstLast.rows[0].last_id);

    // Son eklenen 10 alliance
    const latest = await pool.query(
      'SELECT id, name, created_at FROM "Alliance" ORDER BY created_at DESC LIMIT 10'
    );
    console.log('\n📋 Son eklenen 10 alliance:');
    latest.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.id}: ${row.name}`);
    });

    // İlk eklenen 10 alliance
    const earliest = await pool.query(
      'SELECT id, name, created_at FROM "Alliance" ORDER BY created_at ASC LIMIT 10'
    );
    console.log('\n📋 İlk eklenen 10 alliance:');
    earliest.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.id}: ${row.name}`);
    });

    // ESI'den güncel sayıyı al
    console.log('\n🌐 ESI API kontrolü...');
    const axios = require('axios');
    const esiResponse = await axios.get('https://esi.evetech.net/latest/alliances/');
    const esiCount = esiResponse.data.length;
    console.log('📊 ESI\'deki alliance sayısı:', esiCount);

    console.log('\n' + '='.repeat(50));
    if (totalCount === esiCount) {
      console.log('✅ SONUÇ: Tüm alliance\'lar veritabanında mevcut!');
    } else {
      console.log('⚠️  SONUÇ: Eksik kayıt var!');
      console.log(`   Veritabanı: ${totalCount}`);
      console.log(`   ESI: ${esiCount}`);
      console.log(`   Fark: ${esiCount - totalCount}`);
    }
    console.log('='.repeat(50));

    await pool.end();
  } catch (error) {
    console.error('❌ Hata:', error);
    await pool.end();
  }
}

checkDatabase();
