// app.js (Tệp server chính - HOÀN CHỈNH)

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cors = require('cors'); 

// Import các routes đã tách
var orderRouter = require('./routes/order');
var apiRouter = require('./routes/api'); 
var revenueRouter = require('./routes/revenue'); 
const revenueByCategoryRouter = require('./routes/revenueByCategory');
const topProductsRouter = require('./routes/topProducts');

var app = express();

// view engine setup (Cần thiết cho VNPAY views)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// === CẤU HÌNH MIDDLEWARE ===
app.use(logger('dev'));
app.use(cors()); // Cho phép các yêu cầu từ frontend khác domain
app.use(bodyParser.json()); // Xử lý JSON body (Cần cho POST /api/login)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

// === ĐĂNG KÝ ROUTES ===

// 1. Route gốc: Chuyển hướng đến trang VNPAY mặc định
app.get('/', function(req, res, next) {
    res.redirect('/order'); 
});

// 2. Đăng ký Router API và VNPAY
app.use('/order', orderRouter); // Routes VNPAY
app.use('/api', apiRouter);     // Routes Quản lý Món ăn/Login
app.use('/api/revenue', revenueRouter); // // Routes chủ nhà hàng
app.use('/api/revenue', revenueByCategoryRouter); // Routes doanh thu theo danh mục
app.use('/api/top-products', topProductsRouter); // Routes top sản phẩm bán chạy



// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function(err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    res.status(err.status || 500);

    // Trả về JSON cho API
    if (req.originalUrl.startsWith('/api') || req.accepts('json')) {
        return res.json({ error: res.locals.message, status: res.locals.error.status || 500 });
    }

    // Render View cho các lỗi không phải API (ví dụ: lỗi 404 trên /order)
    res.render('error');
});

module.exports = app;

// === KHỞI ĐỘNG SERVER ===
// LƯU Ý: Nếu bạn muốn chạy trên cổng 8888 để khớp với ứng dụng Java Desktop, hãy sửa PORT.
const PORT = process.env.PORT || 3000; 

// Khởi động server
const server = app.listen(PORT, function() {
    console.log('Express server listening on port ' + server.address().port);
    console.log(`Server đã khởi động thành công tại: http://localhost:${server.address().port}`);
});