import { MongoClient } from 'mongodb';

let client;
let clientPromise;

export async function mongo() {
    const uri = process.env.DATABASE_URL;

    if (!uri) {
        throw new Error('DATABASE_URL is not set');
    }

    try {
        if (!clientPromise) {
            client = new MongoClient(uri);
            clientPromise = client.connect();
        }

        const connectedClient = await clientPromise;
        console.log('MongoDB connected');
        return connectedClient.db();
    } catch (error) {
        clientPromise = undefined;
        console.error('MongoDB connection failed:', error);
        throw error;
    }
}

export default mongo;