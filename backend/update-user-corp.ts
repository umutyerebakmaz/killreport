import './src/config';
import { CharacterService } from './src/services/character/character.service';
import prisma from './src/services/prisma';

async function updateUserCorp() {
    // Fetch character info from ESI
    const characterId = 365974960;
    console.log(`Fetching info for character ${characterId}...`);

    const characterInfo = await CharacterService.getCharacterInfo(characterId);
    console.log('Character Info:', JSON.stringify(characterInfo, null, 2));

    // Update user with corporation_id
    const user = await prisma.user.update({
        where: { character_id: characterId },
        data: {
            corporation_id: characterInfo.corporation_id,
        },
    });

    console.log('\n✅ Updated user:');
    console.log(`  - Character: ${user.character_name}`);
    console.log(`  - Corporation ID: ${user.corporation_id}`);

    await prisma.$disconnect();
}

updateUserCorp();
