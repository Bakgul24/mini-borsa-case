process.env.NODE_ENV = 'test';

const pool = require('../db/pool');

async function resetDatabase() {
    await pool.query('TRUNCATE transactions, holdings, accounts, stocks RESTART IDENTITY CASCADE');

    await pool.query(`
    INSERT INTO stocks (symbol, name, price_kurus) VALUES
    ('THYAO', 'Türk Hava Yolları', 30000),
    ('GARAN', 'Garanti Bankası', 13000),
    ('ASELS', 'Aselsan', 7500)
  `);

    await pool.query(
        'INSERT INTO accounts (id, cash_balance_kurus) VALUES (1, 10000000)'
    );
}

module.exports = { resetDatabase };