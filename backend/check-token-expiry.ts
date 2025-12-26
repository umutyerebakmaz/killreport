import './src/config';
import prisma from './src/services/prisma';

async function checkTokenExpiry() {
    const user = await prisma.user.findFirst({
        where: { character_id: 365974960 },
        select: {
            id: true,
            character_name: true,
            corporation_id: true,
            expires_at: true,
            refresh_token: true,
        },
    });

    if (!user) {
        console.log('User not found');
        return;
    }

    const now = new Date();
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    const isExpired = user.expires_at <= now;
    const willExpireSoon = user.expires_at <= fiveMinutesFromNow;

    console.log('User Token Info:');
    console.log(`  - Character: ${user.character_name}`);
    console.log(`  - Corporation ID: ${user.corporation_id}`);
    console.log(`  - Token expires at: ${user.expires_at.toISOString()}`);
    console.log(`  - Current time: ${now.toISOString()}`);
    console.log(`  - Is expired: ${isExpired ? '❌ YES' : '✅ NO'}`);
    console.log(`  - Will expire soon: ${willExpireSoon ? '⚠️  YES (within 5 min)' : '✅ NO'}`);
    console.log(`  - Has refresh token: ${user.refresh_token ? '✅ YES' : '❌ NO'}`);

    await prisma.$disconnect();
}

checkTokenExpiry();
