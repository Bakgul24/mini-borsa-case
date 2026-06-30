const pool = require('../db/pool');

async function getAllStocks() {
    const result = await pool.query('SELECT symbol, name, price_kurus FROM stocks ORDER BY symbol');
    return result.rows.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        price: s.price_kurus / 100,
    }));
}

module.exports = { getAllStocks };