/**
 * Database connection utilities
 */

import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the database file
const dbPath = join(__dirname, '..', '..', '..', 'db', 'transparency.sqlite');

/**
 * Get a database connection
 */
export function getDatabase() {
	return new Promise((resolve, reject) => {
		const db = new sqlite3.Database(dbPath, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve(db);
			}
		});
	});
}

/**
 * Close database connection
 */
export function closeDatabase(db) {
	return new Promise((resolve, reject) => {
		db.close((err) => {
			if (err) {
				reject(err);
			} else {
				console.log('Database connection closed');
				resolve();
			}
		});
	});
}
