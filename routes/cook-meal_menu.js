// File: cook-meal_menu.js (ĐÃ BỔ SUNG API CƠ BẢN)

const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const config = require("config");
const { authenticateToken } = require("../middlewares/auth");

const dbConfig = config.get("dbConfig");

// ✅ 1. API CẬP NHẬT MÓN ĂN (PENDING → COOKED) - THIẾU BỊ BỔ SUNG
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
      // Trả về lỗi 400 nếu món đã COOKED/SERVED hoặc không tồn tại
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


// ✅ 2. API KIỂM TRA HOÀN THÀNH BILL (orders.status)
router.put("/chef/check-complete-cooking/:orderId", authenticateToken, async (req, res) => {
  const { orderId } = req.params;
  const connection = await mysql.createConnection(dbConfig);

  if (req.user.role !== "CHEF" && req.user.role !== "MANAGER") { 
    await connection.end();
    return res.status(403).json({ error: "Truy cập bị từ chối." });
  }

  try {
    // 1. Kiểm tra xem còn món nào đang PENDING không
    const [pendingCount] = await connection.execute(
      "SELECT COUNT(*) AS count FROM order_details WHERE order_id = ? AND status = 'PENDING'",
      [orderId]
    );

    if (pendingCount[0].count === 0) {
      // 2. Nếu không còn món PENDING, cập nhật orders.status thành 'COOKED'
      const [updateResult] = await connection.execute(
        "UPDATE orders SET status = 'COOKED', updated_at = NOW() WHERE id = ? AND status = 'PENDING'",
        [orderId]
      );
      
      await connection.end();

      if (updateResult.affectedRows > 0) {
        return res.json({ message: "Bill đã hoàn thành công đoạn Bếp và chuyển sang trạng thái COOKED." });
      }
      return res.json({ message: "Bill đã hoàn thành công đoạn Bếp (hoặc đã ở trạng thái COOKED/SERVED)." });
    }

    await connection.end();
    res.json({ message: "Vẫn còn món đang chờ nấu." });

  } catch (err) {
    console.error("Lỗi API [PUT /api/chef/check-complete-cooking]:", err);
    await connection.end();
    res
      .status(500)
      .json({ error: "Không thể kiểm tra và cập nhật trạng thái bill trên máy chủ." });
  }
});

module.exports = router;