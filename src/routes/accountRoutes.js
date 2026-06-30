const express = require('express');
const pool = require('../db/pool');
const { NotFoundError } = require('../errors');
const router = express.Router();

router.get('/accounts/:id', async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT id, cash_balance_kurus FROM accounts WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            throw new NotFoundError(`${req.params.id} numaralı hesap bulunamadı`);
        }
        const account = result.rows[0];
        res.json({ id: account.id, cashBalance: account.cash_balance_kurus / 100 });
    } catch (err) {
        next(err);
    }
});

router.get('/accounts/:id/portfolio', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT h.symbol, s.name, h.quantity, s.price_kurus
       FROM holdings h
       JOIN stocks s ON s.symbol = h.symbol
       WHERE h.account_id = $1 AND h.quantity > 0`,
            [req.params.id]
        );
        const portfolio = result.rows.map((row) => ({
            symbol: row.symbol,
            name: row.name,
            quantity: row.quantity,
            currentPrice: row.price_kurus / 100,
            marketValue: (row.quantity * row.price_kurus) / 100,
        }));
        res.json(portfolio);
    } catch (err) {
        next(err);
    }
});

router.get('/accounts/:id/transactions', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, type, symbol, quantity, price_kurus, total_kurus, created_at
       FROM transactions WHERE account_id = $1 ORDER BY created_at DESC`,
            [req.params.id]
        );
        const transactions = result.rows.map((tx) => ({
            id: tx.id,
            type: tx.type,
            symbol: tx.symbol,
            quantity: tx.quantity,
            price: tx.price_kurus / 100,
            total: tx.total_kurus / 100,
            createdAt: tx.created_at,
        }));
        res.json(transactions);
    } catch (err) {
        next(err);
    }
});

module.exports = router;