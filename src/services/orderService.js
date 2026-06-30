const withTransaction = require('../db/withTransaction');
const { NotFoundError, BusinessRuleError } = require('../errors');

async function buyStock(accountId, symbol, quantity) {
    return withTransaction(async (client) => {
        const stockResult = await client.query(
            'SELECT symbol, price_kurus FROM stocks WHERE symbol = $1',
            [symbol]
        );
        if (stockResult.rows.length === 0) {
            throw new NotFoundError(`${symbol} sembolü bulunamadı`);
        }
        const stock = stockResult.rows[0];

        const accountResult = await client.query(
            'SELECT id, cash_balance_kurus FROM accounts WHERE id = $1 FOR UPDATE',
            [accountId]
        );
        if (accountResult.rows.length === 0) {
            throw new NotFoundError(`${accountId} numaralı hesap bulunamadı`);
        }
        const account = accountResult.rows[0];

        const totalKurus = quantity * stock.price_kurus;

        if (account.cash_balance_kurus < totalKurus) {
            throw new BusinessRuleError(
                `Yetersiz bakiye: gerekli ${totalKurus / 100} TL, mevcut ${account.cash_balance_kurus / 100} TL`
            );
        }

        const newBalance = account.cash_balance_kurus - totalKurus;
        await client.query(
            'UPDATE accounts SET cash_balance_kurus = $1 WHERE id = $2',
            [newBalance, accountId]
        );

        await client.query(
            `INSERT INTO holdings (account_id, symbol, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id, symbol)
       DO UPDATE SET quantity = holdings.quantity + $3`,
            [accountId, symbol, quantity]
        );

        const txResult = await client.query(
            `INSERT INTO transactions (account_id, type, symbol, quantity, price_kurus, total_kurus)
       VALUES ($1, 'BUY', $2, $3, $4, $5)
       RETURNING id, account_id, type, symbol, quantity, price_kurus, total_kurus, created_at`,
            [accountId, symbol, quantity, stock.price_kurus, totalKurus]
        );

        return { transaction: txResult.rows[0], cashBalanceKurus: newBalance };
    });
}

async function sellStock(accountId, symbol, quantity) {
    return withTransaction(async (client) => {
        const stockResult = await client.query(
            'SELECT symbol, price_kurus FROM stocks WHERE symbol = $1',
            [symbol]
        );
        if (stockResult.rows.length === 0) {
            throw new NotFoundError(`${symbol} sembolü bulunamadı`);
        }
        const stock = stockResult.rows[0];

        const accountResult = await client.query(
            'SELECT id, cash_balance_kurus FROM accounts WHERE id = $1 FOR UPDATE',
            [accountId]
        );
        if (accountResult.rows.length === 0) {
            throw new NotFoundError(`${accountId} numaralı hesap bulunamadı`);
        }
        const account = accountResult.rows[0];

        const holdingResult = await client.query(
            'SELECT quantity FROM holdings WHERE account_id = $1 AND symbol = $2',
            [accountId, symbol]
        );
        const currentQuantity = holdingResult.rows.length > 0 ? holdingResult.rows[0].quantity : 0;

        if (currentQuantity < quantity) {
            throw new BusinessRuleError(
                `Yetersiz hisse: ${symbol} için sahip olunan miktar ${currentQuantity}, satılmak istenen ${quantity}`
            );
        }

        const totalKurus = quantity * stock.price_kurus;
        const newBalance = account.cash_balance_kurus + totalKurus;

        await client.query(
            'UPDATE accounts SET cash_balance_kurus = $1 WHERE id = $2',
            [newBalance, accountId]
        );

        await client.query(
            'UPDATE holdings SET quantity = quantity - $1 WHERE account_id = $2 AND symbol = $3',
            [quantity, accountId, symbol]
        );

        const txResult = await client.query(
            `INSERT INTO transactions (account_id, type, symbol, quantity, price_kurus, total_kurus)
       VALUES ($1, 'SELL', $2, $3, $4, $5)
       RETURNING id, account_id, type, symbol, quantity, price_kurus, total_kurus, created_at`,
            [accountId, symbol, quantity, stock.price_kurus, totalKurus]
        );

        return { transaction: txResult.rows[0], cashBalanceKurus: newBalance };
    });
}

module.exports = { buyStock, sellStock };