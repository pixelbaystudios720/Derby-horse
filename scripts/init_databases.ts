import mongoose from 'mongoose';
import 'dotenv/config';

async function initDBs() {
  const baseUri = 'mongodb+srv://turftactics2026_db_user:Turftactics2026@clusterhorse.mxwgoze.mongodb.net';
  
  // 1. Initialize DEV database: derbybet_dev
  console.log('Connecting to DEV (derbybet_dev)...');
  const devConn = await mongoose.createConnection(`${baseUri}/derbybet_dev?retryWrites=true&w=majority&appName=ClusterHorse`).asPromise();
  await devConn.collection('system_info').updateOne(
    { id: 'env_tag' },
    { $set: { environment: 'DEVELOPMENT_TESTING', label: 'Localhost Testing Database', initialized_at: new Date() } },
    { upsert: true }
  );
  console.log('✅ derbybet_dev initialized successfully on MongoDB Atlas!');

  // 2. Initialize / Verify PROD database: derbybet
  console.log('Connecting to PROD (derbybet)...');
  const prodConn = await mongoose.createConnection(`${baseUri}/derbybet?retryWrites=true&w=majority&appName=ClusterHorse`).asPromise();
  await prodConn.collection('system_info').updateOne(
    { id: 'env_tag' },
    { $set: { environment: 'PRODUCTION_LIVE', label: 'Live Public Production Database', updated_at: new Date() } },
    { upsert: true }
  );
  console.log('✅ derbybet (PRODUCTION) verified on MongoDB Atlas!');

  await devConn.close();
  await prodConn.close();
  console.log('🎉 Done! Both databases are active on Atlas.');
  process.exit(0);
}

initDBs().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
