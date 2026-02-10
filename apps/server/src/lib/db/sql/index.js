/**
 * Main database module
 * Handles database connection and initialization
 */

import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDatabase } from './connection.js';
import { tables, tableOrder } from './schema.js';
import { createTable } from '../../../../dep/migrations.js';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize the database
 * Creates all tables and applies migrations
 * Not needed for mongo!
 */
export async function initDatabase() {
	console.log('🗄️  Initializing database...');
	
	// Ensure the db directory exists
	const dbDir = join(__dirname, '..', '..', '..', 'db');
	await mkdir(dbDir, { recursive: true });

	const db = await getDatabase();
	
	try {
		// Create tables in order (respects foreign key dependencies)
		for (const tableName of tableOrder) {
			const tableSchema = tables[tableName];
			if (!tableSchema) {
				console.warn(`⚠️  No schema found for table: ${tableName}`);
				continue;
			}
			
			await createTable(db, tableName, tableSchema);
		}
		
		console.log('✅ Database initialization complete!');
		
		// Close the database connection used for initialization
		db.close();
	} catch (error) {
		console.error('❌ Database initialization failed:', error);
		db.close();
		throw error;
	}
}

// Re-export connection functions
export { getDatabase, closeDatabase } from './connection.js';

// Re-export query functions
export { query, queryOne, execute, transaction } from './queries.js';

// Re-export bill-specific functions
export { 
	getBillById, 
	getBillTextVersions, 
	getBillActions,
	saveBillActions,
	fetchAndStoreTextVersions
} from './bills.js';
