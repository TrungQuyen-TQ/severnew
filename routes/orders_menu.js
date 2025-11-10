// routes/orders.route.js
const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const config = require("config");
// Giữ lại authMiddleware nếu nó được định nghĩa trong auth.js
const { authMiddleware } = require("./auth.js");

// Lấy cấu hình từ default.json
const dbConfig = config.get("dbConfig");

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

module.exports = router;
