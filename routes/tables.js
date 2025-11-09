import express from "express";
import mysql from "mysql2/promise";
import multer from "multer";
import config from "config";
import { authMiddleware } from "./auth.js";

const router = express.Router();
const dbConfig = config.get('dbConfig');
const pool = mysql.createPool(dbConfig);

// Multer để upload ảnh bàn
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// GET all tables
router.get("/", authMiddleware(["MANAGER", "EMPLOYEE"]), async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM tables");
  res.json(rows);
});

// CREATE table
router.post("/", authMiddleware(["MANAGER","EMPLOYEE"]), upload.single("image"), async (req, res) => {
  const { name, status } = req.body;
  const image = req.file ? "/uploads/" + req.file.filename : null;
  await pool.execute(
    "INSERT INTO tables (name, status, image) VALUES (?, ?, ?)",
    [name, status, image]
  );
  res.json({ message: "Created" });
});

// UPDATE table
router.put("/:id", authMiddleware(["MANAGER"]), upload.single("image"), async (req, res) => {
  const { name, status } = req.body;
  const imageFile = req.file; // File hình ảnh mới (nếu có)
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

  // Thêm 'image' nếu có file mới được upload
  if (imageFile) {
    const imagePath = "/uploads/" + imageFile.filename;
    fields.push("image_url=?");
    values.push(imagePath);
  }

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
