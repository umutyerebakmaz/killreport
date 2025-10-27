import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    queue: 'alliance_sync_queue',
  },
  eveSso: {
    clientId: process.env.EVE_CLIENT_ID!,
    clientSecret: process.env.EVE_CLIENT_SECRET!,
    callbackUrl: process.env.EVE_CALLBACK_URL || 'http://localhost:4000/auth/callback',
    authUrl: 'https://login.eveonline.com/v2/oauth/authorize',
    tokenUrl: 'https://login.eveonline.com/v2/oauth/token',
    jwksUrl: 'https://login.eveonline.com/oauth/jwks',
    scopes: [
      'publicData',
      'esi-killmails.read_killmails.v1',
      'esi-killmails.read_corporation_killmails.v1',
      'esi-fittings.read_fittings.v1',
      'esi-fittings.write_fittings.v1',
      'esi-characters.read_medals.v1',
    ],
  },
};
