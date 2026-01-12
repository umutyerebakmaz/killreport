import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Environment variables validation schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // RabbitMQ
  RABBITMQ_URL: z.string().default('amqp://localhost'),

  // EVE SSO
  EVE_CLIENT_ID: z.string().min(1, 'EVE_CLIENT_ID is required'),
  EVE_CLIENT_SECRET: z.string().min(1, 'EVE_CLIENT_SECRET is required'),
  EVE_CALLBACK_URL: z.string().default('http://localhost:4000/auth/callback'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000').transform(Number),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // GraphQL
  GRAPHQL_INTROSPECTION: z.string().default('true').transform(val => val === 'true'),
  GRAPHQL_PLAYGROUND: z.string().default('true').transform(val => val === 'true'),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

const env = parseEnv();

export const config = {
  database: {
    url: env.DATABASE_URL,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  eveSso: {
    clientId: env.EVE_CLIENT_ID,
    clientSecret: env.EVE_CLIENT_SECRET,
    callbackUrl: env.EVE_CALLBACK_URL,
    frontendUrl: env.FRONTEND_URL,
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
  app: {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },
  graphql: {
    introspection: env.GRAPHQL_INTROSPECTION,
    playground: env.GRAPHQL_PLAYGROUND,
  },
} as const;

// Type export for config
export type Config = typeof config;
