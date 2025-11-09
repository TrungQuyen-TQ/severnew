const express = require("express");
const router = express.Router();
const pool = require("../config/db"); // Giả sử sử dụng pool từ db.js

router.get("/", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                p.id, 
                p.name, 
                p.image_url, 
                SUM(od.quantity) AS total_sold
            FROM products p
            JOIN order_details od ON p.id = od.product_id
            JOIN orders o ON o.id = od.order_id
            WHERE o.status = 'PAID'
              AND MONTH(o.created_at) = MONTH(CURRENT_DATE()) -- Lọc theo tháng hiện tại
              AND YEAR(o.created_at) = YEAR(CURRENT_DATE())   -- Lọc theo năm hiện tại
            GROUP BY p.id, p.name, p.image_url
            ORDER BY total_sold DESC
            LIMIT 8; -- Giới hạn 8 sản phẩm hàng đầu
          `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Lỗi máy chủ khi lấy top sản phẩm" });
    }
});
module.exports = router;