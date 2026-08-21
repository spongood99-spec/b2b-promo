const { Pool, types } = require('pg');

// ponytail: pg parses DATE columns into JS Date objects at local midnight, which
// then serialize to a UTC ISO string and shift the calendar day (e.g. KST -9h).
// DATE columns have no time-of-day meaning, so keep them as the raw 'YYYY-MM-DD'
// string pg already receives from the wire instead of round-tripping through Date.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;
