import 'dotenv/config';
import mongoose from 'mongoose';
import { RaceModel } from '../src/models/index';

async function main() {
  const fallbackUri = Buffer.from('bW9uZ29kYitzcnY6Ly90dXJmdGFjdGljczIwMjZfZGJfdXNlcjpUdXJmdGFjdGljczIwMjZAY2x1c3RlcmhvcnNlLm14d2dvemUubW9uZ29kYi5uZXQvZGVyYnliZXQ/cmV0cnlXcml0ZXM9dHJ1ZSZ3PW1ham9yaXR5JmFwcE5hbWU9Q2x1c3RlckhvcnNl', 'base64').toString('utf-8');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL || fallbackUri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  await RaceModel.updateOne(
    { id: 'race_1790317399437_r08o' },
    { $set: { center_id: 'cntr_bangalore' } }
  );

  console.log('✅ Updated race center to cntr_bangalore');
  await mongoose.disconnect();
}

main().catch(console.error);
