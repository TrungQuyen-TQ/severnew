// /middlewares/auth.js
const jwt = require("jsonwebtoken");
const config = require("config");

const JWT_SECRET = config.get("JWT_SECRET");

// Middleware kiểm tra JWT từ cookie HttpOnly
function authenticateToken(req, res, next) {
  // Lấy token từ cookie
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user; // { id, username, role }
    next();
  });
}

// Middleware kiểm tra role
// roles: array of allowed roles, ví dụ ["MANAGER", "CHEF"]
function authorizeRoles(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: bạn không có quyền truy cập." });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRoles };
