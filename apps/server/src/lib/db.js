/**
 * Main database module - re-exports from db/index.js
 * This file exists for backward compatibility with existing imports
 */

export { 
	initDatabase, 
	getDatabase, 
	closeDatabase,
	query, 
	queryOne, 
	execute, 
	transaction,
	getBillById, 
	getBillTextVersions, 
	getBillActions,
	saveBillActions,
	fetchAndStoreTextVersions
} from './db/sql/index.js';

// exporting from .db/sql/index.js will enable SQL
// ./db/mongo.js will use mongo
