// /routes/order.js
/**
 * Created by CTT VNPAY
 */

let express = require('express');
let router = express.Router();
// Bỏ jquery
const request = require('request');
const moment = require('moment');
const config = require('config');
const crypto = require("crypto");
const querystring = require('qs');

// Hàm tiện ích (phải giữ lại)
function sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj){
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
const tmnCode = config.get('vnp_TmnCode');
const secretKey = config.get('vnp_HashSecret');
const vnpUrl = config.get('vnp_Url');
const returnUrl = config.get('vnp_ReturnUrl');
const vnpApi = config.get('vnp_Api');

router.get('/', function(req, res, next){
    res.render('orderlist', { title: 'Danh sách đơn hàng' })
});

router.get('/create_payment_url', function (req, res, next) {
    res.render('order', {title: 'Tạo mới đơn hàng', amount: 10000})
});

router.get('/querydr', function (req, res, next) {
    res.render('querydr', {title: 'Truy vấn kết quả thanh toán'})
});

router.get('/refund', function (req, res, next) {
    res.render('refund', {title: 'Hoàn tiền giao dịch thanh toán'})
});


router.post('/create_payment_url', function (req, res, next) {
    
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    
    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');
    
    let ipAddr = req.headers['x-forwarded-for'] ||
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
    if(bankCode) {
        vnp_Params['vnp_BankCode'] = bankCode;
    }

    vnp_Params = sortObject(vnp_Params);

    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey); // Dùng hằng số từ config
    let signed = hmac.update(new Buffer(signData, 'utf-8')).digest("hex"); 
    vnp_Params['vnp_SecureHash'] = signed;
    let finalVnpUrl = vnpUrl + '?' + querystring.stringify(vnp_Params, { encode: false }); // Dùng hằng số từ config

    // Giữ nguyên phản hồi JSON (như order.js cũ)
    res.status(200).json({
        paymentUrl: finalVnpUrl,
        message: 'OK'
    });
});

// routes vnpay_return, vnpay_ipn, querydr, refund được giữ nguyên logic
// ... (các route còn lại) ...

router.get('/vnpay_return', function (req, res, next) {
    let vnp_Params = req.query;

    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);

    let querystring = require('qs');
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");     
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(new Buffer(signData, 'utf-8')).digest("hex");     

    if(secureHash === signed){
        //Kiem tra xem du lieu trong db co hop le hay khong va thong bao ket qua

        res.render('success', {code: vnp_Params['vnp_ResponseCode']})
    } else{
        res.render('success', {code: '97'})
    }
});

router.get('/vnpay_ipn', function (req, res, next) {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];
    
    let orderId = vnp_Params['vnp_TxnRef'];
    let rspCode = vnp_Params['vnp_ResponseCode'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    
    let querystring = require('qs');
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");     
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(new Buffer(signData, 'utf-8')).digest("hex");     
    
    let paymentStatus = '0'; 
    
    let checkOrderId = true; 
    let checkAmount = true; 
    if(secureHash === signed){ 
        if(checkOrderId){
            if(checkAmount){
                if(paymentStatus=="0"){ 
                    if(rspCode=="00"){
                        res.status(200).json({RspCode: '00', Message: 'Success'})
                    }
                    else {
                        res.status(200).json({RspCode: '00', Message: 'Success'})
                    }
                }
                else{
                    res.status(200).json({RspCode: '02', Message: 'This order has been updated to the payment status'})
                }
            }
            else{
                res.status(200).json({RspCode: '04', Message: 'Amount invalid'})
            }
        }       
        else {
            res.status(200).json({RspCode: '01', Message: 'Order not found'})
        }
    }
    else {
        res.status(200).json({RspCode: '97', Message: 'Checksum failed'})
    }
});

router.post('/querydr', function (req, res, next) {
    
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    let date = new Date();

    let crypto = require("crypto");
    
    let vnp_TxnRef = req.body.orderId;
    let vnp_TransactionDate = req.body.transDate;
    
    let vnp_RequestId =moment(date).format('HHmmss');
    let vnp_Version = '2.1.0';
    let vnp_Command = 'querydr';
    let vnp_OrderInfo = 'Truy van GD ma:' + vnp_TxnRef;
    
    let vnp_IpAddr = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    let vnp_CreateDate = moment(date).format('YYYYMMDDHHmmss');
    
    let data = vnp_RequestId + "|" + vnp_Version + "|" + vnp_Command + "|" + tmnCode + "|" + vnp_TxnRef + "|" + vnp_TransactionDate + "|" + vnp_CreateDate + "|" + vnp_IpAddr + "|" + vnp_OrderInfo;
    
    let hmac = crypto.createHmac("sha512", secretKey);
    let vnp_SecureHash = hmac.update(new Buffer(data, 'utf-8')).digest("hex"); 
    
    let dataObj = {
        'vnp_RequestId': vnp_RequestId,
        'vnp_Version': vnp_Version,
        'vnp_Command': vnp_Command,
        'vnp_TmnCode': tmnCode,
        'vnp_TxnRef': vnp_TxnRef,
        'vnp_OrderInfo': vnp_OrderInfo,
        'vnp_TransactionDate': vnp_TransactionDate,
        'vnp_CreateDate': vnp_CreateDate,
        'vnp_IpAddr': vnp_IpAddr,
        'vnp_SecureHash': vnp_SecureHash
    };
    
    request({
        url: vnpApi,
        method: "POST",
        json: true,  
        body: dataObj
    }, function (error, response, body){
        if (error || !body || response.statusCode !== 200) {
            return res.status(200).json({ status: 'ERROR', message: 'Lỗi kết nối VNPAY API' });
        }
        
        let vnpResponseCode = body.vnp_ResponseCode; 
        let vnpStatus = body.vnp_TransactionStatus; 
        
        let desktopStatus = 'PENDING';
        
        if (vnpResponseCode === '00' && vnpStatus === '00') {
            desktopStatus = 'PAID'; 
        } else {
             desktopStatus = 'FAILED';
        }
        
        res.status(200).json({ 
            status: desktopStatus,
            message: 'Truy vấn VNPAY hoàn tất' 
        });
    });
});

router.post('/refund', function (req, res, next) {
    
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    let date = new Date();
    
    let vnp_TxnRef = req.body.orderId;
    let vnp_TransactionDate = req.body.transDate;
    let vnp_Amount = req.body.amount *100;
    let vnp_TransactionType = req.body.transType;
    let vnp_CreateBy = req.body.user;
            
    let vnp_RequestId = moment(date).format('HHmmss');
    let vnp_Version = '2.1.0';
    let vnp_Command = 'refund';
    let vnp_OrderInfo = 'Hoan tien GD ma:' + vnp_TxnRef;
            
    let vnp_IpAddr = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    
    let vnp_CreateDate = moment(date).format('YYYYMMDDHHmmss');
    
    let vnp_TransactionNo = '0';
    
    let data = vnp_RequestId + "|" + vnp_Version + "|" + vnp_Command + "|" + tmnCode + "|" + vnp_TransactionType + "|" + vnp_TxnRef + "|" + vnp_Amount + "|" + vnp_TransactionNo + "|" + vnp_TransactionDate + "|" + vnp_CreateBy + "|" + vnp_CreateDate + "|" + vnp_IpAddr + "|" + vnp_OrderInfo;
    let hmac = crypto.createHmac("sha512", secretKey);
    let vnp_SecureHash = hmac.update(new Buffer(data, 'utf-8')).digest("hex");
    
     let dataObj = {
        'vnp_RequestId': vnp_RequestId,
        'vnp_Version': vnp_Version,
        'vnp_Command': vnp_Command,
        'vnp_TmnCode': tmnCode,
        'vnp_TransactionType': vnp_TransactionType,
        'vnp_TxnRef': vnp_TxnRef,
        'vnp_Amount': vnp_Amount,
        'vnp_TransactionNo': vnp_TransactionNo,
        'vnp_CreateBy': vnp_CreateBy,
        'vnp_OrderInfo': vnp_OrderInfo,
        'vnp_TransactionDate': vnp_TransactionDate,
        'vnp_CreateDate': vnp_CreateDate,
        'vnp_IpAddr': vnp_IpAddr,
        'vnp_SecureHash': vnp_SecureHash
    };
    
    request({
        url: vnpApi,
        method: "POST",
        json: true,   
        body: dataObj
            }, function (error, response, body){
                // Xử lý phản hồi từ VNPAY (chưa có trong code cũ, cần thêm)
                console.log(response.body);
                // Trả về kết quả JSON (tùy theo nhu cầu của bạn)
                res.status(200).json(response.body); 
            });
    
});

module.exports = router;