// src/db/seed.js
//
// Başlangıç verisini yükler: 3 hisse + 100.000 TL'lik tek hesap.
// Zaten varsa tekrar eklemez (idempotent).

require('dotenv').config();
const { Pool } = require('pg');

const connectionString =
    process.env.NODE_ENV === 'test'
        ? process.env.TEST_DATABASE_URL
        : process.env.DATABASE_URL;

const pool = new Pool({ connectionString });

const STOCKS = [
    { symbol: 'THYAO', name: 'Türk Hava Yolları', priceKurus: 30000 },  // 300.00 TL
    { symbol: 'GARAN', name: 'Garanti Bankası', priceKurus: 13000 },     // 130.00 TL
    { symbol: 'ASELS', name: 'Aselsan', priceKurus: 7500 },              // 75.00 TL
];

const STARTING_BALANCE_KURUS = 10000000; // 100.000,00 TL

async function seed() {
    try {
        for (const stock of STOCKS) {
            await pool.query(
                `INSERT INTO stocks (symbol, name, price_kurus)
         VALUES ($1, $2, $3)
         ON CONFLICT (symbol) DO NOTHING`,
                [stock.symbol, stock.name, stock.priceKurus]
            );
        }

        // Hesap id=1 zaten var mı kontrol et, yoksa oluştur
        const existing = await pool.query('SELECT id FROM accounts WHERE id = 1');
        if (existing.rows.length === 0) {
            await pool.query(
                `INSERT INTO accounts (id, cash_balance_kurus) VALUES (1, $1)`,
                [STARTING_BALANCE_KURUS]
            );
        }

        console.log(`✅ Seed tamamlandı (${process.env.NODE_ENV === 'test' ? 'test' : 'development'} DB)`);
    } catch (err) {
        console.error('❌ Seed hatası:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

seed();