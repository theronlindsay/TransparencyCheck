/**
 * SQLite Prisma client initialization using better-sqlite3 driver adapter.
 */

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const require = createRequire(import.meta.url);
const { PrismaClient } = require(join(process.cwd(), 'src', 'lib', 'db', 'generated', 'sqlite-client', 'index.js'));

// Resolve the SQLite DB path relative to the project root
const dbPath = join(process.cwd(), 'db', 'transparency.sqlite');

// Ensure the db directory exists
mkdirSync(dirname(dbPath), { recursive: true });

const globalForPrisma = globalThis;

if (!globalForPrisma.sqlitePrisma) {
	const adapter = new PrismaBetterSqlite3({ url: dbPath });
	globalForPrisma.sqlitePrisma = new PrismaClient({ adapter });
}

export const sqlitePrisma = globalForPrisma.sqlitePrisma;



