const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const config = require("config");
const { authenticateToken } = require("../middlewares/auth");
// Lấy cấu hình từ default.json
const dbConfig = config.get("dbConfig");

// ✅ API Lấy danh sách các bill (order) có trạng thái 'COOKED'
// ✅ API Lấy danh sách các bill có ít nhất 1 món đã nấu xong
router.get("/cooked-orders", authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT DISTINCT
        o.id AS Order_ID,
        t.name AS Ten_Ban,
        o.created_at AS Thoi_Gian_Order
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      JOIN order_details od ON o.id = od.order_id
      WHERE od.status = 'COOKED'
      ORDER BY o.created_at ASC;
    `;

    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(sql);
    await conn.end();

    res.json(rows);
  } catch (err) {
    console.error("❌ Lỗi /api/cooked-orders:", err);
    res.status(500).json({
      error: "Không thể tải danh sách bill có món đã nấu xong.",
    });
  }
});

module.exports = router;
