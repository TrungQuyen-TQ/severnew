// /routes/api.js
let express = require("express");
let router = express.Router();
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const config = require("config");
const { authMiddleware } = require("./auth.js");
const { authenticateToken, authorizeAdmin } = require("../middlewares/auth");

// Lấy cấu hình từ default.json
const dbConfig = config.get("dbConfig");
const JWT_SECRET = config.get("JWT_SECRET");

router.get("/chef/pending-meals", authenticateToken, async (req, res) => {
  // Thêm check role 'chef' nếu bạn có hàm checkRole riêng
  console.log("DEBUG: User role in /chef/pending-meals:", req.user.role);
  if (req.user.role !== "CHEF") {
    return res
      .status(403)
      .json({ error: "Truy cập bị từ chối. Chỉ dành cho Đầu bếp." });
  }

  const sql = `
        SELECT
            t.name AS Ten_Ban,
            o.id AS Order_ID,
            p.name AS Ten_Mon_An,
            od.quantity AS So_Luong,
            od.note AS Ghi_Chu,
            o.created_at AS Thoi_Gian_Order
        FROM
            tables t
        JOIN
            orders o ON t.id = o.table_id
        JOIN
            order_details od ON o.id = od.order_id
        JOIN
            products p ON od.product_id = p.id
        WHERE
            o.status = 'PENDING'
        ORDER BY
            o.created_at ASC, t.id ASC;
    `;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [results] = await connection.execute(sql);
    await connection.end();
    res.json(results);
  } catch (error) {
    console.error("Lỗi API [GET /api/chef/pending-meals]:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi truy vấn món ăn." });
  }
});

// Chức năng B: Cập nhật trạng thái đơn hàng thành 'SERVED'
router.put(
  "/chef/serve-order/:orderId",
  authenticateToken,
  async (req, res) => {
    // Thêm check role 'chef' nếu bạn có hàm checkRole riêng
    console.log("DEBUG: User role in /chef/serve-order:", req.user.role);
    if (req.user.role !== "CHEF") {
      return res
        .status(403)
        .json({ error: "Truy cập bị từ chối. Chỉ dành cho Đầu bếp." });
    }

    const orderId = req.params.orderId;
    const sql = `
        UPDATE orders
        SET status = 'COOKED'
        WHERE id = ? AND status = 'PENDING';
    `; // Chỉ update nếu đang ở trạng thái PENDING

    try {
      const connection = await mysql.createConnection(dbConfig);
      const [result] = await connection.execute(sql, [orderId]);
      await connection.end();

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message:
            "Không tìm thấy đơn hàng đang chờ hoặc đơn hàng đã được phục vụ.",
        });
      }

      res.json({
        success: true,
        message: `Đơn hàng #${orderId} đã được chuyển sang trạng thái SERVED.`,
      });
    } catch (error) {
      console.error("Lỗi API [PUT /api/chef/serve-order]:", error);
      res.status(500).json({ error: "Lỗi máy chủ khi cập nhật đơn hàng." });
    }
  }
);

module.exports = router;
