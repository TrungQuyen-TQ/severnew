import express from "express";
import mysql from "mysql2/promise";
import multer from "multer";
import config from "config";
import { authMiddleware } from "./auth.js";

const router = express.Router();
const dbConfig = config.get('dbConfig');
const pool = mysql.createPool(dbConfig);

// Multer để upload ảnh
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// GET all products
router.get("/", async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM products");
  res.json(rows);
});

// CREATE product
router.post("/", authMiddleware(["MANAGER"]), upload.single("image"), async (req, res) => {
  const { category_id, name, price, stock } = req.body;
  const image = req.file ? "/uploads/" + req.file.filename : null;
  await pool.execute(
    "INSERT INTO products (category_id, name, price, stock, image) VALUES (?, ?, ?, ?, ?)",
    [category_id, name, price, stock, image]
  );
  res.json({ message: "Created" });
});

// UPDATE product
router.put("/:id", authMiddleware(["MANAGER"]), upload.single("image"), async (req, res) => {
  // Lấy dữ liệu từ request
  const { category_id, name, price, stock } = req.body;
  const imageFile = req.file; // File hình ảnh mới (nếu có)
  const productId = req.params.id;

  // 1. Chuẩn bị các trường và giá trị sẽ được cập nhật
  const fields = [];
  const values = [];

  // Kiểm tra và thêm 'category_id'
  if (category_id !== undefined) {
    fields.push("category_id=?");
    values.push(category_id);
  }

  // Kiểm tra và thêm 'name'
  if (name !== undefined) {
    fields.push("name=?");
    values.push(name);
  }

  // Kiểm tra và thêm 'price'
  // Chú ý: Cần đảm bảo price là số (nếu cần) trước khi đưa vào SQL
  if (price !== undefined) {
    fields.push("price=?");
    values.push(price);
  }

  // Kiểm tra và thêm 'stock'
  if (stock !== undefined) {
    fields.push("stock=?");
    values.push(stock);
  }

  // Kiểm tra và thêm 'image' nếu có file mới
  if (imageFile) {
    const imagePath = "/uploads/" + imageFile.filename;
    fields.push("image_url=?");
    values.push(imagePath);
  }

  // 2. Kiểm tra xem có trường nào để cập nhật không
  if (fields.length === 0) {
    return res.status(400).json({ message: "No fields provided for update." });
  }

  // 3. Xây dựng câu lệnh SQL
  // Câu lệnh chỉ chứa các trường đã được thêm vào mảng fields
  const sqlQuery = `UPDATE products SET ${fields.join(", ")} WHERE id=?`;

  // 4. Thêm id sản phẩm vào cuối mảng giá trị
  values.push(productId);

  try {
    // 5. Thực thi câu lệnh SQL
    await pool.execute(sqlQuery, values);
    res.json({ message: "Product updated successfully." });
  } catch (error) {
    console.error("Database error during product update:", error);
    res.status(500).json({ message: "An error occurred during update." });
  }
});

// DELETE product
router.delete("/:id", authMiddleware(["MANAGER"]), async (req, res) => {
  await pool.execute("DELETE FROM products WHERE id=?", [req.params.id]);
  res.json({ message: "Deleted" });
});

export default router;
