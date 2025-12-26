import './src/config';
import prisma from './src/services/prisma';

async function checkUser() {
    const user = await prisma.user.findFirst({
        where: { character_id: 365974960 },
        select: {
            id: true,
            character_name: true,
            corporation_id: true,
            last_corp_killmail_sync_at: true,
        },
    });

    console.log('User Info:');
    console.log(JSON.stringify(user, null, 2));

    await prisma.$disconnect();
}

checkUser();
