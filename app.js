// app.js - Server Node.js hoàn chỉnh
const express = require("express");
const path = require("path");
const favicon = require("serve-favicon");
const logger = require("morgan");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");

// Import các routes
const apiRouter = require("./routes/api");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const productsRouter = require("./routes/products");
const tablesRouter = require("./routes/tables");
const orderRouter = require("./routes/order");
const revenueRouter = require("./routes/revenue");
const revenueByCategoryRouter = require("./routes/revenueByCategory");
const topProductsRouter = require("./routes/topProducts");

// Import của menu
const ordersMenuRouter = require("./routes/orders_menu");
const changeTableMenuRouter = require("./routes/change-table_menu");
const orderCookesMenuRouter = require("./routes/cooked-orders_menu");
const cookedOrdersDetailMenuRouter = require("./routes/cooked-orders-detail_menu");
const cookedToServedMenuRouter = require("./routes/cooked-to-served_menu");
// ✅ IMPORT API MỚI
const cookMealMenuRouter = require("./routes/cook-meal_menu");

const app = express();

// Normalize ES module default exports when routes are authored as ESM
function unwrapModule(m) {
  return m && m.__esModule && m.default
    ? m.default
    : m && m.default
    ? m.default
    : m;
}

const _apiRouter = unwrapModule(apiRouter);
const _authRouter = unwrapModule(authRouter);
const _usersRouter = unwrapModule(usersRouter);
const _productsRouter = unwrapModule(productsRouter);
const _tablesRouter = unwrapModule(tablesRouter);
const _orderRouter = unwrapModule(orderRouter);
const _revenueRouter = unwrapModule(revenueRouter);
const _revenueByCategoryRouter = unwrapModule(revenueByCategoryRouter);
const _topProductsRouter = unwrapModule(topProductsRouter);
const _ordersMenuRouter = unwrapModule(ordersMenuRouter);
const _changeTableMenuRouter = unwrapModule(changeTableMenuRouter);
const _orderCookesMenuRouter = unwrapModule(orderCookesMenuRouter);
const _cookedOrdersDetailMenuRouter = unwrapModule(
  cookedOrdersDetailMenuRouter
);
const _cookedToServedMenuRouter = unwrapModule(cookedToServedMenuRouter);
// ✅ UNWRAP API MỚI
const _cookMealMenuRouter = unwrapModule(cookMealMenuRouter);

// View engine (VNPAY)
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// === MIDDLEWARE ===
app.use(logger("dev"));
app.use(cors({ origin: true, credentials: true })); // Cho phép frontend khác domain gửi cookie
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // phục vụ ảnh upload

// === ROUTES ===

// Health check
app.get("/", (req, res) => {
  res.send("Server is running successfully 🚀");
});
// API routes
app.use("/api", _apiRouter);
// Menu routes
app.use("/api", _ordersMenuRouter);
app.use("/api", _changeTableMenuRouter);
app.use("/api", _orderCookesMenuRouter);
app.use("/api", _cookedOrdersDetailMenuRouter);
app.use("/api", _cookedToServedMenuRouter);
// ✅ SỬ DỤNG API MỚI
app.use("/api", _cookMealMenuRouter);


// Auth
// Auth
app.use("/api/auth", _authRouter);
// Also expose legacy /api/login route (mount auth routes at /api) so clients
// that expect POST /api/login continue to work.
app.use("/api", _authRouter);

// Explicit mapping: POST /api/login -> delegate to auth router's /login handler
app.post("/api/login", (req, res, next) => {
  // Preserve original url, then dispatch to the auth router as if the path is /login
  const originalUrl = req.url;
  req.url = "/login";
  // Use router.handle to delegate; restore url afterwards.
  try {
    _authRouter.handle(req, res, (err) => {
      req.url = originalUrl;
      if (err) return next(err);
      // If handler did not end the response, continue
      next();
    });
  } catch (err) {
    req.url = originalUrl;
    next(err);
  }
});

// CRUD
app.use("/api/users", _usersRouter); // Manager only
app.use("/api/products", _productsRouter); // Manager CRUD, Chef đọc
app.use("/api/tables", _tablesRouter); // Manager CRUD, Employee đọc

// VNPAY / Orders
// VNPAY / Orders
app.use("/order", _orderRouter);

// Revenue
app.use("/api/revenue", _revenueRouter);
app.use("/api/revenue", _revenueByCategoryRouter);
app.use("/api/top-products", _topProductsRouter);

// === ERROR HANDLING ===

// catch 404
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// error handler
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);

  // Trả JSON cho API
  if (req.originalUrl.startsWith("/api") || req.accepts("json")) {
    return res.json({
      error: res.locals.message,
      status: res.locals.error.status || 500,
    });
  }

  // Render view cho VNPAY
  res.render("error");
});

// === KHỞI ĐỘNG SERVER ===
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(
    `Server đã khởi động tại: http://localhost:${server.address().port}`
  );
});

module.exports = app;
