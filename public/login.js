// login.js (Đã Sửa cho HttpOnly Cookie)

document.addEventListener("DOMContentLoaded", () => {
  // Không kiểm tra token trong localStorage vì nó nằm trong HttpOnly Cookie

  const loginForm = document.getElementById("login-form");
  const errorMessage = document.getElementById("error-message");
  // Lấy đường dẫn base của trang hiện tại (ví dụ: http://127.0.0.1:5500)
  const FRONTEND_BASE_URL = window.location.origin;

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorMessage.textContent = "";
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;

      try {
        const BACKEND_URL = "http://localhost:3000";
        console.log(
          "LOGIN REQUEST: Gửi yêu cầu đăng nhập với Username:",
          username
        );

        // Sử dụng /api/auth/login (route chuẩn) hoặc /api/login (route tùy chỉnh)
        const response = await fetch(`${BACKEND_URL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // **QUAN TRỌNG:** Phải có credentials: 'include' để nhận Cookie
          credentials: "include",
          body: JSON.stringify({ username, password }),
        });
        console.log("LOGIN RESPONSE: Trạng thái HTTP:", response.status);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Lỗi đăng nhập không xác định.");
        }

        const data = await response.json();
        console.log("LOGIN SUCCESS: Dữ liệu nhận về (Username/Role):", data);
        console.log(
          "LƯU Ý: Nếu đăng nhập thành công, trình duyệt phải tự động thiết lập HttpOnly Cookie."
        );
        // **QUAN TRỌNG:** Chỉ lưu role và username vào localStorage (không lưu token)
        localStorage.setItem("userRole", data.role);
        localStorage.setItem("currentUsername", data.username);

        console.log("Đăng nhập thành công, Cookie đã được thiết lập.");

        // Chuyển hướng theo vai trò (sử dụng đường dẫn tương đối hoặc base URL)
        const role = data.role.toLowerCase();

        if ( role === "manager") {
          window.location.href = `${FRONTEND_BASE_URL}/admin.html`;
        } else if (role === "chef") {
          window.location.href = `${FRONTEND_BASE_URL}/chef.html`;
        } else if (role === "employee") {
          window.location.href = `${FRONTEND_BASE_URL}/index.html`;
        } else if (role === "admin") {
          window.location.href = `${FRONTEND_BASE_URL}/revenue.html`;
        }
      } catch (error) {
        errorMessage.textContent = error.message;
      }
    });
  }
});
