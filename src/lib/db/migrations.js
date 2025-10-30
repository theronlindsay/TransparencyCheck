/**
 * Database migration utilities
 */

/**
 * Apply all pending migrations for a table
 */
export async function applyMigrations(db, tableName, migrations) {
	if (!migrations || migrations.length === 0) return;

	for (const migration of migrations) {
		try {
			const needsMigration = await migration.check(db);
			
			if (needsMigration) {
				await new Promise((resolve, reject) => {
					db.run(migration.apply, (err) => {
						if (err) {
							console.error(`❌ Error applying migration ${migration.name} to ${tableName}:`, err.message);
							reject(err);
						} else {
							console.log(`✓ Applied migration: ${migration.name} to ${tableName}`);
							resolve();
						}
					});
				});
			} else {
				console.log(`⏭️  Skipping migration ${migration.name} for ${tableName} (already applied)`);
			}
		} catch (error) {
			console.error(`Error checking/applying migration ${migration.name}:`, error);
			// Continue with other migrations even if one fails
		}
	}
}

/**
 * Create a table and its indexes
 */
export async function createTable(db, tableName, tableSchema) {
	// Create the table
	await new Promise((resolve, reject) => {
		db.run(tableSchema.create, (err) => {
			if (err) {
				reject(err);
			} else {
				console.log(`✓ Table '${tableName}' created or already exists`);
				resolve();
			}
		});
	});

	// Create indexes
	if (tableSchema.indexes && tableSchema.indexes.length > 0) {
		for (const index of tableSchema.indexes) {
			await new Promise((resolve, reject) => {
				db.run(index, (err) => {
					if (err) {
						console.error(`❌ Error creating index for ${tableName}:`, err.message);
						// Don't reject - indexes are not critical
						resolve();
					} else {
						console.log(`✓ Index created for '${tableName}'`);
						resolve();
					}
				});
			});
		}
	}

	// Apply migrations
	if (tableSchema.migrations) {
		await applyMigrations(db, tableName, tableSchema.migrations);
	}
}
