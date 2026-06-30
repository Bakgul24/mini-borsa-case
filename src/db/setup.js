require('dotenv').config();
const { Pool } = require('pg');

const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

const pool = new Pool({ connectionString });

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS stocks (
  symbol VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price_kurus BIGINT NOT NULL CHECK (price_kurus > 0)
);

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  cash_balance_kurus BIGINT NOT NULL CHECK (cash_balance_kurus >= 0)
);

CREATE TABLE IF NOT EXISTS holdings (
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (account_id, symbol)
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  type VARCHAR(4) NOT NULL CHECK (type IN ('BUY', 'SELL')),
  symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_kurus BIGINT NOT NULL CHECK (price_kurus > 0),
  total_kurus BIGINT NOT NULL CHECK (total_kurus = quantity * price_kurus),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function setup() {
  try {
    await pool.query(SCHEMA_SQL);
    console.log(`✅ Tablolar oluşturuldu (${process.env.NODE_ENV === 'test' ? 'test' : 'development'} DB)`);
  } catch (err) {
    console.error('❌ Tablo oluşturma hatası:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setup();