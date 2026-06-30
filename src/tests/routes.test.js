const request = require('supertest');
const { resetDatabase } = require('./setup');
const pool = require('../db/pool');
const app = require('../app');

beforeEach(async () => {
    await resetDatabase();
});

afterAll(async () => {
    await pool.end();
});

describe('GET /stocks', () => {
    test('200 ve hisse listesini döner', async () => {
        const res = await request(app).get('/stocks');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(3);
        expect(res.body[0]).toHaveProperty('symbol');
        expect(res.body[0]).toHaveProperty('price');
    });
});

describe('GET /accounts/:id', () => {
    test('var olan hesap için 200 döner', async () => {
        const res = await request(app).get('/accounts/1');
        expect(res.status).toBe(200);
        expect(res.body.cashBalance).toBe(100000);
    });

    test('olmayan hesap için 404 ve anlamlı mesaj döner', async () => {
        const res = await request(app).get('/accounts/999');
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/bulunamadı/);
    });
});

describe('POST /orders/buy', () => {
    test('geçerli istekte 201 ve işlem detayını döner', async () => {
        const res = await request(app)
            .post('/orders/buy')
            .send({ accountId: 1, symbol: 'THYAO', quantity: 5 });

        expect(res.status).toBe(201);
        expect(res.body.transaction.type).toBe('BUY');
        expect(res.body.newCashBalance).toBe(100000 - 1500);
    });

    test('negatif quantity için 400 döner', async () => {
        const res = await request(app)
            .post('/orders/buy')
            .send({ accountId: 1, symbol: 'THYAO', quantity: -5 });

        expect(res.status).toBe(400);
    });

    test('ondalıklı quantity için 400 döner', async () => {
        const res = await request(app)
            .post('/orders/buy')
            .send({ accountId: 1, symbol: 'THYAO', quantity: 2.5 });

        expect(res.status).toBe(400);
    });

    test('olmayan sembol için 404 döner', async () => {
        const res = await request(app)
            .post('/orders/buy')
            .send({ accountId: 1, symbol: 'XXXXX', quantity: 5 });

        expect(res.status).toBe(404);
    });

    test('yetersiz bakiyede 422 döner', async () => {
        const res = await request(app)
            .post('/orders/buy')
            .send({ accountId: 1, symbol: 'THYAO', quantity: 999999 });

        expect(res.status).toBe(422);
    });
});

describe('POST /orders/sell', () => {
    test('yetersiz hissede 422 döner', async () => {
        const res = await request(app)
            .post('/orders/sell')
            .send({ accountId: 1, symbol: 'THYAO', quantity: 5 });

        expect(res.status).toBe(422);
    });

    test('geçerli satışta 201 döner', async () => {
        await request(app).post('/orders/buy').send({ accountId: 1, symbol: 'THYAO', quantity: 10 });

        const res = await request(app)
            .post('/orders/sell')
            .send({ accountId: 1, symbol: 'THYAO', quantity: 4 });

        expect(res.status).toBe(201);
        expect(res.body.transaction.type).toBe('SELL');
    });
});

describe('GET /accounts/:id/portfolio', () => {
    test('alım sonrası portföyde doğru veriyi döner', async () => {
        await request(app).post('/orders/buy').send({ accountId: 1, symbol: 'GARAN', quantity: 7 });

        const res = await request(app).get('/accounts/1/portfolio');
        expect(res.status).toBe(200);
        expect(res.body[0].symbol).toBe('GARAN');
        expect(res.body[0].quantity).toBe(7);
    });

    test('olmayan hesap için 404 döner', async () => {
        const res = await request(app).get('/accounts/999/portfolio');
        expect(res.status).toBe(404);
    });
});

describe('GET /accounts/:id/transactions', () => {
    test('işlemler tarihe göre yeniden eskiye sıralı döner', async () => {
        await request(app).post('/orders/buy').send({ accountId: 1, symbol: 'THYAO', quantity: 1 });
        await request(app).post('/orders/buy').send({ accountId: 1, symbol: 'GARAN', quantity: 1 });

        const res = await request(app).get('/accounts/1/transactions');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body[0].symbol).toBe('GARAN');
    });
});