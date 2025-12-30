import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';

// Prisma 7+ configuration with pg adapter
// Connection pooling is handled by the Node.js pg driver
const connectionString = process.env.DB_URL!;

const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

export default prisma;
