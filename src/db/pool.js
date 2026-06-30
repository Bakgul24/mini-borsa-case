require('dotenv').config();
const { Pool } = require('pg');

const connectionString =
    process.env.NODE_ENV === 'test'
        ? process.env.TEST_DATABASE_URL
        : process.env.DATABASE_URL;

const pool = new Pool({ connectionString });

const { types } = require('pg');
types.setTypeParser(20, (val) => parseInt(val, 10));

module.exports = pool;