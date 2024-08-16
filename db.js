const { Client } = require('pg');

// PostgreSQL client setup
const client = new Client({
  user: 'ta',
  host: 'combed-muskrat-9461.8nk.gcp-asia-southeast1.cockroachlabs.cloud',
  database: 'appmobileers1',
  password: '0dwdARXkw-T5hMNn2yjgQQ',
  port: 26257,
  ssl: {
    rejectUnauthorized: true,
  },
});

// Connect to CockroachDB
const connectDB = async () => {
  try {
    await client.connect();
    console.log('Connected to CockroachDB');
  } catch (err) {
    console.error('Error connecting to CockroachDB', err);
  }
};

module.exports = { client, connectDB };
