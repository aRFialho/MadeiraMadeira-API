require('dotenv').config();

const url = process.env.DATABASE_URL;
console.log('📍 DATABASE_URL:', url ? '✅ Set' : '❌ Not set');
if (url) {
  console.log('URL:', url.replace(/:.*@/, ':***@'));
}

if (!url) {
  console.log('\n⚠️  DATABASE_URL not found in .env');
  console.log('Please create backend/.env with:');
  console.log('DATABASE_URL=postgresql://user:password@host:port/dbname');
  process.exit(0);
}

const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: url, 
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 5000 
});

pool.query('SELECT 1', (err, result) => {
  if (err) {
    console.log('\n❌ Database connection failed:');
    console.log(err.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Check if DATABASE_URL is correct in .env');
    console.log('2. For Render: Verify the database is still running');
    console.log('3. Check your internet connection');
  } else {
    console.log('\n✅ Database connection successful!');
  }
  pool.end();
  process.exit(err ? 1 : 0);
});
