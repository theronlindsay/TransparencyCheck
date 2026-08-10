import mongoose from 'mongoose';

/**
 * Connect to MongoDB via Mongoose.
 * Safe to call multiple times — reuses the shared connection promise.
 * Does not run at import time so Vite/Docker builds can load models without DATABASE_URL.
 */
export function connectMongoose() {
	const uri = process.env.DATABASE_URL;
	if (!uri) {
		throw new Error('DATABASE_URL is not set');
	}

	if (!globalThis._mongooseConnection) {
		console.log('🔌 Connecting to MongoDB...');
		globalThis._mongooseConnection = mongoose
			.connect(uri)
			.then((m) => {
				console.log('✅ MongoDB connected successfully');
				return m;
			})
			.catch((err) => {
				console.error('❌ MongoDB connection failed:', err.message);
				globalThis._mongooseConnection = undefined;
				throw err;
			});
	}

	return globalThis._mongooseConnection;
}

// Eager-connect only when a runtime URL is present (never abort module load during builds).
if (process.env.DATABASE_URL) {
	connectMongoose().catch(() => {
		/* error already logged; first query will surface failure */
	});
}

export default mongoose;
