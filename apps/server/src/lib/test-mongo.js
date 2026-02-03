import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

// Load env from root .env
dotenv.config({ path: '../../.env' });

const url = `mongodb+srv://user:${process.env.MONGO_PASS}@cluster0.esbggou.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(url, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function testConnection() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");
    
    // Select database and collection
    const db = client.db("AppData");
    const billsCollection = db.collection("Bills");
    
    // Insert a single document
    const sampleBill = {
      _id: "HR1235",  // Custom ID (optional - MongoDB will generate ObjectId if omitted)
      billNumber: "1235",
      congress: 119,
      type: "HR",
      title: "Sample Bill for Testing",
      status: "Introduced",
      introducedDate: "2026-01-15",
      latestAction: {
        text: "Referred to committee",
        actionDate: "2026-01-15"
      },
      sponsors: [
        {
          bioguideId: "S000001",
          fullName: "John Smith",
          party: "D",
          state: "CA"
        }
      ],
      policyArea: { name: "Government Operations" },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const insertResult = await billsCollection.insertOne(sampleBill);
    console.log("✅ Inserted document with _id:", insertResult.insertedId);
    
    // Insert multiple documents
    const multipleBills = [
      {
        _id: "S5678",
        billNumber: "5678",
        congress: 119,
        type: "S",
        title: "Another Sample Bill",
        status: "In Committee"
      },
      {
        _id: "HR9999",
        billNumber: "9999",
        congress: 119,
        type: "HR",
        title: "Third Sample Bill",
        status: "Passed House"
      }
    ];
    
    const insertManyResult = await billsCollection.insertMany(multipleBills);
    console.log("✅ Inserted", insertManyResult.insertedCount, "documents");
    
    // Query inserted data
    const foundBill = await billsCollection.findOne({ _id: "HR1234" });
    console.log("✅ Found bill:", foundBill?.title);
    
    // Count documents
    const count = await billsCollection.countDocuments();
    console.log("✅ Total bills in collection:", count);
    
    // Update a document
    const updateResult = await billsCollection.updateOne(
      { _id: "HR1234" },
      { $set: { status: "In Committee", updatedAt: new Date() } }
    );
    console.log("✅ Updated", updateResult.modifiedCount, "document(s)");
    
    // Upsert (insert if not exists, update if exists)
    const upsertResult = await billsCollection.updateOne(
      { _id: "HR1234" },
      { 
        $set: { 
          status: "Active",
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    console.log("✅ Upsert:", upsertResult.upsertedCount ? "inserted" : "updated");
    
    // Clean up - delete test data
    const deleteResult = await billsCollection.deleteMany({ 
      _id: { $in: ["HR1234", "S5678", "HR9999"] } 
    });
    console.log("✅ Cleaned up", deleteResult.deletedCount, "test documents");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.close();
  }
}

testConnection();
