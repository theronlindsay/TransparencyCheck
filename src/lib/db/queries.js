/**
 * Common database query functions
 */

import { getDatabase } from './connection.js';

/**
 * Execute a query that returns multiple rows (SELECT queries)
 */
export async function query(sql, params = []) {
	const db = await getDatabase();
	
	return new Promise((resolve, reject) => {
		db.all(sql, params, (err, rows) => {
			db.close();
			if (err) {
				reject(err);
			} else {
				resolve(rows);
			}
		});
	});
}

/**
 * Execute a query that returns a single row (SELECT with LIMIT 1)
 */
export async function queryOne(sql, params = []) {
	const db = await getDatabase();
	
	return new Promise((resolve, reject) => {
		db.get(sql, params, (err, row) => {
			db.close();
			if (err) {
				reject(err);
			} else {
				resolve(row);
			}
		});
	});
}

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 */
export async function execute(sql, params = []) {
	console.log('=== EXECUTE SQL ===');
	console.log('SQL:', sql);
	console.log('Params:', params);
	
	const db = await getDatabase();
	
	return new Promise((resolve, reject) => {
		db.run(sql, params, function(err) {
			if (err) {
				console.error('✗ SQL execution error:', err.message);
				console.error('Failed SQL:', sql);
				console.error('Failed params:', params);
				db.close();
				reject(err);
			} else {
				console.log('✓ SQL executed successfully');
				console.log('  Last ID:', this.lastID);
				console.log('  Changes:', this.changes);
				console.log('==================');
				
				db.close();
				resolve({
					lastID: this.lastID,
					changes: this.changes
				});
			}
		});
	});
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction(callback) {
	const db = await getDatabase();
	
	return new Promise((resolve, reject) => {
		db.serialize(() => {
			db.run('BEGIN TRANSACTION');
			
			Promise.resolve(callback(db))
				.then((result) => {
					db.run('COMMIT', (err) => {
						db.close();
						if (err) {
							reject(err);
						} else {
							resolve(result);
						}
					});
				})
				.catch((error) => {
					db.run('ROLLBACK', () => {
						db.close();
						reject(error);
					});
				});
		});
	});
}
