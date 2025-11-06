document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("userRole");
  const username = localStorage.getItem("username");

  // BẢO VỆ TRANG: Kiểm tra đăng nhập và vai trò
  if (!token || userRole !== "manager") {
    alert("Truy cập bị từ chối!");
    localStorage.clear();
    window.location.href = "/login.html";
    return; // Dừng thực thi code
  }

  // Chào mừng admin
  document.getElementById("welcome-message").textContent = `Chào, ${username}!`;

  // Khai báo các biến
  const productListDiv = document.getElementById("admin-product-list");
  const productForm = document.getElementById("product-form");
  const formTitle = document.getElementById("form-title");
  const productIdInput = document.getElementById("product-id");
  const productNameInput = document.getElementById("product-name");
  const productPriceInput = document.getElementById("product-price");
  const productImageInput = document.getElementById("product-image");

  const apiBaseUrl = "http://localhost:3000/api";

  // Hàm lấy và hiển thị danh sách sản phẩm
  async function fetchAndRenderProducts() {
    try {
      const response = await fetch(`${apiBaseUrl}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        window.location.href = "/login.html";
      }
      const products = await response.json();
      productListDiv.innerHTML = ""; // Xóa danh sách cũ
      products.forEach((product) => {
        const productEl = document.createElement("div");
        productEl.className = "product-item-admin";
        productEl.innerHTML = `
                    <img src="${
                      product.image_url || "/images/default.png"
                    }" alt="${product.name}">
                    <div class="info">
                        <strong>${product.name}</strong>
                        <span>${product.price.toLocaleString()} VND</span>
                    </div>
                    <div class="actions">
                        <button class="edit-btn" data-id="${
                          product.id
                        }">Sửa</button>
                        <button class="delete-btn" data-id="${
                          product.id
                        }">Xóa</button>
                    </div>
                `;
        productListDiv.appendChild(productEl);
      });
    } catch (error) {
      console.error("Lỗi tải sản phẩm:", error);
    }
  }

  // Hàm reset form
  function clearForm() {
    formTitle.textContent = "Thêm Món Ăn Mới";
    productIdInput.value = "";
    productForm.reset();
  }

  // Sự kiện submit form (cho cả Thêm và Sửa)
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = productIdInput.value;
    const productData = {
      name: productNameInput.value,
      price: parseFloat(productPriceInput.value),
      image_url: productImageInput.value,
    };

    const isEditing = id !== "";
    const url = isEditing
      ? `${apiBaseUrl}/products/${id}`
      : `${apiBaseUrl}/products`;
    const method = isEditing ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(productData),
      });

      if (!response.ok) throw new Error("Thao tác thất bại.");

      alert(isEditing ? "Cập nhật thành công!" : "Thêm món ăn thành công!");
      clearForm();
      fetchAndRenderProducts(); // Tải lại danh sách
    } catch (error) {
      console.error("Lỗi khi lưu sản phẩm:", error);
      alert(error.message);
    }
  });

  // Sự kiện click vào các nút Sửa/Xóa
  productListDiv.addEventListener("click", async (e) => {
    const target = e.target;
    const id = target.dataset.id;

    // Xử lý nút Sửa
    if (target.classList.contains("edit-btn")) {
      const productEl = target.closest(".product-item-admin");
      formTitle.textContent = "Sửa Món Ăn";
      productIdInput.value = id;
      productNameInput.value = productEl.querySelector("strong").textContent;
      const priceText = productEl
        .querySelector("span")
        .textContent.replace(" VND", "")
        .replace(/,/g, "");
      productPriceInput.value = parseFloat(priceText);
      productImageInput.value = productEl
        .querySelector("img")
        .src.split("/")
        .slice(3)
        .join("/");
      window.scrollTo(0, 0); // Cuộn lên đầu trang
    }

    // Xử lý nút Xóa
    if (target.classList.contains("delete-btn")) {
      if (confirm("Bạn có chắc chắn muốn xóa món ăn này không?")) {
        try {
          const response = await fetch(`${apiBaseUrl}/products/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error("Xóa thất bại.");
          alert("Xóa thành công!");
          fetchAndRenderProducts(); // Tải lại danh sách
        } catch (error) {
          console.error("Lỗi khi xóa:", error);
          alert(error.message);
        }
      }
    }
  });

  // Nút Hủy trên form
  document
    .getElementById("clear-form-btn")
    .addEventListener("click", clearForm);

  // Xử lý nút Đăng xuất
  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login.html";
  });

  // Tải danh sách sản phẩm khi trang được mở
  fetchAndRenderProducts();
});
