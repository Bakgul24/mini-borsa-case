// src/db/withTransaction.js
//
// Verilen fonksiyonu bir veritabanı transaction'ı içinde çalıştırır.
// Fonksiyon başarılıysa COMMIT yapılır, hata fırlatırsa ROLLBACK yapılır.
// Fonksiyona, transaction'a bağlı TEK bir "client" verilir - tüm sorgular
// bu client üzerinden gitmeli, aksi halde aynı transaction'da olmazlar.

const pool = require('./pool');

async function withTransaction(fn) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err; // hatayı çağırana ilet, sessizce yutmuyoruz
    } finally {
        client.release(); // bağlantıyı pool'a geri ver (her durumda, hata olsa da olmasa da)
    }
}

module.exports = withTransaction;