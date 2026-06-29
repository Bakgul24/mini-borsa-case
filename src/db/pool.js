// src/db/pool.js
//
// Tek bir PostgreSQL connection pool oluşturur. Tüm uygulama bu pool'u kullanır.
// NODE_ENV=test ise TEST_DATABASE_URL'e, değilse DATABASE_URL'e bağlanır.

require('dotenv').config();
const { Pool } = require('pg');

const connectionString =
    process.env.NODE_ENV === 'test'
        ? process.env.TEST_DATABASE_URL
        : process.env.DATABASE_URL;

const pool = new Pool({ connectionString });

// BIGINT (Postgres tipi 20), Node'un Number.MAX_SAFE_INTEGER sınırını aşabileceği
// için pg varsayılan olarak STRING döndürür. Bizim kuruş değerlerimiz bu sınırın
// çok altında olduğu için, number'a çeviriyoruz - aksi halde bakiye aritmetiği
// yanlışlıkla string birleştirmesine dönüşebilir (örn. "100" - 50 yerine "100-50").
const { types } = require('pg');
types.setTypeParser(20, (val) => parseInt(val, 10));

module.exports = pool;