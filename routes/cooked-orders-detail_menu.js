const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const config = require("config");
// Giữ lại authMiddleware nếu nó được định nghĩa trong auth.js
const { authMiddleware } = require("./auth.js");
const { authenticateToken } = require("../middlewares/auth");
// Lấy cấu hình từ default.json
const dbConfig = config.get("dbConfig");

// ✅ API Lấy chi tiết bill (chỉ lấy món đã nấu xong - COOKED)
router.get("/cooked-orders/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `
      SELECT 
        od.id AS order_detail_id,
        p.image_url AS image,
        p.name AS TenMon,
        od.quantity AS SoLuong,
        od.note AS GhiChu,
        od.status AS TrangThai
      FROM order_details od
      JOIN products p ON od.product_id = p.id
      WHERE od.order_id = ?
        AND od.status = 'COOKED';
    `;
    const conn = await mysql.createConnection(dbConfig);
    const [details] = await conn.execute(sql, [id]);
    await conn.end();
    res.json(details);
  } catch (err) {
    console.error("❌ Lỗi /api/cooked-orders/:id:", err);
    res.status(500).json({ error: "Không thể tải chi tiết bill." });
  }
});

module.exports = router;
