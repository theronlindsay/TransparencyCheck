/**
 * SQLite Prisma client initialization using better-sqlite3 driver adapter.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';
import { PrismaLibSQL } from '@prisma/adapter-better-sqlite3';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('./generated/sqlite-client/index.js');

// Resolve the SQLite DB path relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', '..', '..', 'db', 'transparency.sqlite');

const globalForPrisma = globalThis;

if (!globalForPrisma.sqlitePrisma) {
	const sqlite = new Database(dbPath);
	const adapter = new PrismaLibSQL(sqlite);
	globalForPrisma.sqlitePrisma = new PrismaClient({ adapter });
}

export const sqlitePrisma = globalForPrisma.sqlitePrisma;
