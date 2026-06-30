const express = require('express');
const { validateBody } = require('../middleware/validate');
const { orderBodySchema } = require('../validation/orderSchemas');
const { buyStock, sellStock } = require('../services/orderService');

const router = express.Router();

router.post('/orders/buy', validateBody(orderBodySchema), async (req, res, next) => {
    try {
        const { accountId, symbol, quantity } = req.body;
        const result = await buyStock(accountId, symbol, quantity);
        res.status(201).json({
            transaction: { ...result.transaction, price: result.transaction.price_kurus / 100, total: result.transaction.total_kurus / 100 },
            newCashBalance: result.cashBalanceKurus / 100,
        });
    } catch (err) {
        next(err);
    }
});

router.post('/orders/sell', validateBody(orderBodySchema), async (req, res, next) => {
    try {
        const { accountId, symbol, quantity } = req.body;
        const result = await sellStock(accountId, symbol, quantity);
        res.status(201).json({
            transaction: { ...result.transaction, price: result.transaction.price_kurus / 100, total: result.transaction.total_kurus / 100 },
            newCashBalance: result.cashBalanceKurus / 100,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;