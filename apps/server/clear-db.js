import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.DATABASE_URL);
const Bill = mongoose.model('Bill', new mongoose.Schema({ primaryCommitteeName: String }, { strict: false }));

async function run() {
  await Bill.deleteMany({});
  console.log(`Cleared all bills.`);
  process.exit(0);
}

run();
