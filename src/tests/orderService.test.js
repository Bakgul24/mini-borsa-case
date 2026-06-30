const { resetDatabase } = require('./setup');
const pool = require('../db/pool');
const { buyStock, sellStock } = require('../services/orderService');
const { NotFoundError, BusinessRuleError } = require('../errors');

beforeEach(async () => {
    await resetDatabase();
});

afterAll(async () => {
    await pool.end();
});

describe('buyStock', () => {
    test('yeterli bakiyeyle başarılı alım yapar, bakiyeyi ve portföyü günceller', async () => {
        const result = await buyStock(1, 'THYAO', 10);

        expect(result.transaction.type).toBe('BUY');
        expect(result.transaction.quantity).toBe(10);
        expect(result.transaction.total_kurus).toBe(300000); // 10 * 30000
        expect(result.cashBalanceKurus).toBe(10000000 - 300000);

        const holding = await pool.query(
            'SELECT quantity FROM holdings WHERE account_id = 1 AND symbol = $1',
            ['THYAO']
        );
        expect(holding.rows[0].quantity).toBe(10);
    });

    test('yetersiz bakiyede BusinessRuleError fırlatır, hiçbir şeyi değiştirmez', async () => {
        await expect(buyStock(1, 'THYAO', 999999)).rejects.toThrow(BusinessRuleError);

        const account = await pool.query('SELECT cash_balance_kurus FROM accounts WHERE id = 1');
        expect(account.rows[0].cash_balance_kurus).toBe(10000000);
    });

    test('olmayan sembolde NotFoundError fırlatır', async () => {
        await expect(buyStock(1, 'XXXXX', 10)).rejects.toThrow(NotFoundError);
    });

    test('olmayan hesapta NotFoundError fırlatır', async () => {
        await expect(buyStock(999, 'THYAO', 10)).rejects.toThrow(NotFoundError);
    });

    test('aynı sembolden ikinci kez alınca miktar toplanır (üst üste eklenir)', async () => {
        await buyStock(1, 'THYAO', 5);
        await buyStock(1, 'THYAO', 3);

        const holding = await pool.query(
            'SELECT quantity FROM holdings WHERE account_id = 1 AND symbol = $1',
            ['THYAO']
        );
        expect(holding.rows[0].quantity).toBe(8);
    });
});

describe('sellStock', () => {
    test('yeterli hisseyle başarılı satış yapar, bakiyeyi artırır', async () => {
        await buyStock(1, 'THYAO', 10);
        const result = await sellStock(1, 'THYAO', 4);

        expect(result.transaction.type).toBe('SELL');
        expect(result.transaction.quantity).toBe(4);

        const holding = await pool.query(
            'SELECT quantity FROM holdings WHERE account_id = 1 AND symbol = $1',
            ['THYAO']
        );
        expect(holding.rows[0].quantity).toBe(6); // 10 - 4
    });

    test('hiç hisse yokken satış denenirse BusinessRuleError fırlatır', async () => {
        await expect(sellStock(1, 'THYAO', 1)).rejects.toThrow(BusinessRuleError);
    });

    test('sahip olunandan fazla satış denenirse BusinessRuleError fırlatır', async () => {
        await buyStock(1, 'THYAO', 5);
        await expect(sellStock(1, 'THYAO', 10)).rejects.toThrow(BusinessRuleError);

        const holding = await pool.query(
            'SELECT quantity FROM holdings WHERE account_id = 1 AND symbol = $1',
            ['THYAO']
        );
        expect(holding.rows[0].quantity).toBe(5); // hâlâ 5, rollback çalıştı
    });
});

describe('eşzamanlılık (concurrency) - FOR UPDATE kilidinin doğru çalıştığını kanıtlar', () => {
    test('aynı hesaba aynı anda gelen iki alım isteği, bakiyeyi YANLIŞ hesaplamamalı', async () => {

        const results = await Promise.allSettled([
            buyStock(1, 'THYAO', 200),
            buyStock(1, 'THYAO', 200),
        ]);

        const succeeded = results.filter((r) => r.status === 'fulfilled');
        const failed = results.filter((r) => r.status === 'rejected');

        expect(succeeded.length).toBe(1);
        expect(failed.length).toBe(1);

        const account = await pool.query('SELECT cash_balance_kurus FROM accounts WHERE id = 1');
        expect(account.rows[0].cash_balance_kurus).toBeGreaterThanOrEqual(0);
        expect(account.rows[0].cash_balance_kurus).toBe(10000000 - 60000 * 100); // sadece 1 alım gerçekleşti üzerinden hesap
    });
});