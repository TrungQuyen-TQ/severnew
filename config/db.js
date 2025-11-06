const mysql = require('mysql2');
const config = require('config'); // npm install config

// Lấy thông tin kết nối từ default.json
const dbConfig = config.get('dbConfig');

const pool = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  port: dbConfig.port || 3306, // nếu bạn không có port thì mặc định 3306
  connectionLimit: 10
});

module.exports = pool.promise();
