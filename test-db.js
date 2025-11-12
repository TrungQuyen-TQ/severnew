const db = require('./config/db');

(async () => {
  try {
    // Thực hiện truy vấn thử
    const [rows] = await db.query('SELECT NOW() AS time');
    console.log('✅ Kết nối MySQL thành công! Thời gian hiện tại:', rows[0].time);
  } catch (err) {
    console.error('❌ Lỗi kết nối MySQL:', err);
  } finally {
    // Đảm bảo Node không thoát im lặng
    process.exit();
  }
})();
