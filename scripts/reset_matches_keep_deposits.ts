import 'dotenv/config';
import mongoose from 'mongoose';
import {
  UserModel,
  RaceModel,
  BetModel,
  TransactionModel,
  DepositRequestModel,
  NotificationModel,
} from '../src/models/index';

async function main() {
  const fallbackUri = Buffer.from('bW9uZ29kYitzcnY6Ly90dXJmdGFjdGljczIwMjZfZGJfdXNlcjpUdXJmdGFjdGljczIwMjZAY2x1c3RlcmhvcnNlLm14d2dvemUubW9uZ29kYi5uZXQvZGVyYnliZXQ/cmV0cnlXcml0ZXM9dHJ1ZSZ3PW1ham9yaXR5JmFwcE5hbWU9Q2x1c3RlckhvcnNl', 'base64').toString('utf-8');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL || fallbackUri;

  console.log('🔄 Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected.');

  // 1. Delete all races and bets
  console.log('🗑️ Deleting all races...');
  const delRaces = await RaceModel.deleteMany({});
  console.log(`✅ Deleted ${delRaces.deletedCount} races.`);

  console.log('🗑️ Deleting all bets...');
  const delBets = await BetModel.deleteMany({});
  console.log(`✅ Deleted ${delBets.deletedCount} bets.`);

  // 2. Delete winnings & bets from transactions
  console.log('🗑️ Deleting win/bet transactions...');
  const delTxs = await TransactionModel.deleteMany({
    type: { $in: ['WIN', 'BET', 'REFUND'] },
  });
  console.log(`✅ Deleted ${delTxs.deletedCount} non-deposit transactions.`);

  // 3. Delete win notifications
  try {
    const delNotifs = await NotificationModel.deleteMany({
      type: { $in: ['WIN_PAYOUT', 'BET_SETTLED', 'DEAD_HEAT_PAYOUT'] },
    });
    console.log(`✅ Deleted ${delNotifs.deletedCount} win notifications.`);
  } catch (e) {
    console.warn('Notifications:', e);
  }

  // 4. Update user balances
  console.log('💰 Setting user balances to deposited amount only...');
  const allUsers = await UserModel.find({ username: { $ne: 'admin' } }).lean();
  const allApprovedDeposits = await DepositRequestModel.find({ status: 'APPROVED' }).lean();

  for (const user of allUsers) {
    const userDeps = allApprovedDeposits.filter(
      (d) => d.user_id === user.id || d.username === user.username
    );
    const depTotal = userDeps.reduce((sum, d) => sum + (d.amount || 0), 0);
    const finalBalance = depTotal > 0 ? (depTotal + 50) : 50;

    await UserModel.updateOne(
      { id: user.id },
      {
        $set: {
          balance: finalBalance,
          exposure: 0,
        },
      }
    );

    console.log(`✅ ${user.username} (${user.full_name || user.id}): Balance = ₹${finalBalance} (Deposits: ₹${depTotal}, Exposure: ₹0)`);
  }

  console.log('🎉 Reset Completed Successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
