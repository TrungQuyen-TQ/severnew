import express from "express";
import mysql from "mysql2/promise";
import config from "config";
import { authMiddleware } from "./auth.js";

const router = express.Router();
const dbConfig = config.get('dbConfig');
const pool = mysql.createPool(dbConfig);

// Note: removed multer/image upload for tables — tables will use JSON { name, status }

// GET all tables
router.get("/", authMiddleware(["MANAGER", "EMPLOYEE"]), async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM tables");
  res.json(rows);
});

// CREATE table (accept multipart/form-data so frontend can send FormData with image)
// CREATE table (expect JSON body: { name, status })
router.post("/", authMiddleware(["MANAGER", "EMPLOYEE"]), async (req, res) => {
  try {
    const { name, status } = req.body;

    if (name === undefined || status === undefined) {
      return res.status(400).json({ message: "name và status là bắt buộc" });
    }

    await pool.execute(
      "INSERT INTO tables (name, status) VALUES (?, ?)",
      [name, status]
    );

    res.json({ message: "Created" });
  } catch (err) {
    console.error('Error creating table:', err);
    res.status(500).json({ message: 'Lỗi server khi tạo bàn.' });
  }
});


// UPDATE table
router.put("/:id", authMiddleware(["MANAGER"]), async (req, res) => {
  const { name, status } = req.body;
  const tableId = req.params.id;

  // 1. Chuẩn bị các trường và giá trị để cập nhật
  const fields = [];
  const values = [];

  // Thêm 'name' nếu có
  if (name !== undefined) {
    fields.push("name=?");
    values.push(name);
  }

  // Thêm 'status' nếu có
  if (status !== undefined) {
    fields.push("status=?");
    values.push(status);
  }

  // No image handling — only update name/status

  

  // 2. Kiểm tra xem có trường nào để cập nhật không
  if (fields.length === 0) {
    // Không có trường nào được cung cấp để cập nhật
    return res.status(400).json({ message: "No fields provided for update." });
  }

  // 3. Xây dựng câu lệnh SQL
  const sqlQuery = `UPDATE tables SET ${fields.join(", ")} WHERE id=?`;

  // 4. Thêm id vào cuối mảng giá trị
  values.push(tableId);

  try {
    // 5. Thực thi câu lệnh SQL
    await pool.execute(sqlQuery, values);
    res.json({ message: "Updated successfully." });
  } catch (error) {
    console.error("Database error during update:", error);
    res.status(500).json({ message: "An error occurred during update." });
  }
}); 

// DELETE table
router.delete("/:id", authMiddleware(["MANAGER"]), async (req, res) => {
  await pool.execute("DELETE FROM tables WHERE id=?", [req.params.id]);
  res.json({ message: "Deleted" });
});

export default router;
