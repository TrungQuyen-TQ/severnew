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

// === ROUTES HIỂN THỊ (res.render) VÀ LOGIC VNPAY ===
// Giữ nguyên các routes cũ, chỉ thay đổi config
const tmnCode = config.get("vnp_TmnCode");
const secretKey = config.get("vnp_HashSecret");
const vnpUrl = config.get("vnp_Url");
const returnUrl = config.get("vnp_ReturnUrl");
const vnpApi = config.get("vnp_Api");

// Hàm tiện ích (phải giữ lại)
function hashVnpayData(params, secretKey) {
  let sortedParams = {};
  Object.keys(params)
    .sort()
    .forEach((key) => {
      // Bỏ qua vnp_SecureHash
      if (key !== "vnp_SecureHash" && key !== "vnp_SecureHashType") {
        sortedParams[key] = params[key];
      }
    });

  // Chuyển đối tượng tham số thành chuỗi query string (dùng &)
  let signData = querystring.stringify(sortedParams, { encode: false });

  let hmac = crypto.createHmac("sha512", secretKey);
  let signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");
  return signed;
}

async function getConnection() {
  return await mysql.createConnection(dbConfig);
}
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

router.get("/", function (req, res, next) {
  res.render("orderlist", { title: "Danh sách đơn hàng" });
});

router.get("/create_payment_url", function (req, res, next) {
  res.render("order", { title: "Tạo mới đơn hàng", amount: 10000 });
});

router.post("/querydr", async function (req, res, next) {
  process.env.TZ = "Asia/Ho_Chi_Minh";
  const orderId = req.body.orderId;

  if (!orderId) {
    return res
      .status(400)
      .json({ status: "ERROR", message: "Thiếu orderId trong yêu cầu." });
  }

  let connection = null;
  let vnp_TransactionDate = null;

  // 1. TRUY VẤN DB GỐC ĐỂ LẤY vnp_create_date
  try {
    connection = await getConnection();
    const [rows] = await connection.execute(
      "SELECT vnp_create_date FROM vnpay_transactions WHERE txn_ref = ?",
      [orderId]
    );
    if (rows.length === 0) {
      return res
        .status(200)
        .json({ status: "FAILED", message: "Không tìm thấy giao dịch" });
    }
    vnp_TransactionDate = rows[0].vnp_create_date;
  } catch (dbError) {
    console.error("Lỗi truy vấn DB (querydr):", dbError);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Lỗi nội bộ khi truy vấn DB." });
  } finally {
    if (connection) await connection.end();
  }

  // 2. TẠO YÊU CẦU TRUY VẤN VNPAY & HASH
  const date = new Date(); // Dùng lại date
  let vnp_RequestId =
    moment(date).format("HHmmss") + Math.floor(Math.random() * 9000);
  let vnp_CreateDate = moment(date).format("YYYYMMDDHHmmss");
  let vnp_IpAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    "127.0.0.1";

  let dataObj = {
    vnp_RequestId: vnp_RequestId,
    vnp_Version: "2.1.0",
    vnp_Command: "querydr",
    vnp_TmnCode: tmnCode,
    vnp_TxnRef: orderId,
    vnp_OrderInfo: "Truy van GD ma:" + orderId,
    vnp_TransactionDate: vnp_TransactionDate,
    vnp_CreateDate: vnp_CreateDate,
    vnp_IpAddr: vnp_IpAddr,
  };

  let sortedDataObj = sortObject(dataObj);
  dataObj.vnp_SecureHash = hashVnpayData(sortedDataObj, secretKey);

  // 3. GỌI API VNPAY & XỬ LÝ PHẢN HỒI (CÓ BẢO MẬT & TRANSACTION)
  request(
    { url: vnpApi, method: "POST", json: true, body: dataObj },
    async function (error, response, body) {
      if (error || !body || response.statusCode !== 200) {
        return res
          .status(200)
          .json({ status: "ERROR", message: "Lỗi kết nối VNPAY API" });
      }

      let vnpResponseCode = body.vnp_ResponseCode;
      let vnpStatus = body.vnp_TransactionStatus;
      let desktopStatus = "PENDING";

      // 🛑 BẢO MẬT: TÁI TẠO VÀ KIỂM TRA HASH CỦA PHẢN HỒI (Mục 2.5.4.2)
      const receivedHash = body.vnp_SecureHash;
      delete body.vnp_SecureHash; // Loại bỏ hash cũ để tái tạo hash mới

      // Cần hàm hashVnpayData VÀ sortObject phải xử lý được object body này
      let sortedBody = sortObject(body);
      const checkHash = hashVnpayData(sortedBody, secretKey);

      if (receivedHash !== checkHash) {
        console.error(
          `[SECURITY ERROR] Hash Mismatch cho order: ${orderId}. Received: ${receivedHash} | Calculated: ${checkHash}`
        );
        return res
          .status(200)
          .json({ status: "ERROR", message: "Sai chữ ký bảo mật từ VNPAY." });
      }

      // 4. CẬP NHẬT DB VÀ TRẢ KẾT QUẢ
      let updateConnection = null;
      try {
        updateConnection = await getConnection();
        await updateConnection.beginTransaction(); // BẮT ĐẦU TRANSACTION 🛑

        // Kiểm tra mã VNPAY Response Code trước (kiểm tra API gọi thành công không)
        if (vnpResponseCode !== "00") {
          // API truy vấn thất bại (ví dụ: GD không tồn tại, mã lỗi 91)
          desktopStatus = "FAILED";
          await updateConnection.execute(
            `UPDATE vnpay_transactions 
                         SET status = 'FAILED', vnp_response_code = ? 
                         WHERE txn_ref = ? AND status = 'PENDING'`,
            [vnpResponseCode, orderId]
          );
        }
        // Sau khi API truy vấn thành công, kiểm tra trạng thái giao dịch
        else if (vnpStatus === "00") {
          desktopStatus = "PAID";
          await updateConnection.execute(
            `UPDATE vnpay_transactions 
                         SET status = 'PAID', vnp_transaction_no = ?, vnp_response_code = ?
                         WHERE txn_ref = ? AND status = 'PENDING'`,
            [body.vnp_TransactionNo, vnpResponseCode, orderId]
          );
        } else if (vnpStatus !== "01") {
          // FAILED nếu không phải 00 (PAID) và 01 (PENDING)
          desktopStatus = "FAILED";
          await updateConnection.execute(
            `UPDATE vnpay_transactions 
                         SET status = 'FAILED', vnp_response_code = ? 
                         WHERE txn_ref = ? AND status = 'PENDING'`,
            [vnpResponseCode, orderId]
          );
        }

        await updateConnection.commit(); // KẾT THÚC TRANSACTION
      } catch (dbError) {
        console.error("Lỗi CẬP NHẬT DB sau Polling:", dbError);
        if (updateConnection) await updateConnection.rollback(); // ROLLBACK nếu lỗi
        desktopStatus = "DB_ERROR";
      } finally {
        if (updateConnection) await updateConnection.end();
      }

      // 5. TRẢ VỀ KẾT QUẢ CHO CLIENT
      res.status(200).json({
        status: desktopStatus,
        message: "Truy vấn VNPAY hoàn tất",
        vnpResponseCode: vnpResponseCode,
      });
    }
  );
});

router.get("/refund", function (req, res, next) {
  res.render("refund", { title: "Hoàn tiền giao dịch thanh toán" });
});

// TRONG: /routes/order.js

router.post("/create_payment_url", async function (req, res, next) {
  process.env.TZ = "Asia/Ho_Chi_Minh";

  let date = new Date();
  let createDate = moment(date).format("YYYYMMDDHHmmss");

  let ipAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

  // Lấy thông tin từ request (giả sử client gửi amount và orderId từ bảng orders)
  let amount = req.body.amount;
  let orderId = moment(date).format("DDHHmmss"); // VNPAY TxnRef

  // 🛑 THAY ĐỔI 1: Lấy orderId từ req.body (nếu bạn đã lưu order nghiệp vụ trước đó)
  // Nếu bạn muốn dùng mã đơn hàng tạo ra tại đây làm khóa chính:
  let txnRef = orderId;
  let amountInCents = amount * 100;

  const connection = await getConnection();

  // === GIAI ĐOẠN 1: LƯU GIAO DỊCH VÀO DB (vnpay_transactions) ===
  try {
    const insertQuery = `
            INSERT INTO vnpay_transactions 
            (txn_ref, order_id, amount, vnp_create_date, status)
            VALUES (?, ?, ?, ?, 'PENDING')
        `;
    // Giả sử order_id của nghiệp vụ món ăn của bạn là 1 (cần sửa lại logic này sau)
    await connection.execute(insertQuery, [
      txnRef,
      1,
      amountInCents,
      createDate,
    ]);
    console.log(`[DB] Ghi nhận giao dịch PENDING: ${txnRef}`);
  } catch (dbError) {
    console.error("Lỗi khi lưu DB (create_payment_url):", dbError);
    await connection.end();
    return res
      .status(500)
      .json({ status: "ERROR", message: "Lỗi nội bộ khi lưu giao dịch." });
  } finally {
    await connection.end();
  }
  // === KẾT THÚC GIAI ĐOẠN 1: LƯU DB ===

  // === TẠO VÀ GỬI REQUEST VNPAY ===
    let locale = req.body.language || 'vn';
  let vnp_Params = {};
  // ... (Giữ nguyên các tham số) ...
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = tmnCode;
  vnp_Params['vnp_OrderType'] = 'other'; // Ví dụ: đảm bảo không bị thiếu
  vnp_Params['vnp_ExpireDate'] = moment(date).add(15, 'minutes').format('YYYYMMDDHHmmss');
  // ... (Thêm các tham số khác) ...
  vnp_Params["vnp_TxnRef"] = txnRef; // SỬ DỤNG mã đã lưu DB
  vnp_Params["vnp_Amount"] = amountInCents;
  vnp_Params["vnp_CreateDate"] = createDate;
  vnp_Params["vnp_ReturnUrl"] = returnUrl;
  vnp_Params["vnp_IpAddr"] = ipAddr;
  // BỔ SUNG 2 THAM SỐ BẮT BUỘC
 vnp_Params['vnp_Locale'] = locale || 'vn'; 
 vnp_Params['vnp_CurrCode'] = 'VND';
 vnp_Params['vnp_OrderInfo'] = 'Thanh toan cho ma GD:' + txnRef;

  // Sort object (đảm bảo thứ tự cho hash)
  vnp_Params = sortObject(vnp_Params);

  // 🛑 THAY ĐỔI 2: Dùng hàm Hash chuẩn
  let signed = hashVnpayData(vnp_Params, secretKey);
  vnp_Params["vnp_SecureHash"] = signed;

  let finalVnpUrl =
    vnpUrl + "?" + querystring.stringify(vnp_Params, { encode: false });

  res.status(200).json({
    paymentUrl: finalVnpUrl,
    txnRef: txnRef, // Trả về mã này để client JavaFX Polling
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

// TRONG: /routes/order.js

router.post("/querydr", async function (req, res, next) {
  // Đảm bảo hàm này là ASYNC để sử dụng await cho DB và request callback
  process.env.TZ = "Asia/Ho_Chi_Minh";
  let date = new Date();
  const orderId = req.body.orderId;

  if (!orderId) {
    return res
      .status(400)
      .json({ status: "ERROR", message: "Thiếu orderId trong yêu cầu." });
  }

  let connection = null;
  let vnp_TransactionDate = null;

  // === GIAI ĐOẠN 2.1: LẤY THÔNG TIN GỐC TỪ DB (vnp_create_date) CHO QUERYDR ===
  try {
    connection = await getConnection(); // Mở kết nối DB
    const [rows] = await connection.execute(
      "SELECT vnp_create_date FROM vnpay_transactions WHERE txn_ref = ?",
      [orderId]
    );

    if (rows.length === 0) {
      // Không tìm thấy giao dịch ban đầu, không thể truy vấn VNPAY
      return res
        .status(200)
        .json({ status: "FAILED", message: "Không tìm thấy giao dịch" });
    }
    vnp_TransactionDate = rows[0].vnp_create_date;
  } catch (dbError) {
    console.error("Lỗi truy vấn DB (querydr):", dbError);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Lỗi nội bộ khi truy vấn DB." });
  } finally {
    if (connection) await connection.end(); // Đóng kết nối sau khi lấy dữ liệu
  }

  // === GIAI ĐOẠN 2.2: TẠO YÊU CẦU TRUY VẤN VNPAY & HASH ===
  let vnp_RequestId =
    moment(date).format("HHmmss") + Math.floor(Math.random() * 9000); // Mã request duy nhất
  let vnp_CreateDate = moment(date).format("YYYYMMDDHHmmss");
  let vnp_IpAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

  let dataObj = {
    vnp_RequestId: vnp_RequestId,
    vnp_Version: "2.1.0",
    vnp_Command: "querydr",
    vnp_TmnCode: tmnCode,
    vnp_TxnRef: orderId,
    vnp_OrderInfo: "Truy van GD ma:" + orderId,
    vnp_TransactionDate: vnp_TransactionDate, // LẤY TỪ DB
    vnp_CreateDate: vnp_CreateDate,
    vnp_IpAddr: vnp_IpAddr,
  };

  // Sort object (bắt buộc cho hash)
  let sortedDataObj = sortObject(dataObj);

  // KHẮC PHỤC LỖI HASH: Dùng hàm Hash chuẩn (hashVnpayData)
  dataObj.vnp_SecureHash = hashVnpayData(sortedDataObj, secretKey);

  // === GIAI ĐOẠN 2.3: GỌI API VNPAY & XỬ LÝ PHẢN HỒI ===
  request(
    {
      url: vnpApi,
      method: "POST",
      json: true,
      body: dataObj,
    },
    async function (error, response, body) {
      // Thêm async ở đây để dùng await cho DB
      if (error || !body || response.statusCode !== 200) {
        return res
          .status(200)
          .json({ status: "ERROR", message: "Lỗi kết nối VNPAY API" });
      }

      let vnpResponseCode = body.vnp_ResponseCode;
      let vnpStatus = body.vnp_TransactionStatus;
      let desktopStatus = "PENDING";

      // Lấy thêm thông tin cần thiết từ VNPAY response
      const vnpTranNo = body.vnp_TransactionNo;

      // Mở kết nối DB MỚI để cập nhật
      let updateConnection = null;
      try {
        updateConnection = await getConnection();

        // 🛑 LOGIC CẬP NHẬT TRẠNG THÁI DB (vnpay_transactions)
        if (vnpResponseCode === "00" && vnpStatus === "00") {
          desktopStatus = "PAID";
          // Cập nhật trạng thái PAID và thông tin đối soát
          await updateConnection.execute(
            `UPDATE vnpay_transactions 
                         SET status = 'PAID', vnp_transaction_no = ?, vnp_response_code = ?
                         WHERE txn_ref = ? AND status = 'PENDING'`,
            [vnpTranNo, vnpResponseCode, orderId]
          );
          // (TÙY CHỌN) Cập nhật trạng thái nghiệp vụ (bảng orders món ăn)
          // await updateConnection.execute("UPDATE orders SET payment_status = 'PAID' WHERE txn_ref = ?", [orderId]);
        } else if (vnpStatus === "01") {
          // Vẫn đang PENDING (Chưa cần cập nhật gì)
          desktopStatus = "PENDING";
        } else {
          desktopStatus = "FAILED";
          // Cập nhật trạng thái thất bại
          await updateConnection.execute(
            `UPDATE vnpay_transactions 
                         SET status = 'FAILED', vnp_response_code = ? 
                         WHERE txn_ref = ? AND status = 'PENDING'`,
            [vnpResponseCode, orderId]
          );
        }
      } catch (dbError) {
        console.error("Lỗi CẬP NHẬT DB sau Polling:", dbError);
        desktopStatus = "DB_ERROR"; // Nếu lỗi cập nhật DB, vẫn báo lỗi cho client
      } finally {
        if (updateConnection) await updateConnection.end();
      }

      // 5. TRẢ VỀ KẾT QUẢ CHO CLIENT (JavaFX)
      res.status(200).json({
        status: desktopStatus,
        message: "Truy vấn VNPAY hoàn tất",
        vnpResponseCode: vnpResponseCode,
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
