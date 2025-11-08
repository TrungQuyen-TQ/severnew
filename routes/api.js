// /routes/api.js
let express = require("express");
let router = express.Router();
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const config = require("config");
const { authenticateToken, authorizeAdmin } = require("../middlewares/auth");

// Lấy cấu hình từ default.json
const dbConfig = config.get("dbConfig");
const JWT_SECRET = config.get("JWT_SECRET");


router.get("/tables", authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute("SELECT * FROM tables ORDER BY id");
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error("Lỗi API [/api/tables]:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/products", authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      "SELECT * FROM products ORDER BY name"
    );
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error("Lỗi API [/api/products]:", error);
    res.status(500).json({ error: error.message });
  }
});

// API tạo đơn hàng mới (POST /api/order) - Chỉ dành cho nhân viên và admin
router.post("/order", authenticateToken, async (req, res) => {
  // Kiểm tra role: chỉ employee và admin mới được đặt món
  if (req.user.role !== "employee" && req.user.role !== "admin") {
    return res.status(403).json({
      error: "Chỉ nhân viên phục vụ mới có quyền đặt món.",
    });
  }
  const { table_id, items } = req.body;

  // Validate dữ liệu đầu vào
  if (!table_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error:
        "Dữ liệu đơn hàng không hợp lệ. Yêu cầu table_id và ít nhất một món.",
    });
  }

  const connection = await mysql.createConnection(dbConfig);
  try {
    // Bắt đầu transaction
    await connection.beginTransaction();

    // 1. Tạo order mới với trạng thái PENDING
    const [orderResult] = await connection.execute(
      "INSERT INTO orders (table_id, status, created_at) VALUES (?, 'PENDING', NOW())",
      [table_id]
    );
    const orderId = orderResult.insertId;

    // 2. Thêm từng món vào order_details
    for (const item of items) {
      await connection.execute(
        "INSERT INTO order_details (order_id, product_id, quantity, note) VALUES (?, ?, ?, ?)",
        [orderId, item.product_id, item.quantity, item.note || null]
      );

      // (Tùy chọn) Cập nhật số lượng tồn kho của sản phẩm
      await connection.execute(
        "UPDATE products SET quantity = GREATEST(0, quantity - ?) WHERE id = ?",
        [item.quantity, item.product_id]
      );
    }

    // Nếu mọi thứ OK, commit transaction
    await connection.commit();

    // Phản hồi thành công
    res.status(201).json({
      success: true,
      message: "Đã tạo đơn hàng thành công.",
      data: { orderId },
    });
  } catch (error) {
    // Nếu có lỗi, rollback mọi thay đổi
    await connection.rollback();
    console.error("Lỗi khi tạo đơn hàng:", error);
    res.status(500).json({
      error: "Không thể tạo đơn hàng. Vui lòng thử lại sau.",
    });
  } finally {
    // Luôn đóng kết nối DB
    await connection.end();
  }
});

// === API CHỈ DÀNH CHO ADMIN ===

// Thêm món ăn mới
router.post(
  "/products",
  authenticateToken,
  authorizeAdmin,
  async (req, res) => {
    // Logic POST /api/products từ server.js
    const { name, price, image_url } = req.body;
    try {
      const connection = await mysql.createConnection(dbConfig);
      const [result] = await connection.execute(
        "INSERT INTO products (name, price, image_url) VALUES (?, ?, ?)",
        [name, price, image_url]
      );
      await connection.end();
      res.status(201).json({
        success: true,
        message: "Thêm món ăn thành công!",
        insertedId: result.insertId,
      });
    } catch (error) {
      console.error("Lỗi API [POST /api/products]:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Sửa món ăn (PUT /api/products/:id)
router.put(
  "/products/:id",
  authenticateToken,
  authorizeAdmin,
  async (req, res) => {
    // Logic PUT /api/products/:id từ server.js
    const { id } = req.params;
    const { name, price, image_url } = req.body;
    try {
      const connection = await mysql.createConnection(dbConfig);
      await connection.execute(
        "UPDATE products SET name = ?, price = ?, image_url = ? WHERE id = ?",
        [name, price, image_url, id]
      );
      await connection.end();
      res.json({ success: true, message: "Cập nhật món ăn thành công!" });
    } catch (error) {
      console.error(`Lỗi API [PUT /api/products/${id}]:`, error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Xóa món ăn (DELETE /api/products/:id)
router.delete(
  "/products/:id",
  authenticateToken,
  authorizeAdmin,
  async (req, res) => {
    // Logic DELETE /api/products/:id từ server.js
    const { id } = req.params;
    try {
      const connection = await mysql.createConnection(dbConfig);
      await connection.execute("DELETE FROM products WHERE id = ?", [id]);
      await connection.end();
      res.json({ success: true, message: "Xóa món ăn thành công!" });
    } catch (error) {
      console.error(`Lỗi API [DELETE /api/products/${id}]:`, error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Thêm đoạn này vào cuối file /routes/api.js (trước dòng module.exports = router;)

// === API CHỈ DÀNH CHO ĐẦU BẾP (CHEF) ===

// Chức năng A: Tải danh sách món ăn đang chờ (PENDING)
router.get("/chef/pending-meals", authenticateToken, async (req, res) => {
  // Thêm check role 'chef' nếu bạn có hàm checkRole riêng
  if (req.user.role !== "chef") {
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
    if (req.user.role !== "chef") {
      return res
        .status(403)
        .json({ error: "Truy cập bị từ chối. Chỉ dành cho Đầu bếp." });
    }

    const orderId = req.params.orderId;
    const sql = `
        UPDATE orders
        SET status = 'SERVED'
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
