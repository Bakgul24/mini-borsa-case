const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

router.get('/stocks', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT symbol, name, price_kurus FROM stocks ORDER BY symbol');
        const stocks = result.rows.map((s) => ({
            symbol: s.symbol,
            name: s.name,
            price: s.price_kurus / 100,
        }));
        res.json(stocks);
    } catch (err) {
        next(err);
    }
});

module.exports = router;