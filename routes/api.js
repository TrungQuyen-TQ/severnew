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
router.post(
  "/order",
  authMiddleware(["EMPLOYEE", "ADMIN"]), // Chỉ cho phép EMPLOYEE hoặc ADMIN
  async (req, res) => {
    const { table_id, items, note } = req.body;

    // Lấy thông tin người dùng từ token sau khi authMiddleware chạy
    // Role đã được kiểm tra, ta chỉ cần lấy ID
    const userId = req.user.id;

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

      // 🔹 1. Duyệt từng món trong đơn hàng để kiểm tra tồn kho
      for (const item of items) {
        const [result] = await connection.query(
          "SELECT name, quantity FROM products WHERE id = ?",
          [item.product_id]
        );

        if (result.length === 0) {
          throw new Error(`Món ăn ID ${item.product_id} không tồn tại.`);
        }

        const product = result[0];
        if (product.quantity <= 0) {
          await connection.rollback();
          return res
            .status(400)
            .json({ message: `Món "${product.name}" đã hết hàng.` });
        }
        if (product.quantity < item.quantity) {
          await connection.rollback();
          return res.status(400).json({
            message: `Món "${product.name}" chỉ còn ${product.quantity} phần, không đủ để đặt ${item.quantity} phần.`,
          });
        }
      }

      // 1. Tạo order mới với trạng thái PENDING
      // Chèn table_id, user_id (người tạo đơn), status và note
      const [orderResult] = await connection.execute(
        "INSERT INTO orders (table_id, user_id, status, note, created_at) VALUES (?, ?, 'PENDING', ?, NOW())",
        [table_id, userId, note || null]
      );
      const orderId = orderResult.insertId;

      // 2. Thêm từng món vào order_details
      for (const item of items) {
        // Lấy giá sản phẩm từ DB (Bảo mật: không tin tưởng giá từ Frontend)
        const [productRows] = await connection.execute(
          "SELECT price FROM products WHERE id = ?",
          [item.product_id]
        );

        if (productRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({
            error: `Không tìm thấy sản phẩm có ID: ${item.product_id}`,
          });
        }

        const price = productRows[0].price;

        await connection.execute(
          "INSERT INTO order_details (order_id, product_id, quantity, price, note) VALUES (?, ?, ?, ?, ?)",
          [orderId, item.product_id, item.quantity, price, item.note || null]
        );

        // CẬP NHẬT TỒN KHO
        await connection.execute(
          "UPDATE products SET quantity = GREATEST(0, quantity - ?) WHERE id = ?",
          [item.quantity, item.product_id]
        );
      }

      // 3. TÍNH TOÁN VÀ CẬP NHẬT total_amount
      const [totalResult] = await connection.execute(
        "SELECT SUM(quantity * price) AS total FROM order_details WHERE order_id = ?",
        [orderId]
      );
      const totalAmount = totalResult[0].total || 0;

      await connection.execute(
        "UPDATE orders SET total_amount = ? WHERE id = ?",
        [totalAmount, orderId]
      );

      // 4. CẬP NHẬT TRẠNG THÁI BÀN
      await connection.execute(
        "UPDATE tables SET status = 'Có khách' WHERE id = ?",
        [table_id]
      );

      // Nếu mọi thứ OK, commit transaction
      await connection.commit();

      // Phản hồi thành công
      res.status(201).json({
        success: true,
        message: "Đã tạo đơn hàng thành công.",
        data: { orderId, totalAmount },
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
  }
);

// API đổi bàn (PUT /api/change-table)
// Chỉ cho phép EMPLOYEE
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

// ✅ Lấy danh sách các bill (order) có trạng thái 'COOKED'
router.get("/cooked-orders", authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT 
        t.name AS Ten_Ban,
        o.id AS Order_ID,
        o.created_at AS Thoi_Gian_Order
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE o.status = 'COOKED'
      ORDER BY o.created_at ASC;
    `;

    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(sql);
    await conn.end();

    res.json(rows);
  } catch (err) {
    console.error("❌ Lỗi /api/cooked-orders:", err);
    res
      .status(500)
      .json({ error: "Không thể tải danh sách bill có trạng thái COOKED." });
  }
});

// ✅ Lấy chi tiết bill (chỉ lấy món đã nấu xong - COOKED)
router.get("/cooked-orders/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `
      SELECT 
        od.id AS order_detail_id,
        p.image_url AS image,
        p.name AS TenMon,
        od.quantity AS SoLuong,
        od.note AS GhiChu
      FROM order_details od
      JOIN products p ON od.product_id = p.id
      WHERE od.order_id = ?;
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

// ✅ Cập nhật trạng thái món (COOKED → SERVED)
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
