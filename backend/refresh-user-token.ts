import './src/config';
import { refreshAccessToken } from './src/services/eve-sso';
import prisma from './src/services/prisma';

async function refreshUserToken() {
    const user = await prisma.user.findFirst({
        where: { character_id: 365974960 },
    });

    if (!user) {
        console.log('User not found');
        return;
    }

    if (!user.refresh_token) {
        console.log('❌ No refresh token available');
        return;
    }

    console.log(`Refreshing token for ${user.character_name}...`);

    try {
        const newTokenData = await refreshAccessToken(user.refresh_token);
        const newExpiresAt = new Date(Date.now() + newTokenData.expires_in * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                access_token: newTokenData.access_token,
                refresh_token: newTokenData.refresh_token || user.refresh_token,
                expires_at: newExpiresAt,
            },
        });

        console.log('✅ Token refreshed successfully');
        console.log(`   New expiry: ${newExpiresAt.toISOString()}`);
    } catch (error: any) {
        console.error('❌ Failed to refresh token:', error.message);
    }

    await prisma.$disconnect();
}

refreshUserToken();
