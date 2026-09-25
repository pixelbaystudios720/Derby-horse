import 'dotenv/config';
import mongoose from 'mongoose';
import { UserModel, BetModel, TransactionModel, DepositRequestModel } from '../src/models/index';

async function main() {
  const fallbackUri = Buffer.from('bW9uZ29kYitzcnY6Ly90dXJmdGFjdGljczIwMjZfZGJfdXNlcjpUdXJmdGFjdGljczIwMjZAY2x1c3RlcmhvcnNlLm14d2dvemUubW9uZ29kYi5uZXQvZGVyYnliZXQ/cmV0cnlXcml0ZXM9dHJ1ZSZ3PW1ham9yaXR5JmFwcE5hbWU9Q2x1c3RlckhvcnNl', 'base64').toString('utf-8');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL || fallbackUri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const users = await UserModel.find({}).lean();
  console.log('=== USERS IN MONGO ===');
  for (const u of users) {
    console.log(`User: ${u.username} | id: ${u.id} | _id: ${u._id} | balance: ${u.balance} | exposure: ${u.exposure}`);
  }

  const bets = await BetModel.find({}).lean();
  console.log('=== BETS IN MONGO ===');
  for (const b of bets) {
    console.log(`Bet: ${b.id} | user: ${b.username || b.user_id} | horse: ${b.horse_name} | stake: ${b.stake} | status: ${b.status}`);
  }

  const txs = await TransactionModel.find({}).lean();
  console.log('=== TRANSACTIONS IN MONGO ===');
  for (const t of txs) {
    console.log(`Tx: ${t.id} | user: ${t.user_id} | type: ${t.type} | amount: ${t.amount} | bal_after: ${t.balance_after}`);
  }

  const deps = await DepositRequestModel.find({}).lean();
  console.log('=== DEPOSITS IN MONGO ===');
  for (const d of deps) {
    console.log(`Dep: ${d.id} | user: ${d.username || d.user_id} | amount: ${d.amount} | status: ${d.status} | utr: ${d.utr_number}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
