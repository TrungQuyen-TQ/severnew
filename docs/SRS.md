# Software Requirements Specification (SRS) — sever_ProjectII

Version: 1.0.0
Date: 2025-11-17
Authors: Project Team

## 1. Introduction

### 1.1 Purpose
Tài liệu này mô tả các yêu cầu chức năng và phi chức năng cho hệ thống backend "sever_ProjectII" (Express + MySQL) — một dịch vụ quản lý nhà hàng tích hợp thanh toán VNPAY.

### 1.2 Scope
Hệ thống cung cấp API cho: xác thực người dùng (JWT), quản lý sản phẩm, bàn, đơn hàng, báo cáo doanh thu và tích hợp VNPAY cho thanh toán.

### 1.3 Definitions, acronyms, abbreviations
- API: Application Programming Interface
- JWT: JSON Web Token
- SRS: Software Requirements Specification
- NFR: Non-Functional Requirement

## 2. Overall Description

### 2.1 Product perspective
Ứng dụng là backend RESTful kết nối tới MySQL, phục vụ trang web tĩnh trong `public/` và các view VNPAY (Jade). Có phân quyền role (admin/manager/chef/employee).

### 2.2 User classes and characteristics
- Admin/Manager: thêm/sửa/xóa sản phẩm, quản lý người dùng, truy vấn báo cáo
- Chef: xem danh sách món cần chế biến
- Employee: tạo đơn hàng
- End user: sử dụng trang VNPAY để thanh toán

## 3. Functional Requirements (mô tả ngắn)
1. Authentication
   - POST /api/login -> trả JWT (cookie HttpOnly)
   - POST /api/auth/logout -> clear cookie
2. Users
   - GET /api/users (manager only)
   - POST /api/users (manager only)
   - PUT /api/users/:id (manager only)
   - DELETE /api/users/:id (manager only)
3. Products
   - GET /api/products
   - POST /api/products (manager)
   - PUT /api/products/:id (manager)
   - DELETE /api/products/:id (manager)
4. Tables
   - CRUD endpoints tại `/api/tables`
5. Orders & VNPAY
   - GET /order (render form)
   - POST /order/create_payment_url (tạo URL thanh toán VNPAY)
   - POST /order/querydr (tra cứu giao dịch)
   - POST /order/refund (yêu cầu hoàn tiền)
6. Reporting
   - GET /api/revenue, /api/revenue/by-category, /api/top-products

## 4. Non-Functional Requirements
- Performance: 95% requests < 300ms under normal load.
- Security:
  - JWT for authentication; cookies set HttpOnly
  - Passwords hashed with bcrypt
  - Do not log plaintext passwords (sensitive data redaction)
  - Follow OWASP Top 10 guidance for APIs
- Reliability: Use proper DB transactions for order creation; roll back on failure.
- Maintainability: Follow consistent module organization in `routes/`, use config files in `config/`.
- Portability: Runs on Node.js (v14+) on Windows/Linux; DB is MySQL/MariaDB.

## 5. Constraints and Assumptions
- Uses `config/default.json` for environment configuration in development.
- VNPAY integration uses sandbox endpoints for testing.
- Passwords in DB must be bcrypt-hashed for login to work.

## 6. Acceptance Criteria
- All listed endpoints respond with appropriate status codes and JSON or rendered views.
- Authentication flows issue JWT and protect routes requiring auth.
- Payment flow returns a VNPAY redirect URL and the system can query transaction results.

## 7. Appendix / Glossary
Include references to OpenAPI spec, README, INSTALL and developer docs in `docs/`.


---
Generated (concise) SRS for rapid handoff. Expand sections as needed for compliance with ISO/IEEE 29148.