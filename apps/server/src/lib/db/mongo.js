import { MongoClient } from 'mongodb';

let client;
let clientPromise;
let loggedConnected = false;

export async function mongo() {
	const uri = process.env.DATABASE_URL;

	if (!uri) {
		throw new Error('DATABASE_URL is not set');
	}

	try {
		if (!clientPromise) {
			client = new MongoClient(uri, {
				maxPoolSize: 5,
				minPoolSize: 0,
				maxIdleTimeMS: 30000,
				waitQueueTimeoutMS: 5000,
				serverSelectionTimeoutMS: 10000
			});
			clientPromise = client.connect();
		}

		const connectedClient = await clientPromise;
		if (!loggedConnected) {
			loggedConnected = true;
			console.log('MongoDB connected');
		}
		return connectedClient.db();
	} catch (error) {
		clientPromise = undefined;
		console.error('MongoDB connection failed:', error);
		throw error;
	}
}

export default mongo;
