const express = require('express');
const { getAccount, getPortfolio, getTransactions } = require('../services/accountService');
const router = express.Router();

router.get('/accounts/:id', async (req, res, next) => {
    try {
        const account = await getAccount(req.params.id);
        res.json(account);
    } catch (err) {
        next(err);
    }
});

router.get('/accounts/:id/portfolio', async (req, res, next) => {
    try {
        const portfolio = await getPortfolio(req.params.id);
        res.json(portfolio);
    } catch (err) {
        next(err);
    }
});

router.get('/accounts/:id/transactions', async (req, res, next) => {
    try {
        const transactions = await getTransactions(req.params.id);
        res.json(transactions);
    } catch (err) {
        next(err);
    }
});

module.exports = router;