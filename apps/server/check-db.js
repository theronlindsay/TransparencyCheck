import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.DATABASE_URL);
const Bill = mongoose.model('Bill', new mongoose.Schema({ primaryCommitteeName: String }, { strict: false }));

async function run() {
  const allCount = await Bill.countDocuments({});
  const withCommittee = await Bill.countDocuments({ primaryCommitteeName: { $exists: true, $ne: null } });
  
  console.log(`Total Bills: ${allCount}`);
  console.log(`With Committee: ${withCommittee}`);
  process.exit(0);
}

run();
