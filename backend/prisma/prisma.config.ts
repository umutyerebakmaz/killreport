import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default {
  datasourceUrl: process.env.DATABASE_URL || '',
};
