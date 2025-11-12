const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const config = require("config");
// Giữ lại authMiddleware nếu nó được định nghĩa trong auth.js
const { authMiddleware } = require("./auth.js");

// Lấy cấu hình từ default.json
const dbConfig = config.get("dbConfig");
const JWT_SECRET = config.get("JWT_SECRET");

// API đổi bàn (PUT /api/change-table)
router.put("/change-table", authMiddleware(["EMPLOYEE"]), async (req, res) => {
  const { old_table_id, new_table_id } = req.body;
  const userId = req.user.id;

  if (!old_table_id || !new_table_id) {
    return res.status(400).json({ error: "Thiếu thông tin bàn cần đổi." });
  }

  const connection = await mysql.createConnection(dbConfig);

  try {
    await connection.beginTransaction();

    // 1️⃣ Kiểm tra bàn cũ có đơn hàng đang PENDING không
    const [orders] = await connection.execute(
      "SELECT id FROM orders WHERE table_id = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1",
      [old_table_id]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: "Không có đơn hàng nào đang hoạt động ở bàn này.",
      });
    }

    const orderId = orders[0].id;

    // 2️⃣ Kiểm tra bàn mới có đang trống không
    const [tables] = await connection.execute(
      "SELECT status FROM tables WHERE id = ?",
      [new_table_id]
    );

    if (tables.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Bàn mới không tồn tại." });
    }

    if (tables[0].status !== "Trống") {
      await connection.rollback();
      return res.status(400).json({ error: "Bàn mới hiện không trống." });
    }

    // 3️⃣ Cập nhật order sang bàn mới
    await connection.execute(
      "UPDATE orders SET table_id = ?, updated_at = NOW() WHERE id = ?",
      [new_table_id, orderId]
    );

    // 4️⃣ Cập nhật trạng thái 2 bàn
    await connection.execute(
      "UPDATE tables SET status = 'Trống' WHERE id = ?",
      [old_table_id]
    );
    await connection.execute(
      "UPDATE tables SET status = 'Có khách' WHERE id = ?",
      [new_table_id]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Đã chuyển đơn hàng #${orderId} từ bàn ${old_table_id} sang bàn ${new_table_id}.`,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Lỗi đổi bàn:", error);
    res.status(500).json({ error: "Không thể đổi bàn. Vui lòng thử lại." });
  } finally {
    await connection.end();
  }
});

module.exports = router;
