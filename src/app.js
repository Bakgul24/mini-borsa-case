require('dotenv').config();
const express = require('express');

const stockRoutes = require('./routes/stockRoutes');
const accountRoutes = require('./routes/accountRoutes');
const orderRoutes = require('./routes/orderRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(express.json());

app.use(stockRoutes);
app.use(accountRoutes);
app.use(orderRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

module.exports = app;