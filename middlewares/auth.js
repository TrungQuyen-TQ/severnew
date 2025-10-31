// /middlewares/auth.js
const jwt = require("jsonwebtoken");
const config = require('config');

const JWT_SECRET = config.get('JWT_SECRET');

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function authorizeAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Yêu cầu quyền Quản trị viên." });
  }
  next();
}

module.exports = { authenticateToken, authorizeAdmin };