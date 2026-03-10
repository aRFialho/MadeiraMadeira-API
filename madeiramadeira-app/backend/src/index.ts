import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/connection';
import { errorHandler } from './middleware/auth';
import authRoutes from './routes/auth';
import marketplaceRoutes from './routes/marketplace';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/marketplace', marketplaceRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'MadeiraMadeira API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      marketplace: '/api/marketplace'
    }
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    // Try to initialize database
    try {
      await initializeDatabase();
      console.log('✅ Database connection successful');
    } catch (dbError: any) {
      console.warn('⚠️  Database initialization failed:', dbError.message);
      console.warn('📍 Starting server anyway - database operations will fail');
    }

    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀 MadeiraMadeira API');
      console.log('='.repeat(50));
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📍 Frontend: http://localhost:3000`);
      console.log(`🔌 API: http://localhost:${PORT}`);
      console.log(`❤️  Health: http://localhost:${PORT}/health`);
      console.log('='.repeat(50) + '\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
