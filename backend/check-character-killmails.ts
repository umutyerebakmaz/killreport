import './src/config';
import prisma from './src/services/prisma';

const characterId = 365974960;

async function checkKillmails() {
    const victim = await prisma.victim.count({
        where: { character_id: characterId }
    });

    const attacker = await prisma.attacker.count({
        where: { character_id: characterId }
    });

    console.log(`Character ID: ${characterId}`);
    console.log(`As Victim: ${victim} killmails`);
    console.log(`As Attacker: ${attacker} killmails`);
    console.log(`Total: ${victim + attacker} killmails`);

    await prisma.$disconnect();
}

checkKillmails();
