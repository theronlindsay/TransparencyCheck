import { env } from '$env/dynamic/private';
import { MongoClient, ServerApiVersion } from 'mongodb';

const url = `mongodb+srv://user:${env.MONGO_PASS}@cluster0.esbggou.mongodb.net/?appName=Cluster0`; //ClusterURL

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(url, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

export async function getMongoClient() {
  await client.connect();
  return client;
}

//Export functions from other database script
export { 
	getBillById, 
	getBillTextVersions, 
	getBillActions,
	saveBillActions,
	fetchAndStoreTextVersions
} from '../bills.js';


