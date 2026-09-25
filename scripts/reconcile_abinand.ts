import mongoose from 'mongoose';
import { UserModel, DepositRequestModel, TransactionModel, NotificationModel, BetModel } from '../src/models/index';
import { connectMongoDB } from '../src/models/db';

async function runCleanup() {
  console.log('🔧 Connecting to MongoDB Atlas for Account Reconciliation...');
  await connectMongoDB();
  console.log('✅ Connected');

  // Find @abinand
  const user = await UserModel.findOne({ $or: [{ username: 'abinand' }, { phone: '6385633325' }] });
  if (!user) {
    console.error('❌ User @abinand not found');
    process.exit(1);
  }

  console.log(`Current @abinand state: Balance = ₹${user.balance}, Exposure = ₹${user.exposure}`);

  // Fetch all deposits for @abinand
  const deposits = await DepositRequestModel.find({
    $or: [{ user_id: user.id }, { username: user.username }, { phone: user.phone }]
  }).lean();

  console.log(`Approved deposits count: ${deposits.filter((d: any) => d.status === 'APPROVED').length}`);
  const approvedTotal = deposits
    .filter((d: any) => d.status === 'APPROVED')
    .reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

  // Fetch active pending bets
  const pendingBets = await BetModel.find({
    $or: [{ user_id: user.id }, { username: user.username }],
    status: 'PENDING',
  }).lean();

  const totalExposure = pendingBets.reduce((sum: number, b: any) => sum + (Number(b.stake || b.amount) || 0), 0);
  const welcomeBonus = 50;

  // Correct ground truth balance
  const correctBalance = Math.max(0, approvedTotal + welcomeBonus - totalExposure);

  console.log(`📊 Calculated True Ground State: Approved Deposits = ₹${approvedTotal}, Bonus = ₹${welcomeBonus}, Exposure = ₹${totalExposure} => True Balance = ₹${correctBalance}`);

  user.balance = correctBalance;
  user.exposure = totalExposure;
  await user.save();
  console.log(`✅ Fixed @abinand Balance to ₹${correctBalance}`);

  // Clean duplicate transactions for UTR 987654321
  const depTxs = await TransactionModel.find({
    $or: [{ user_id: user.id }, { username: user.username }],
    type: 'DEPOSIT',
  }).sort({ created_at: -1 });

  console.log(`Found ${depTxs.length} deposit transactions`);
  if (depTxs.length > 1) {
    // Keep the latest 1, remove duplicates
    const [keep, ...duplicates] = depTxs;
    for (const dup of duplicates) {
      await TransactionModel.deleteOne({ _id: dup._id });
      console.log(`🗑️ Removed duplicate deposit tx: ${dup.id}`);
    }
    // Update the retained transaction with correct balance_after
    keep.balance_after = correctBalance + totalExposure; // post deposit, pre bet
    await keep.save();
  }

  // Create/Update deposit notification
  await NotificationModel.findOneAndUpdate(
    { reference_id: '987654321' },
    {
      id: `notif_dep_987654321`,
      user_id: user.id,
      title: '🎉 Deposit Approved & Credited!',
      message: `Your deposit of ₹${approvedTotal.toLocaleString('en-IN')} has been approved and added to your wallet! New Balance: ₹${correctBalance.toLocaleString('en-IN')}`,
      type: 'DEPOSIT_APPROVED',
      amount: approvedTotal,
      reference_id: '987654321',
      is_read: false,
      created_at: new Date().toISOString(),
    },
    { upsert: true, new: true }
  );

  console.log('✅ Notification created and synced!');
  await mongoose.disconnect();
  console.log('🎉 Reconciliation finished cleanly!');
  process.exit(0);
}

runCleanup().catch((err) => {
  console.error('❌ Error during cleanup:', err);
  process.exit(1);
});
