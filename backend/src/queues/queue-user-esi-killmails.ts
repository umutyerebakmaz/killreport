import '../config';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_user_killmails_queue';

interface UserKillmailMessage {
    userId: number;
    characterId: number;
    characterName: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    queuedAt: string;
}

/**
 * Queue logged-in users for ESI killmail sync (no zKillboard dependency)
 * Fetches killmails directly from ESI API using user's access token
 *
 * Usage: yarn queue:user-killmails [--force]
 *
 * By default, only queues users who haven't been synced in the last 15 minutes.
 * Use --force to queue all users regardless of last sync time.
 *
 * This will queue all active users (with valid SSO tokens) for killmail sync.
 * The worker will fetch their recent killmails from ESI API.
 */
async function queueUserESIKillmails() {
    const forceSync = process.argv.includes('--force');
    console.log('📡 Queueing users for ESI killmail sync...\n');

    if (forceSync) {
        console.log('⚡ Force mode: Ignoring last sync time\n');
    }

    try {
        // Get all users with valid tokens (not expired, with 5 minute buffer)
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        const users = await prisma.user.findMany({
            where: {
                expires_at: {
                    gt: fiveMinutesFromNow, // Token expires more than 5 minutes from now
                },
                refresh_token: {
                    not: null, // Must have refresh token for auto-renewal
                },
                // Only queue users who haven't been synced recently (unless force mode)
                ...(forceSync ? {} : {
                    OR: [
                        { last_killmail_sync_at: null }, // Never synced
                        { last_killmail_sync_at: { lt: fifteenMinutesAgo } }, // Synced > 15 min ago
                    ],
                }),
            },
            select: {
                id: true,
                character_id: true,
                character_name: true,
                access_token: true,
                refresh_token: true,
                expires_at: true,
                last_killmail_sync_at: true,
            },
        });

        if (users.length === 0) {
            console.log('⚠️  No active users found for sync\n');
            if (!forceSync) {
                console.log('💡 All users were synced recently (within 15 minutes).');
                console.log('   Use --force to sync anyway: yarn queue:user-killmails --force\n');
            } else {
                console.log('💡 Users need to login via SSO first.\n');
            }
            return;
        }

        console.log(`✓ Found ${users.length} user(s) to sync`);
        console.log(`📤 Adding to queue: ${QUEUE_NAME}\n`);

        const channel = await getRabbitMQChannel();

        // Assert queue with priority support
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: {
                'x-max-priority': 10,
            },
        });

        // Queue each user
        for (const user of users) {
            const lastSyncInfo = user.last_killmail_sync_at
                ? ` (last sync: ${user.last_killmail_sync_at.toLocaleString('tr-TR')})`
                : ' (never synced)';

            const message: UserKillmailMessage = {
                userId: user.id,
                characterId: user.character_id,
                characterName: user.character_name,
                accessToken: user.access_token,
                refreshToken: user.refresh_token!,
                expiresAt: user.expires_at.toISOString(),
                queuedAt: new Date().toISOString(),
            };

            channel.sendToQueue(
                QUEUE_NAME,
                Buffer.from(JSON.stringify(message)),
                {
                    persistent: true,
                    priority: 5, // Medium priority,
                }
            );

            console.log(`  ⏳ Queued: ${user.character_name} (ID: ${user.character_id})${lastSyncInfo}`);
        }

        console.log(`\n✅ Successfully queued ${users.length} user(s)!`);
        console.log(`\n💡 Now run the worker to process them:`);
        console.log(`   yarn worker:user-killmails\n`);

        await channel.close();
        await prisma.$disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to queue users:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

queueUserESIKillmails();
