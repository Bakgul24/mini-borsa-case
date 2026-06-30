// src/middleware/validate.js
const { ValidationError } = require('../errors');

function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const message = result.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');
            return next(new ValidationError(message));
        }

        req.body = result.data; // doğrulanmış/dönüştürülmüş veriyi kullan
        next();
    };
}

module.exports = { validateBody };