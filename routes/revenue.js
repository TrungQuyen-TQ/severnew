const express = require('express');
const router = express.Router();
const db = require('../config/db'); // sử dụng db.js bạn đã làm

// API lấy doanh thu theo tháng
router.get('/', async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ message: 'Vui lòng cung cấp tháng và năm!' });
  }

  try {
    const [rows] = await db.query(`
      SELECT 
        DATE(o.created_at) AS date,
        SUM(od.quantity * p.price) AS revenue
      FROM orders o
      JOIN order_details od ON o.id = od.order_id
      JOIN products p ON p.id = od.product_id
      WHERE o.status = 'PAID'
        AND MONTH(o.created_at) = ?
        AND YEAR(o.created_at) = ?
      GROUP BY DATE(o.created_at)
      ORDER BY DATE(o.created_at);
    `, [month, year]);

    const total = rows.reduce((sum, r) => sum + Number(r.revenue), 0);

    res.json({
      month,
      year,
      totalRevenue: total,
      daily_details: rows
    });
  } catch (error) {
    console.error('Lỗi truy vấn doanh thu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

module.exports = router;
