// routes/auth.js
import express from "express";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import config from "config";

const router = express.Router();
const JWT_SECRET = config.get('JWT_SECRET') || "supersecretkey"; // prefer config/default.json or env

// MySQL pool (cấu hình database) - load from config/default.json
const dbConfig = config.get('dbConfig');
const pool = mysql.createPool(dbConfig);

// Middleware để parse cookie
router.use(cookieParser());

// ==============================
// Middleware kiểm tra JWT + role
// ==============================
export const authMiddleware = (roles = []) => {
  // roles = [] nghĩa là cho tất cả role
  return async (req, res, next) => {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;

      // Kiểm tra role nếu có truyền roles
      if (roles.length > 0 && !roles.includes(req.user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      next();
    } catch (err) {
      console.error(err);
      res.status(401).json({ error: "Unauthorized" });
    }
  };
};

// ==============================
// LOGIN
// ==============================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    // --- LOG A: Kiểm tra dữ liệu nhận từ Frontend ---
    console.log("DEBUG: Login attempt for user:", username);
    console.log("DEBUG: Password received (plaintext):", password);
    // Kiểm tra DB
    const [users] = await pool.execute("SELECT * FROM users WHERE username = ?", [username]);
    if (users.length === 0) return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." });

    const user = users[0];
// --- LOG C: Kiểm tra Hash lưu trong DB ---
    console.log("DEBUG: Hash stored in DB:", user.password);
    // So sánh mật khẩu hash
    
    const match = await bcrypt.compare(password, user.password);
    console.log("DEBUG: bcrypt.compare result:", match);

    if (!match) return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." });

    // Tạo token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Gửi cookie HttpOnly
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // true nếu deploy HTTPS
      maxAge: 8 * 60 * 60 * 1000 // 8h
    });

    // Trả role & username cho frontend
    res.json({ username: user.username, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// ==============================
// LOGOUT
// ==============================
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

export default router;
