document.addEventListener("DOMContentLoaded", () => {
  // Nếu đã đăng nhập, tự động chuyển hướng
  const token = localStorage.getItem("token");
  if (token) {
    const role = localStorage.getItem("userRole");
    window.location.href = role === "admin" ? "/admin.html" : "/index.html";
  }

  const loginForm = document.getElementById("login-form");
  const errorMessage = document.getElementById("error-message");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMessage.textContent = "";
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const BACKEND_URL = "http://localhost:3000";
      const response = await fetch(`${BACKEND_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      const data = await response.json();

      // Lưu thông tin vào localStorage để dùng cho các trang khác
      localStorage.setItem("token", data.token);
      localStorage.setItem("userRole", data.role);
      localStorage.setItem("username", data.username);

      // Chuyển hướng
      if (data.role === "admin") { window.location.href = `${BACKEND_URL}/admin.html`; } else if (data.role === "chef") { location.href = `${BACKEND_URL}/chef.html`; } else { window.location.href = `${BACKEND_URL}/index.html`; }
    } catch (error) {
      errorMessage.textContent = error.message;
    }
  });
});
