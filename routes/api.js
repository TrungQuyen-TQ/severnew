// /routes/api.js
let express = require('express');
let router = express.Router();
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const config = require('config');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

// Lấy cấu hình từ default.json
const dbConfig = config.get('dbConfig');
const JWT_SECRET = config.get('JWT_SECRET');

// === API ĐĂNG NHẬP (/api/login) ===
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  // LƯU Ý: Vẫn cần BCRYPT để bảo mật! Tôi giữ nguyên logic so sánh cũ để bạn thấy rõ nguồn.
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [users] = await connection.execute(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    await connection.end();

    if (users.length === 0) {
      return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." });
    }
    const user = users[0];
    if (password !== user.password) {
      return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, role: user.role, username: user.username });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// === API CHO TẤT CẢ NHÂN VIÊN (YÊU CẦU ĐĂNG NHẬP) ===

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

// ... thêm route POST /api/order nếu cần xử lý đặt món vào DB ...

// === API CHỈ DÀNH CHO ADMIN ===

// Thêm món ăn mới
router.post("/products", authenticateToken, authorizeAdmin, async (req, res) => {
    // Logic POST /api/products từ server.js
    const { name, price, image_url } = req.body;
    try {
      const connection = await mysql.createConnection(dbConfig);
      const [result] = await connection.execute(
        "INSERT INTO products (name, price, image_url) VALUES (?, ?, ?)",
        [name, price, image_url]
      );
      await connection.end();
      res.status(201).json({ success: true, message: "Thêm món ăn thành công!", insertedId: result.insertId });
    } catch (error) {
      console.error("Lỗi API [POST /api/products]:", error);
      res.status(500).json({ error: error.message });
    }
});

// Sửa món ăn (PUT /api/products/:id)
router.put("/products/:id", authenticateToken, authorizeAdmin, async (req, res) => {
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
});

// Xóa món ăn (DELETE /api/products/:id)
router.delete("/products/:id", authenticateToken, authorizeAdmin, async (req, res) => {
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
});

module.exports = router;