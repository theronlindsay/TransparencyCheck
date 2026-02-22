
import { createRequire } from 'module';
import { env } from '$env/dynamic/private';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('./generated/client/index.js');

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more: 
// https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
    datasourceUrl: `mongodb+srv://user:${env.MONGO_PASS}@cluster0.esbggou.mongodb.net/AppData?appName=Cluster0`
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
