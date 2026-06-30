const express = require('express');
const { getAllStocks } = require('../services/stockService');
const router = express.Router();

router.get('/stocks', async (req, res, next) => {
    try {
        const stocks = await getAllStocks();
        res.json(stocks);
    } catch (err) {
        next(err);
    }
});

module.exports = router;