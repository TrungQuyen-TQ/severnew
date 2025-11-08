import express from "express";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import config from "config";
import { authMiddleware } from "./auth.js"; // import middleware auth

const router = express.Router()
const dbConfig = config.get('dbConfig');
const pool = mysql.createPool(dbConfig);

// GET all users (Manager only)
router.get("/", authMiddleware(["MANAGER"]), async (req, res) => {
  const [rows] = await pool.execute("SELECT id, username, role FROM users");
  res.json(rows);
});

// CREATE user
router.post("/",  async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: "Vui lòng cung cấp đầy đủ username, password và role." });
    }

    const hash = await bcrypt.hash(password, 10);
  await pool.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hash, role]);
  res.json({ message: "Created" });
});
// UPDATE user
router.put("/:id", authMiddleware(["MANAGER"]), async (req, res) => {
  // 1. Lấy thông tin từ request body
  console.log("DEBUG: Update user request body:", req.body);
  const { username, password, role } = req.body;
  const userId = req.params.id;

  // 2. Chuẩn bị các trường sẽ cập nhật và giá trị của chúng
  const fields = [];
  const values = [];

  // Thêm username nếu có
  if (username !== undefined) {
    fields.push("username=?");
    values.push(username);
  }

  // Thêm role nếu có
  if (role !== undefined) {
    fields.push("role=?");
    values.push(role);
  }

  // Xử lý mật khẩu: CHỈ BĂM VÀ CẬP NHẬT nếu trường 'password' được cung cấp
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    fields.push("password=?");
    values.push(hash);
  }

  // 3. Kiểm tra xem có trường nào để cập nhật không
  if (fields.length === 0) {
    return res.status(400).json({ message: "No fields provided for update." });
  }

  // 4. Tạo câu lệnh SQL UPDATE
  const sqlQuery = `UPDATE users SET ${fields.join(", ")} WHERE id=?`;
  
  // 5. Thêm id vào cuối mảng giá trị
  values.push(userId);

  try {
    // 6. Thực thi câu lệnh SQL
    await pool.execute(sqlQuery, values);
    res.json({ message: "Updated successfully." });
  } catch (error) {
    console.error("Database error during update:", error);
    res.status(500).json({ message: "An error occurred during update." });
  }
});
// DELETE user
router.delete("/:id", authMiddleware(["MANAGER"]), async (req, res) => {
  await pool.execute("DELETE FROM users WHERE id=?", [req.params.id]);
  res.json({ message: "Deleted" });
});

export default router;
