// src/services/orderService.js
//
// Alım/satım iş mantığının tamamı burada. Her iki işlem de tek bir DB
// transaction'ı içinde, hesap satırını KİLİTLEYEREK (FOR UPDATE) çalışır.

const withTransaction = require('../db/withTransaction');
const { NotFoundError, BusinessRuleError } = require('../errors');

async function buyStock(accountId, symbol, quantity) {
    return withTransaction(async (client) => {
        // 1) Hisseyi bul (fiyatı almak için)
        const stockResult = await client.query(
            'SELECT symbol, price_kurus FROM stocks WHERE symbol = $1',
            [symbol]
        );
        if (stockResult.rows.length === 0) {
            throw new NotFoundError(`${symbol} sembolü bulunamadı`);
        }
        const stock = stockResult.rows[0];

        // 2) Hesabı KİLİTLE (FOR UPDATE) - aynı hesaba aynı anda gelen başka bir
        //    isteğin bu satırı okumasını, BU transaction commit/rollback olana
        //    kadar engeller. Bu, "double-spend" / race condition'ı önler.
        const accountResult = await client.query(
            'SELECT id, cash_balance_kurus FROM accounts WHERE id = $1 FOR UPDATE',
            [accountId]
        );
        if (accountResult.rows.length === 0) {
            throw new NotFoundError(`${accountId} numaralı hesap bulunamadı`);
        }
        const account = accountResult.rows[0];

        // 3) Toplam tutarı hesapla (tam sayı çarpımı, float yok)
        const totalKurus = quantity * stock.price_kurus;

        // 4) Yeterli bakiye var mı kontrol et
        if (account.cash_balance_kurus < totalKurus) {
            throw new BusinessRuleError(
                `Yetersiz bakiye: gerekli ${totalKurus / 100} TL, mevcut ${account.cash_balance_kurus / 100} TL`
            );
        }

        // 5) Bakiyeyi düş
        const newBalance = account.cash_balance_kurus - totalKurus;
        await client.query(
            'UPDATE accounts SET cash_balance_kurus = $1 WHERE id = $2',
            [newBalance, accountId]
        );

        // 6) Portföyü güncelle (varsa miktarı artır, yoksa yeni satır oluştur)
        await client.query(
            `INSERT INTO holdings (account_id, symbol, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id, symbol)
       DO UPDATE SET quantity = holdings.quantity + $3`,
            [accountId, symbol, quantity]
        );

        // 7) İşlemi kaydet (ledger - değişmez defter kaydı)
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

        // Hesabı kilitle (BUY'daki aynı sebep)
        const accountResult = await client.query(
            'SELECT id, cash_balance_kurus FROM accounts WHERE id = $1 FOR UPDATE',
            [accountId]
        );
        if (accountResult.rows.length === 0) {
            throw new NotFoundError(`${accountId} numaralı hesap bulunamadı`);
        }
        const account = accountResult.rows[0];

        // Mevcut holding'i kontrol et (satılacak kadar hisse var mı)
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