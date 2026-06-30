// src/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;

    if (statusCode === 500) {
        console.error('Beklenmeyen hata:', err);
    }

    res.status(statusCode).json({
        error: err.message || 'Sunucu hatası',
    });
}

module.exports = errorHandler;