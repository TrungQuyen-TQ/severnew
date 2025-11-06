const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/by-category", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.name AS category, SUM(od.quantity * p.price) AS total_revenue
      FROM order_details od
      JOIN products p ON p.id = od.product_id
      JOIN categories c ON c.id = p.category_id
      JOIN orders o ON o.id = od.order_id
      WHERE o.status = 'PAID'
      GROUP BY c.id
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

module.exports = router;
