const orderBodySchema = z.object({
    accountId: z.number().int().positive(),
    symbol: z.string().min(1).max(10),
    quantity: z.number({
        message: 'quantity sayısal bir değer olmalıdır',
    }).int({
        message: 'quantity tam sayı olmalıdır (ondalıklı değer kabul edilmez)',
    }).positive({
        message: 'quantity pozitif bir değer olmalıdır (sıfır veya negatif kabul edilmez)',
    }),
});