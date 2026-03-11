import mongoose from 'mongoose';

const uri = process.env.DATABASE_URL;

if (!uri) throw new Error('DATABASE_URL is not set');

if (!globalThis._mongooseConnection) {
	console.log('🔌 Connecting to MongoDB...');
	globalThis._mongooseConnection = mongoose.connect(uri).then((m) => {
		console.log('✅ MongoDB connected successfully');
		return m;
	}).catch((err) => {
		console.error('❌ MongoDB connection failed:', err.message);
		throw err;
	});
}

export default mongoose;
