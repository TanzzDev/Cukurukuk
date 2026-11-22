// Entry Vercel: SELURUH API berjalan di satu serverless function (Express).
// vercel.json mengarahkan /api/* ke sini; handler asli ada di server/handlers/.
module.exports = require('../server.cjs');
