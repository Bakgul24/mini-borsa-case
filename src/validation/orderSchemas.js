// src/validation/orderSchemas.js
const { z } = require('zod');

// Hisse adedi: pozitif TAM SAYI olmalı (0, negatif, ondalık reddedilir)
const orderBodySchema = z.object({
    accountId: z.number().int().positive(),
    symbol: z.string().min(1).max(10),
    quantity: z.number().int().positive({
        message: 'quantity pozitif bir tam sayı olmalıdır',
    }),
});

module.exports = { orderBodySchema };