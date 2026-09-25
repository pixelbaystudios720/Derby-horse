import 'dotenv/config';
import mongoose from 'mongoose';
import {
  UserModel,
  RaceModel,
  BetModel,
  TransactionModel,
  DepositRequestModel,
} from '../src/models/index';

async function main() {
  const fallbackUri = Buffer.from('bW9uZ29kYitzcnY6Ly90dXJmdGFjdGljczIwMjZfZGJfdXNlcjpUdXJmdGFjdGljczIwMjZAY2x1c3RlcmhvcnNlLm14d2dvemUubW9uZ29kYi5uZXQvZGVyYnliZXQ/cmV0cnlXcml0ZXM9dHJ1ZSZ3PW1ham9yaXR5JmFwcE5hbWU9Q2x1c3RlckhvcnNl', 'base64').toString('utf-8');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL || fallbackUri;

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected.');

  const users = await UserModel.find({}).lean();
  console.log('👤 Users count:', users.length);
  users.forEach(u => console.log(`  - ${u.username} (${u.phone || u.id}): Bal=₹${u.balance}, Exp=₹${u.exposure}`));

  const races = await RaceModel.find({}).lean();
  console.log('🏁 Races count:', races.length);
  races.forEach(r => console.log(`  - Race: ${r.name} (${r.venue}) Status: ${r.status} Settled: ${r.settled_at} P1: ${JSON.stringify(r.position_1)}`));

  const bets = await BetModel.find({}).lean();
  console.log('🎫 Bets count:', bets.length);
  bets.forEach(b => console.log(`  - Bet: ${b.horse_name} #${b.horse_no} (${b.race_name}) Type: ${b.bet_type} Stake: ₹${b.stake || b.amount} Odds: ${b.odds} Status: ${b.status} Payout: ₹${b.payout}`));

  const deposits = await DepositRequestModel.find({}).lean();
  console.log('💳 Deposits count:', deposits.length);
  deposits.forEach(d => console.log(`  - Deposit: ₹${d.amount} by ${d.username || d.user_id} (${d.status})`));

  const txs = await TransactionModel.find({}).sort({ created_at: -1 }).limit(15).lean();
  console.log('📜 Latest 15 Transactions:');
  txs.forEach(t => console.log(`  - [${t.type}] ₹${t.amount} (Bal: ${t.balance_after}): ${t.description}`));

  await mongoose.disconnect();
}

main().catch(console.error);
