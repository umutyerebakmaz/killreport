/**
 * Fetch and display killmail details from ESI
 */

const KILLMAIL_ID = 130966893;

async function fetchKillmailFromZKill() {
  try {
    console.log(`🔍 Fetching killmail ${KILLMAIL_ID} from zKillboard...\n`);

    const zkillUrl = `https://zkillboard.com/api/killID/${KILLMAIL_ID}/`;
    const response = await fetch(zkillUrl);

    if (!response.ok) {
      console.log(`❌ Failed to fetch from zKillboard: ${response.status}`);
      return;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.log('❌ No data returned from zKillboard');
      return;
    }

    const zkillData = data[0];
    const killmail = zkillData.killmail;

    console.log('━'.repeat(70));
    console.log('📋 Killmail Details:');
    console.log('━'.repeat(70));
    console.log(`   Killmail ID: ${killmail.killmail_id}`);
    console.log(`   Time: ${killmail.killmail_time}`);
    console.log(`   System: ${killmail.solar_system_id}`);
    console.log('');
    console.log(`   Victim:`);
    console.log(`      Character: ${killmail.victim.character_id || 'NPC'}`);
    console.log(`      Corporation: ${killmail.victim.corporation_id}`);
    console.log(`      Alliance: ${killmail.victim.alliance_id || 'None'}`);
    console.log(`      Ship: ${killmail.victim.ship_type_id}`);
    console.log('');
    console.log(`   Attackers: ${killmail.attackers.length}`);

    // Count NPCs
    let npcCharCount = 0;
    let npcCorpCount = 0;
    const uniqueCorps = new Set<number>();
    const uniqueChars = new Set<number>();

    killmail.attackers.forEach((attacker: any) => {
      if (!attacker.character_id) {
        npcCharCount++;
      } else {
        uniqueChars.add(attacker.character_id);
      }

      if (attacker.corporation_id) {
        uniqueCorps.add(attacker.corporation_id);
        if (attacker.corporation_id < 2000000) {
          npcCorpCount++;
        }
      }
    });

    console.log(`      - With character_id: ${uniqueChars.size}`);
    console.log(`      - Without character_id (NPCs): ${npcCharCount}`);
    console.log(`      - Unique corporations: ${uniqueCorps.size}`);
    console.log(`      - NPC corporations: ${npcCorpCount}`);
    console.log('');
    console.log(`   Items dropped/destroyed: ${killmail.victim.items?.length || 0}`);
    console.log('━'.repeat(70));

    // Show first few attackers
    console.log('\n📝 Sample Attackers:');
    killmail.attackers.slice(0, 5).forEach((attacker: any, idx: number) => {
      console.log(`   ${idx + 1}. Char: ${attacker.character_id || 'NPC'}, Corp: ${attacker.corporation_id}, Ship: ${attacker.ship_type_id || 'None'}`);
    });

    if (killmail.attackers.length > 5) {
      console.log(`   ... and ${killmail.attackers.length - 5} more`);
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

fetchKillmailFromZKill();
