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
	saveBillActions 
} from './db/index.js';
