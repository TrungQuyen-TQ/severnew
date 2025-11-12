// File: routes/cook-meal_menu.js (GIỮ NGUYÊN)

const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const config = require("config");
const { authenticateToken } = require("../middlewares/auth");

const dbConfig = config.get("dbConfig");

// ✅ API Cập nhật trạng thái món (PENDING → COOKED)
router.put("/chef/cook-meal/:detail_id", authenticateToken, async (req, res) => {
  const { detail_id } = req.params;
  const connection = await mysql.createConnection(dbConfig);

  if (req.user.role !== "CHEF") {
    await connection.end();
    return res.status(403).json({ error: "Truy cập bị từ chối." });
  }

  try {
    // Chỉ cập nhật nếu trạng thái hiện tại là PENDING
    const [result] = await connection.execute(
      "UPDATE order_details SET status = 'COOKED' WHERE id = ? AND status = 'PENDING'",
      [detail_id]
    );

    await connection.end();

    if (result.affectedRows === 0) {
      // Trả về lỗi nếu món không được cập nhật (ví dụ: đã là COOKED hoặc SERVED)
      return res.status(400).json({
        error: "Không tìm thấy món đang chờ nấu hoặc món đã được nấu xong.",
      });
    }

    res.json({
      message: "✅ Đã cập nhật trạng thái món thành COOKED.",
    });
  } catch (err) {
    console.error("Lỗi API [PUT /api/chef/cook-meal]:", err);
    await connection.end();
    res
      .status(500)
      .json({ error: "Không thể cập nhật trạng thái món ăn trên máy chủ." });
  }
});

module.exports = router;