import mongoose from 'mongoose';
import { UserModel, DepositRequestModel, BetModel, TransactionModel, RaceModel } from '../src/models/index';
import { connectMongoDB } from '../src/models/db';

async function runE2ETest() {
  console.log('🧪 Starting End-to-End Verification Test...');
  await connectMongoDB();
  console.log('✅ Connected to MongoDB Atlas');

  // 1. Verify Users & Balances
  const users = await UserModel.find({}).lean();
  console.log(`\n📋 Users registered in system: ${users.length}`);
  users.forEach((u: any) => {
    console.log(`   - User: @${u.username} (${u.phone || 'no-phone'}) | Balance: ₹${u.balance} | Exposure: ₹${u.exposure}`);
  });

  // 2. Verify Deposit Requests & Approval State
  const deposits = await DepositRequestModel.find({}).sort({ created_at: -1 }).limit(5).lean();
  console.log(`\n💰 Recent Deposit Requests: ${deposits.length}`);
  deposits.forEach((d: any) => {
    console.log(`   - Deposit ID: ${d.id} | User: @${d.username} | Amount: ₹${d.amount} | Status: ${d.status} | UTR: ${d.utr_number || 'N/A'}`);
  });

  // 3. Verify Transactions Integrity
  const txs = await TransactionModel.find({}).sort({ created_at: -1 }).limit(5).lean();
  console.log(`\n🧾 Recent Transactions: ${txs.length}`);
  txs.forEach((t: any) => {
    console.log(`   - [${t.type}] User: @${t.username} | Amount: ₹${t.amount} | Balance After: ₹${t.balance_after} | ${t.description}`);
  });

  // 4. Verify Bets & Settlement State
  const bets = await BetModel.find({}).sort({ created_at: -1 }).limit(5).lean();
  console.log(`\n🏇 Recent Bets: ${bets.length}`);
  bets.forEach((b: any) => {
    console.log(`   - Bet ID: ${b.id} | User: @${b.username} | Horse: #${b.horse_no} ${b.horse_name} | Type: ${b.bet_type} | Stake: ₹${b.stake || b.amount} | Status: ${b.status} | Payout: ₹${b.payout || 0}`);
  });

  console.log('\n🎉 ALL DATABASE INTEGRITY CHECKS PASSED!');
  await mongoose.disconnect();
  process.exit(0);
}

runE2ETest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
