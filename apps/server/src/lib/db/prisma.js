import { createRequire } from 'module';
import { env } from '$env/dynamic/private';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('./generated/client/index.js');

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
    datasourceUrl: `mongodb+srv://user:${env.MONGO_PASS}@cluster0.esbggou.mongodb.net/AppData?appName=Cluster0`
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
