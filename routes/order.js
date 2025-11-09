// /routes/order.js
/**
 * Created by CTT VNPAY
 */
const config = require("config");
const mysql = require("mysql2/promise");
const dbConfig = config.get("dbConfig");

let express = require("express");
let router = express.Router();
// Bỏ jquery
const request = require("request");
const moment = require("moment");
const crypto = require("crypto");
const querystring = require("qs");

// Hàm tiện ích (phải giữ lại)
function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

// === ROUTES HIỂN THỊ (res.render) VÀ LOGIC VNPAY ===
// Giữ nguyên các routes cũ, chỉ thay đổi config
const tmnCode = config.get("vnp_TmnCode");
const secretKey = config.get("vnp_HashSecret");
const vnpUrl = config.get("vnp_Url");
const returnUrl = config.get("vnp_ReturnUrl");
const vnpApi = config.get("vnp_Api");

router.get("/", function (req, res, next) {
  res.render("orderlist", { title: "Danh sách đơn hàng" });
});

router.get("/create_payment_url", function (req, res, next) {
  res.render("order", { title: "Tạo mới đơn hàng", amount: 10000 });
});

// TRONG: /routes/order.js

router.post("/querydr", function (req, res, next) {
  // ... (Giữ nguyên logic tạo request VNPAY) ...

  request(
    {
      url: vnpApi,
      method: "POST",
      json: true,
      body: dataObj,
    },
    function (error, response, body) {
      if (error || !body || response.statusCode !== 200) {
        // Lỗi kết nối VNPAY
        return res
          .status(200)
          .json({ status: "ERROR", message: "Lỗi kết nối VNPAY API" });
      }

      let vnpResponseCode = body.vnp_ResponseCode;
      let vnpStatus = body.vnp_TransactionStatus;

      let desktopStatus = "PENDING";

      if (vnpResponseCode === "00" && vnpStatus === "00") {
        desktopStatus = "PAID";
      } else if (vnpStatus === "01") {
        desktopStatus = "PENDING"; // Vẫn chờ thanh toán
      } else {
        desktopStatus = "FAILED";
      }

      // TRẢ VỀ JSON CHO JAVA FX
      res.status(200).json({
        status: desktopStatus,
        message: "Truy vấn VNPAY hoàn tất",
      });
    }
  );
});

router.get("/refund", function (req, res, next) {
  res.render("refund", { title: "Hoàn tiền giao dịch thanh toán" });
});

router.post("/create_payment_url", function (req, res, next) {
  process.env.TZ = "Asia/Ho_Chi_Minh";

  let date = new Date();
  let createDate = moment(date).format("YYYYMMDDHHmmss");

  let ipAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

    let orderId = moment(date).format('DDHHmmss');
    let amount = req.body.amount;
    let bankCode = req.body.bankCode;
    
    let locale = req.body.language || 'vn';
    let currCode = 'VND';
    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode; // Dùng hằng số từ config
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan cho ma GD:' + orderId;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl; // Dùng hằng số từ config
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    // if(bankCode) {
    //     vnp_Params['vnp_BankCode'] = bankCode;
    // }

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", secretKey); // Dùng hằng số từ config
  let signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");
  vnp_Params["vnp_SecureHash"] = signed;
  let finalVnpUrl =
    vnpUrl + "?" + querystring.stringify(vnp_Params, { encode: false }); // Dùng hằng số từ config

  // Giữ nguyên phản hồi JSON (như order.js cũ)
  res.status(200).json({
    paymentUrl: finalVnpUrl,
    message: "OK",
  });
});

// Thêm các import cần thiết (giả định bạn đã import chúng ở đầu file)

router.get("/vnpay_return", async function (req, res, next) {
  // THÊM ASYNC
  let vnp_Params = req.query;
  let secureHash = vnp_Params["vnp_SecureHash"];
  let orderId = vnp_Params["vnp_TxnRef"]; // ID đơn hàng
  let responseCode = vnp_Params["vnp_ResponseCode"];
  let transactionStatus = vnp_Params["vnp_TransactionStatus"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", secretKey);
  let signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");

  const connection = await mysql.createConnection(dbConfig); // KẾT NỐI DB

  if (secureHash === signed) {
    // 1. Kiểm tra trạng thái giao dịch
    if (responseCode === "00" && transactionStatus === "00") {
      // Giao dịch thành công => Cập nhật DB
      try {
        await connection.execute(
          "UPDATE orders SET status = 'PAID' WHERE order_id = ? AND status = 'PENDING'",
          [orderId]
        );
        // Sau khi cập nhật DB, Polling Service sẽ nhận được PAID
        res.render("success", {
          code: "00",
          message: "Thanh toán thành công. Hệ thống đang cập nhật.",
        });
      } catch (dbError) {
        console.error("Lỗi cập nhật DB (PAID):", dbError);
        res.render("success", {
          code: "99",
          message: "Thành công VNPAY nhưng lỗi cập nhật DB.",
        });
      }
    } else {
      // Giao dịch thất bại / hủy bỏ => Cập nhật DB
      await connection.execute(
        "UPDATE orders SET status = 'FAILED' WHERE order_id = ? AND status = 'PENDING'",
        [orderId]
      );
      res.render("success", {
        code: responseCode,
        message: "Giao dịch thất bại.",
      });
    }
  } else {
    // Sai Secure Hash
    res.render("success", { code: "97", message: "Sai chữ ký bảo mật." });
  }
  await connection.end();
});

// TRONG: /routes/order.js

router.get("/vnpay_ipn", async function (req, res, next) {
  // THÊM ASYNC
  let vnp_Params = req.query;
  let secureHash = vnp_Params["vnp_SecureHash"];

  let orderId = vnp_Params["vnp_TxnRef"];
  let vnpAmount = vnp_Params["vnp_Amount"];
  let rspCode = vnp_Params["vnp_ResponseCode"];
  let transactionStatus = vnp_Params["vnp_TransactionStatus"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", secretKey);
  let signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");

  const connection = await mysql.createConnection(dbConfig);

  try {
    // Bắt đầu giao dịch (transaction) để đảm bảo tính nhất quán
    await connection.beginTransaction();

    // 1. Kiểm tra Secure Hash
    if (secureHash !== signed) {
      await connection.commit();
      return res
        .status(200)
        .json({ RspCode: "97", Message: "Checksum failed" });
    }

    // 2. Truy vấn đơn hàng trong DB
    const [orders] = await connection.execute(
      "SELECT id, status, amount FROM orders WHERE order_id = ?",
      [orderId]
    );

    if (orders.length === 0) {
      await connection.commit();
      return res
        .status(200)
        .json({ RspCode: "01", Message: "Order not found" });
    }

    const order = orders[0];

    // 3. Kiểm tra số tiền (Đơn vị: VNĐ)
    // VNPAY Amount là tiền * 100
    if (order.amount * 100 !== parseInt(vnpAmount)) {
      await connection.commit();
      return res.status(200).json({ RspCode: "04", Message: "Amount invalid" });
    }

    // 4. Kiểm tra trạng thái hiện tại (chỉ xử lý nếu đang PENDING)
    if (order.status !== "PENDING") {
      await connection.commit();
      return res.status(200).json({
        RspCode: "02",
        Message: "This order has been updated to the payment status",
      });
    }

    // 5. Xử lý kết quả VNPAY
    if (rspCode === "00" && transactionStatus === "00") {
      // Giao dịch thành công
      await connection.execute(
        "UPDATE orders SET status = 'PAID' WHERE id = ?",
        [order.id]
      );
      await connection.commit();
      return res.status(200).json({ RspCode: "00", Message: "Success" });
    } else {
      // Giao dịch thất bại
      await connection.execute(
        "UPDATE orders SET status = 'FAILED' WHERE id = ?",
        [order.id]
      );
      await connection.commit();
      return res
        .status(200)
        .json({ RspCode: "00", Message: "Success (Updated FAILED)" });
    }
  } catch (dbError) {
    console.error("Lỗi xử lý IPN:", dbError);
    await connection.rollback(); // Rollback nếu có lỗi
    res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  } finally {
    if (connection) await connection.end();
  }
});

router.post("/querydr", function (req, res, next) {
  process.env.TZ = "Asia/Ho_Chi_Minh";
  let date = new Date();

  let crypto = require("crypto");

  let vnp_TxnRef = req.body.orderId;
  let vnp_TransactionDate = req.body.transDate;

  let vnp_RequestId = moment(date).format("HHmmss");
  let vnp_Version = "2.1.0";
  let vnp_Command = "querydr";
  let vnp_OrderInfo = "Truy van GD ma:" + vnp_TxnRef;

  let vnp_IpAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

  let vnp_CreateDate = moment(date).format("YYYYMMDDHHmmss");

  let data =
    vnp_RequestId +
    "|" +
    vnp_Version +
    "|" +
    vnp_Command +
    "|" +
    tmnCode +
    "|" +
    vnp_TxnRef +
    "|" +
    vnp_TransactionDate +
    "|" +
    vnp_CreateDate +
    "|" +
    vnp_IpAddr +
    "|" +
    vnp_OrderInfo;

  let hmac = crypto.createHmac("sha512", secretKey);
  let vnp_SecureHash = hmac.update(new Buffer(data, "utf-8")).digest("hex");

  let dataObj = {
    vnp_RequestId: vnp_RequestId,
    vnp_Version: vnp_Version,
    vnp_Command: vnp_Command,
    vnp_TmnCode: tmnCode,
    vnp_TxnRef: vnp_TxnRef,
    vnp_OrderInfo: vnp_OrderInfo,
    vnp_TransactionDate: vnp_TransactionDate,
    vnp_CreateDate: vnp_CreateDate,
    vnp_IpAddr: vnp_IpAddr,
    vnp_SecureHash: vnp_SecureHash,
  };

  request(
    {
      url: vnpApi,
      method: "POST",
      json: true,
      body: dataObj,
    },
    function (error, response, body) {
      if (error || !body || response.statusCode !== 200) {
        return res
          .status(200)
          .json({ status: "ERROR", message: "Lỗi kết nối VNPAY API" });
      }

      let vnpResponseCode = body.vnp_ResponseCode;
      let vnpStatus = body.vnp_TransactionStatus;

      let desktopStatus = "PENDING";

      if (vnpResponseCode === "00" && vnpStatus === "00") {
        desktopStatus = "PAID";
      } else {
        desktopStatus = "FAILED";
      }

      res.status(200).json({
        status: desktopStatus,
        message: "Truy vấn VNPAY hoàn tất",
      });
    }
  );
});

router.post("/refund", function (req, res, next) {
  process.env.TZ = "Asia/Ho_Chi_Minh";
  let date = new Date();

  let vnp_TxnRef = req.body.orderId;
  let vnp_TransactionDate = req.body.transDate;
  let vnp_Amount = req.body.amount * 100;
  let vnp_TransactionType = req.body.transType;
  let vnp_CreateBy = req.body.user;

  let vnp_RequestId = moment(date).format("HHmmss");
  let vnp_Version = "2.1.0";
  let vnp_Command = "refund";
  let vnp_OrderInfo = "Hoan tien GD ma:" + vnp_TxnRef;

  let vnp_IpAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

  let vnp_CreateDate = moment(date).format("YYYYMMDDHHmmss");

  let vnp_TransactionNo = "0";

  let data =
    vnp_RequestId +
    "|" +
    vnp_Version +
    "|" +
    vnp_Command +
    "|" +
    tmnCode +
    "|" +
    vnp_TransactionType +
    "|" +
    vnp_TxnRef +
    "|" +
    vnp_Amount +
    "|" +
    vnp_TransactionNo +
    "|" +
    vnp_TransactionDate +
    "|" +
    vnp_CreateBy +
    "|" +
    vnp_CreateDate +
    "|" +
    vnp_IpAddr +
    "|" +
    vnp_OrderInfo;
  let hmac = crypto.createHmac("sha512", secretKey);
  let vnp_SecureHash = hmac.update(new Buffer(data, "utf-8")).digest("hex");

  let dataObj = {
    vnp_RequestId: vnp_RequestId,
    vnp_Version: vnp_Version,
    vnp_Command: vnp_Command,
    vnp_TmnCode: tmnCode,
    vnp_TransactionType: vnp_TransactionType,
    vnp_TxnRef: vnp_TxnRef,
    vnp_Amount: vnp_Amount,
    vnp_TransactionNo: vnp_TransactionNo,
    vnp_CreateBy: vnp_CreateBy,
    vnp_OrderInfo: vnp_OrderInfo,
    vnp_TransactionDate: vnp_TransactionDate,
    vnp_CreateDate: vnp_CreateDate,
    vnp_IpAddr: vnp_IpAddr,
    vnp_SecureHash: vnp_SecureHash,
  };

  request(
    {
      url: vnpApi,
      method: "POST",
      json: true,
      body: dataObj,
    },
    function (error, response, body) {
      // Xử lý phản hồi từ VNPAY (chưa có trong code cũ, cần thêm)
      console.log(response.body);
      // Trả về kết quả JSON (tùy theo nhu cầu của bạn)
      res.status(200).json(response.body);
    }
  );
});

module.exports = router;
