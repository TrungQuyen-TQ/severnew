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
      "SELECT vnp_create_date, status FROM vnpay_transactions WHERE txn_ref = ?", // Lấy thêm cột status
       [orderId]
    );
    if (rows.length === 0) {
      // 🛑 THAY ĐỔI LỚN: Trả về PENDING thay vì FAILED/ERROR
      // Điều này báo cho Client Polling Service biết: 'Giao dịch chưa rõ, HÃY TIẾP TỤC KIỂM TRA'.
      return res
        .status(200)
        .json({ status: "PENDING", message: "Giao dịch đang chờ ghi nhận." });
    }
    const currentStatus = rows[0].status;
    if (currentStatus === 'PAID' || currentStatus === 'FAILED') {
        // Giao dịch đã có kết quả cuối cùng do IPN/vnpayreturn cập nhật
        return res
            .status(200)
            .json({ status: currentStatus, message: `Trạng thái cuối cùng: ${currentStatus}` });
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
  let orderId = req.body.orderId; // VNPAY TxnRef

  // 🛑 THAY ĐỔI 1: Lấy orderId từ req.body (nếu bạn đã lưu order nghiệp vụ trước đó)
  // Nếu bạn muốn dùng mã đơn hàng tạo ra tại đây làm khóa chính:
  let txnRef = req.body.vnpayTxnRef;
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
      orderId,
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
  let locale = req.body.language || "vn";
  let vnp_Params = {};
  // ... (Giữ nguyên các tham số) ...
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = tmnCode;
  vnp_Params["vnp_OrderType"] = "other"; // Ví dụ: đảm bảo không bị thiếu
  vnp_Params["vnp_ExpireDate"] = moment(date)
    .add(15, "minutes")
    .format("YYYYMMDDHHmmss");

  vnp_Params["vnp_TxnRef"] = txnRef; // SỬ DỤNG mã đã lưu DB
  vnp_Params["vnp_Amount"] = amountInCents;
  vnp_Params["vnp_CreateDate"] = createDate;
  vnp_Params["vnp_ReturnUrl"] = returnUrl;
  vnp_Params["vnp_IpAddr"] = ipAddr;
  // BỔ SUNG 2 THAM SỐ BẮT BUỘC
  vnp_Params["vnp_Locale"] = locale || "vn";
  vnp_Params["vnp_CurrCode"] = "VND";
  vnp_Params["vnp_OrderInfo"] = "Thanh toan cho ma GD:" + txnRef;

  // Sort object (đảm bảo thứ tự cho hash)
  vnp_Params = sortObject(vnp_Params);

  var secretKey = config.get("vnp_HashSecret");
  let signData = querystring.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", secretKey);
  let signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");

  vnp_Params["vnp_SecureHash"] = signed; // ✅ Gán Hash đã mã hóa

  let finalVnpUrl =
    vnpUrl + "?" + querystring.stringify(vnp_Params, { encode: false });

  res.status(200).json({
    paymentUrl: finalVnpUrl,
    txnRef: txnRef, // Trả về mã này để client JavaFX Polling
    message: "OK",
  });
});

// Thêm các import cần thiết (giả định bạn đã import chúng ở đầu file)

// TRONG: /routes/order.js

router.get("/vnpay_return", async function (req, res, next) {
  // 1. THU THẬP VÀ XÁC THỰC DỮ LIỆU
  let vnp_Params = req.query;
  let secureHash = vnp_Params["vnp_SecureHash"];
  let orderId = vnp_Params["vnp_TxnRef"];
  let vnpAmount = vnp_Params["vnp_Amount"]; // Cần cho kiểm tra số tiền
  let responseCode = vnp_Params["vnp_ResponseCode"];
  let transactionStatus = vnp_Params["vnp_TransactionStatus"];

  // Loại bỏ Secure Hash để tái tạo chữ ký
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  // Sắp xếp và Hash lại để kiểm tra
  vnp_Params = sortObject(vnp_Params);
  let signed = hashVnpayData(vnp_Params, secretKey);

  let connection = null;
  let viewData = {}; // Đối tượng chứa dữ liệu để truyền sang View

  try {
    connection = await getConnection();
    await connection.beginTransaction(); // BẮT ĐẦU TRANSACTION 🛑

    // 2. KIỂM TRA BẢO MẬT (HASH)
    if (secureHash !== signed) {
      await connection.rollback();
      viewData = {
        title: "Lỗi Thanh Toán",
        code: "97",
        message: "Sai chữ ký bảo mật.",
      };
      return res.render("payment_result", viewData);
    }

    // 3. TRUY VẤN VÀ KIỂM TRA TRẠNG THÁI HIỆN TẠI TRONG DB
    const [transactions] = await connection.execute(
      "SELECT status, amount FROM vnpay_transactions WHERE txn_ref = ?",
      [orderId]
    );

    if (transactions.length === 0) {
      await connection.rollback();
      viewData = {
        title: "Lỗi Thanh Toán",
        code: "01",
        message: "Không tìm thấy giao dịch.",
      };
      return res.render("payment_result", viewData);
    }

    const currentStatus = transactions[0].status;
    const dbAmount = transactions[0].amount;

    // 4. KIỂM TRA VÀ CẬP NHẬT TRẠNG THÁI
    let updateMessage;

    if (currentStatus !== "PENDING") {
      // Giao dịch đã được xử lý (IPN/Polling đã làm rồi)
      await connection.commit();
      updateMessage = "Giao dịch đã được ghi nhận trước đó.";
    } else if (responseCode === "00" && transactionStatus === "00") {
      // KIỂM TRA SỐ TIỀN TRƯỚC KHI CẬP NHẬT
      if (dbAmount !== parseInt(vnpAmount)) {
        await connection.rollback();
        viewData = {
          title: "Lỗi Thanh Toán",
          code: "04",
          message: "Sai số tiền giao dịch.",
        };
        return res.render("payment_result", viewData);
      }

      // ✅ THÀNH CÔNG: Cập nhật trạng thái và thông tin đối soát
      await connection.execute(
        "UPDATE vnpay_transactions SET status = 'PAID', vnp_response_code = ?, updated_at = NOW() WHERE txn_ref = ?",
        [responseCode, orderId]
      );
      // 🛑 LOGIC NGHIỆP VỤ: Cập nhật bảng Orders (món ăn)
      // Cần cập nhật bảng orders/món ăn của bạn tại đây!

      updateMessage = "Thanh toán thành công. Đơn hàng đang được xử lý.";
    } else {
      // ❌ THẤT BẠI/HỦY
      await connection.execute(
        "UPDATE vnpay_transactions SET status = 'FAILED', vnp_response_code = ?, updated_at = NOW() WHERE txn_ref = ?",
        [responseCode, orderId]
      );
      updateMessage = "Giao dịch thất bại hoặc bị hủy.";
    }

    await connection.commit(); // Hoàn tất giao dịch DB

    // 5. TRẢ VỀ KẾT QUẢ ĐỘNG CHO KHÁCH HÀNG
    res.render("payment_result", {
      title: "Kết Quả Thanh Toán",
      code: responseCode,
      orderId: orderId,
      message: updateMessage,
      status: transactionStatus === "00" ? "Thành Công" : "Thất Bại", // Truyền trạng thái động
    });
  } catch (dbError) {
    console.error("Lỗi xử lý VNPAY Return:", dbError);
    await connection.rollback();
    res.render("payment_result", {
      title: "Lỗi Hệ Thống",
      code: "99",
      orderId: orderId,
      message: "Lỗi hệ thống nội bộ khi cập nhật DB.",
      status: "Thất Bại",
    });
  } finally {
    if (connection) await connection.end();
  }
});

// TRONG: /routes/order.js

router.get("/vnpay_ipn", async function (req, res, next) {
  // 1. Khai báo và Xác minh Checksum (Giữ nguyên)
  var vnp_Params = req.query;
  var secureHash = vnp_Params["vnp_SecureHash"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);
  // Thay thế 'config' nếu bạn không dùng
  var secretKey = config.get("vnp_HashSecret");
  // var secretKey = process.env.VNP_HASH_SECRET; // Ví dụ dùng process.env

  var querystring = require("qs");
  var signData = querystring.stringify(vnp_Params, { encode: false });
  var crypto = require("crypto");
  var hmac = crypto.createHmac("sha512", secretKey);
  // Lưu ý: new Buffer đã deprecated. Thay bằng Buffer.from()
  var signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  // 2. Lấy thông tin cần thiết từ VNPAY
  var txnRef = vnp_Params["vnp_TxnRef"];
  var vnpAmount = parseInt(vnp_Params["vnp_Amount"]); // Số tiền (đã nhân 100)
  var vnpResponseCode = vnp_Params["vnp_ResponseCode"];
  var vnpTransactionNo = vnp_Params["vnp_TransactionNo"];

  // 3. Xử lý nghiệp vụ
  if (secureHash === signed) {
    const connection = await getConnection();

    try {
      // A. Kiểm tra giao dịch trong DB
      const [rows] = await connection.execute(
        `SELECT status, amount FROM vnpay_transactions WHERE txn_ref = ?`,
        [txnRef]
      );

      if (rows.length === 0) {
        // 3.1. KHÔNG tìm thấy giao dịch
        console.log(
          `[IPN] Lỗi: Không tìm thấy giao dịch với txn_ref: ${txnRef}`
        );
        return res
          .status(200)
          .json({ RspCode: "01", Message: "Order not found" });
      }

      let transaction = rows[0];

      // B. Kiểm tra trạng thái giao dịch
      if (transaction.status !== "PENDING") {
        // 3.2. Giao dịch đã được xử lý thành công hoặc thất bại trước đó
        console.log(
          `[IPN] Cảnh báo: Giao dịch đã được xử lý (Status: ${transaction.status})`
        );
        return res.status(200).json({ RspCode: "00", Message: "success" });
      }

      // C. Kiểm tra số tiền
      if (vnpAmount !== transaction.amount) {
        // 3.3. Sai lệch số tiền
        console.log(
          `[IPN] Lỗi: Số tiền không khớp. VNPAY: ${vnpAmount}, DB: ${transaction.amount}`
        );
        // Bạn có thể cân nhắc UPDATE status = 'FRAUD' ở đây
        return res
          .status(200)
          .json({ RspCode: "04", Message: "Invalid amount" });
      }

      // D. Cập nhật trạng thái
      let newStatus = "FAILURE";

      if (vnpResponseCode === "00") {
        // Giao dịch THÀNH CÔNG
        newStatus = "SUCCESS";

        // === LOGIC NGHIỆP VỤ BẠN CẦN THÊM VÀO ĐÂY ===
        // Ví dụ: Cập nhật trạng thái đơn hàng (order_id) sang 'PAID'
        // await connection.execute(`UPDATE orders SET payment_status = 'PAID' WHERE id = ?`, [transaction.order_id]);
        // ============================================
      } else {
        // Giao dịch THẤT BẠI (vnpResponseCode khác '00')
        newStatus = "FAILED";
      }

      // Thực hiện UPDATE vào bảng vnpay_transactions
      await connection.execute(
        `UPDATE vnpay_transactions SET status = ?, vnp_transaction_no = ?, vnp_response_code = ? WHERE txn_ref = ?`,
        [newStatus, vnpTransactionNo, vnpResponseCode, txnRef]
      );

      console.log(
        `[IPN] Cập nhật thành công GD ${txnRef}. Trạng thái: ${newStatus}`
      );
      // 3.4. Gửi kết quả '00' cho VNPAY
      return res.status(200).json({ RspCode: "00", Message: "success" });
    } catch (dbError) {
      console.error("[IPN] Lỗi khi xử lý DB:", dbError);
      // 3.5. Lỗi hệ thống nội bộ (DB Error, etc.)
      return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
    } finally {
      await connection.end();
    }
  } else {
    // 4. Lỗi Checksum
    console.log(`[IPN] Lỗi: Checksum không khớp cho txn_ref: ${txnRef}`);
    return res.status(200).json({ RspCode: "97", Message: "Fail checksum" });
  }
});

// TRONG: /routes/order.js

router.post("/querydb", async function (req, res, next) {
    // 🛑 KHẮC PHỤC LỖI CÚ PHÁP: Định nghĩa biến orderId
    const orderId = req.body.vnpayTxnRef;

    if (!orderId) {
        return res
            .status(400)
            .json({ status: "ERROR", message: "Thiếu orderId trong yêu cầu." });
    }

    let connection = null;

    // === GIAI ĐOẠN 1: TRUY VẤN STATUS GIAO DỊCH TỪ DB ===
    try {
        connection = await getConnection(); 
        
        // Truy vấn để lấy trạng thái hiện tại
        const [rows] = await connection.execute(
            "SELECT status FROM vnpay_transactions WHERE txn_ref = ?",
            [orderId]
        );

        if (rows.length === 0) {
            // 💡 LOGIC: Không tìm thấy giao dịch nào tương ứng trong DB.
            // Điều này xảy ra nếu Client Polling quá nhanh (trước khi ghi vào DB) 
            // hoặc mã đã hết hạn/lỗi. Ta trả về PENDING để Client tiếp tục chờ.
            return res
                .status(200)
                .json({ status: "PENDING", message: "Giao dịch đang chờ ghi nhận." });
        }
        
        // Lấy trạng thái hiện tại
        const currentStatus = rows[0].status;

        // Trạng thái từ DB có thể là PAID, FAILED, PENDING, v.v.
        // Trả về trạng thái này cho Client.
        return res
            .status(200)
            .json({ status: currentStatus, message: `Trạng thái từ DB: ${currentStatus}` });

    } catch (dbError) {
        console.error("Lỗi truy vấn DB (querydb):", dbError);
        // Lỗi DB: Trả về ERROR để Client Polling Service có thể xử lý lỗi kết nối
        return res
            .status(500)
            .json({ status: "ERROR", message: "Lỗi nội bộ khi truy vấn DB." });
    } finally {
        if (connection) await connection.end(); // Đóng kết nối DB
    }
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
