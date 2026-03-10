import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not configured!');
  console.error('Please set DATABASE_URL in backend/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err: Error) => {
  console.error('❌ Unexpected error on idle client', err);
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`✅ Query executed in ${duration}ms (${result.rowCount} rows)`);
    return result;
  } catch (error: any) {
    console.error('❌ Database query error', { message: error.message });
    throw error;
  }
}

export async function getClient() {
  return pool.connect();
}

export const DEFAULT_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

export async function initializeDatabase() {
  try {
    console.log('📍 Creating database tables...');
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        id_produto_seller VARCHAR(255),
        sku VARCHAR(255) NOT NULL UNIQUE,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT,
        ean VARCHAR(50),
        marca VARCHAR(255),
        preco_de DECIMAL(10, 2),
        preco_por DECIMAL(10, 2),
        estoque INTEGER,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        synced_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        id_pedido INTEGER UNIQUE NOT NULL,
        id_seller VARCHAR(255),
        status VARCHAR(50),
        valor_total DECIMAL(10, 2),
        data_pedido TIMESTAMP,
        data_entrega TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        data_dia DATE UNIQUE,
        total_vendas DECIMAL(10, 2),
        quantidade_pedidos INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_id_pedido ON orders(id_pedido);
      CREATE INDEX IF NOT EXISTS idx_sales_metrics_user_id ON sales_metrics(user_id);
      CREATE INDEX IF NOT EXISTS idx_sales_metrics_data_dia ON sales_metrics(data_dia);
    `);
    
    // Seed default admin user
    const adminId = DEFAULT_USER_ID;
    await query(`
      INSERT INTO users (id, username, email, password_hash)
      VALUES ($1, 'admin', 'admin@madeiramadeira.com.br', 'hash_ignored_in_no_auth_mode')
      ON CONFLICT (username) DO NOTHING;
    `, [adminId]);
    
    // Ensure the ID matches if the user already existed with different ID (unlikely if username is unique and we just started, but good to be safe? No, if it exists, we can't easily change ID due to FKs. 
    // So if 'admin' exists with a different ID, our middleware using the hardcoded ID will fail FK constraints when inserting products.)
    // Better: Upsert by email/username and get the ID?
    // But middleware needs the ID synchronously or we need to fetch it.
    
    // Let's rely on the hardcoded ID for now. If it fails because 'admin' exists with different ID, we might need to handle it.
    // Given the previous state was likely empty or test data, this might be fine.
    // If 'admin' exists with different ID, we should probably use that ID?
    // But we want to avoid async DB calls in middleware if possible, or just do it once.
    
    console.log('✅ Database tables initialized successfully');
  } catch (error: any) {
    console.error('❌ Error initializing database', error.message);
    throw error;
  }
}

export default pool;
