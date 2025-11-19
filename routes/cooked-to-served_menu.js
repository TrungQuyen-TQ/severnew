let express = require("express");
let router = express.Router();
const mysql = require("mysql2/promise");
const config = require("config");

const { authenticateToken, authorizeAdmin } = require("../middlewares/auth");

const dbConfig = config.get("dbConfig");

// ✅ API Cập nhật trạng thái món (COOKED → SERVED)
router.put("/serve-item/:detail_id", authenticateToken, async (req, res) => {
  const { detail_id } = req.params;
  const connection = await mysql.createConnection(dbConfig);

  try {
    // 🔹 1. Kiểm tra món có tồn tại không
    const [rows] = await connection.execute(
      "SELECT order_id, status FROM order_details WHERE id = ?",
      [detail_id]
    );

    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ error: "Không tìm thấy món ăn này." });
    }

    const { order_id, status } = rows[0];

    if (status === "SERVED") {
      await connection.end();
      return res.json({ message: "✅ Món này đã được phục vụ trước đó." });
    }

    // 🔹 2. Cập nhật trạng thái món thành SERVED
    await connection.execute(
      "UPDATE order_details SET status = 'SERVED' WHERE id = ?",
      [detail_id]
    );

    // 🔹 3. Kiểm tra nếu tất cả món của bill đã SERVED thì cập nhật bill
    const [remaining] = await connection.execute(
      "SELECT COUNT(*) AS count FROM order_details WHERE order_id = ? AND status != 'SERVED'",
      [order_id]
    );

    if (remaining[0].count === 0) {
      await connection.execute(
        "UPDATE orders SET status = 'SERVED', updated_at = NOW() WHERE id = ?",
        [order_id]
      );
    }

    await connection.end();
    res.json({
      message: "✅ Đã cập nhật trạng thái món thành SERVED.",
    });
  } catch (err) {
    console.error("Lỗi API [PUT /api/serve-item]:", err);
    await connection.end();
    res
      .status(500)
      .json({ error: "Không thể cập nhật trạng thái món ăn trên máy chủ." });
  }
});

module.exports = router;