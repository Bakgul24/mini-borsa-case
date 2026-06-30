// src/services/accountService.js
const pool = require('../db/pool');
const { NotFoundError } = require('../errors');

async function getAccount(accountId) {
    const result = await pool.query(
        'SELECT id, cash_balance_kurus FROM accounts WHERE id = $1',
        [accountId]
    );
    if (result.rows.length === 0) {
        throw new NotFoundError(`${accountId} numaralı hesap bulunamadı`);
    }
    const account = result.rows[0];
    return { id: account.id, cashBalance: account.cash_balance_kurus / 100 };
}

async function getPortfolio(accountId) {
    await assertAccountExists(accountId);

    const result = await pool.query(
        `SELECT h.symbol, s.name, h.quantity, s.price_kurus
     FROM holdings h
     JOIN stocks s ON s.symbol = h.symbol
     WHERE h.account_id = $1 AND h.quantity > 0`,
        [accountId]
    );

    return result.rows.map((row) => ({
        symbol: row.symbol,
        name: row.name,
        quantity: row.quantity,
        currentPrice: row.price_kurus / 100,
        marketValue: (row.quantity * row.price_kurus) / 100,
    }));
}

async function getTransactions(accountId) {
    await assertAccountExists(accountId);

    const result = await pool.query(
        `SELECT id, type, symbol, quantity, price_kurus, total_kurus, created_at
     FROM transactions WHERE account_id = $1 ORDER BY created_at DESC`,
        [accountId]
    );

    return result.rows.map((tx) => ({
        id: tx.id,
        type: tx.type,
        symbol: tx.symbol,
        quantity: tx.quantity,
        price: tx.price_kurus / 100,
        total: tx.total_kurus / 100,
        createdAt: tx.created_at,
    }));
}

async function assertAccountExists(accountId) {
    const result = await pool.query('SELECT id FROM accounts WHERE id = $1', [accountId]);
    if (result.rows.length === 0) {
        throw new NotFoundError(`${accountId} numaralı hesap bulunamadı`);
    }
}

module.exports = { getAccount, getPortfolio, getTransactions };