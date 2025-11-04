// File: public/script.js

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // 1. KIỂM TRA ĐĂNG NHẬP VÀ LẤY THÔNG TIN
  // ==========================================================================
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  // BẢO VỆ TRANG: Nếu không có token (chưa đăng nhập), chuyển về trang login
  if (!token) {
    window.location.href = "/login.html";
    return; // Dừng toàn bộ việc thực thi script nếu chưa đăng nhập
  }

  // ==========================================================================
  // 2. KHAI BÁO BIẾN VÀ LẤY CÁC ELEMENT TỪ HTML
  // ==========================================================================
  const apiBaseUrl = "http://localhost:3000/api";

  const tableSelectionDiv = document.getElementById("table-selection");
  const orderSectionDiv = document.getElementById("order-section");
  const tableListDiv = document.getElementById("table-list");
  const productListDiv = document.getElementById("product-list");
  const currentTableTitle = document.getElementById("current-table-title");
  const orderItemsList = document.getElementById("order-items-list");
  const totalPriceSpan = document.getElementById("total-price");
  const orderNoteTextarea = document.getElementById("order-note");

  const updateOrderBtn = document.getElementById("update-order-btn");
  const cancelOrderBtn = document.getElementById("cancel-order-btn");
  const backToTablesBtn = document.getElementById("back-to-tables-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const welcomeMessageSpan = document.getElementById("welcome-message");

  // Biến để lưu trạng thái của trang
  let currentTable = null;
  let newOrderItems = []; // Chỉ lưu các món MỚI được chọn trong phiên này

  // Chào mừng người dùng
  if (welcomeMessageSpan) {
    welcomeMessageSpan.textContent = `Chào, ${username}!`;
  }

  // ==========================================================================
  // 3. CÁC HÀM XỬ LÝ LOGIC CHÍNH
  // ==========================================================================

  // Hàm trợ giúp: Tạo một card hiển thị (dùng cho cả bàn và món ăn)
  function createCard(item, onClick, isProduct = false) {
    const card = document.createElement("div");
    card.className = "item-card";
    const imageUrl = item.image_url || "/images/default-food.png";
    card.innerHTML = `
            <img src="${imageUrl}" alt="${item.name}">
            <div class="info">
                <h4>${item.name}</h4>
                ${isProduct ? `<p>${item.price.toLocaleString()} VND</p>` : ""}
            </div>
        `;
    card.addEventListener("click", onClick);
    return card;
  }

  // Hàm tải và hiển thị danh sách bàn
  async function loadTables() {
    try {
      const response = await fetch(`${apiBaseUrl}/tables`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Nếu token hết hạn hoặc không hợp lệ, server sẽ trả về 401 hoặc 403
      if (response.status === 401 || response.status === 403) {
        alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        logout();
        return;
      }
      if (!response.ok) throw new Error("Không thể tải danh sách bàn.");

      const tables = await response.json();
      tableListDiv.innerHTML = "";
      tables.forEach((table) => {
        const tableCard = createCard(table, () => selectTable(table));
        tableListDiv.appendChild(tableCard);
      });
    } catch (error) {
      console.error("Lỗi tải danh sách bàn:", error);
    }
  }

  // Hàm tải và hiển thị thực đơn
  async function loadProducts() {
    try {
      const response = await fetch(`${apiBaseUrl}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401 || response.status === 403) {
        alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        logout();
        return;
      }
      if (!response.ok) throw new Error("Không thể tải thực đơn.");

      const products = await response.json();
      productListDiv.innerHTML = "";
      products.forEach((product) => {
        const productCard = createCard(
          product,
          () => addToOrder(product),
          true
        );
        productListDiv.appendChild(productCard);
      });
    } catch (error) {
      console.error("Lỗi tải thực đơn:", error);
    }
  }

  // Hàm xử lý khi chọn một bàn
  function selectTable(table) {
    currentTable = table;
    currentTableTitle.textContent = `Đặt Món cho: ${table.name}`;
    tableSelectionDiv.classList.add("hidden");
    orderSectionDiv.classList.remove("hidden");
    resetOrder();
  }

  // Hàm thêm một món vào giỏ hàng tạm thời
  function addToOrder(product) {
    const existingItem = newOrderItems.find(
      (item) => item.product_id === product.id
    );
    if (existingItem) {
      existingItem.quantity++;
    } else {
      newOrderItems.push({
        product_id: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
      });
    }
    renderNewOrderItems();
  }

  // Hàm hiển thị các món đã chọn ra giỏ hàng
  function renderNewOrderItems() {
    orderItemsList.innerHTML = "";
    if (newOrderItems.length === 0) {
      orderItemsList.innerHTML =
        '<li class="empty-cart">Giỏ hàng đang trống...</li>';
      totalPriceSpan.textContent = "0";
      return;
    }

    let totalPrice = 0;
    for (let index = 0; index < newOrderItems.length; index++) {
      const item = newOrderItems[index];
      const li = document.createElement("li");
      li.innerHTML = `
      <div class="cart-item-info">
                    <span>${item.name} x ${item.quantity}</span>
                    <span>${(
                      item.price * item.quantity
                    ).toLocaleString()} VND</span>
                </div>
                <div class="cart-item-note">
                    <input type="text" class="note-input" data-index="${index}" value="${
        item.note || ""
      }" placeholder="Thêm ghi chú...">
                </div>
            `;
      orderItemsList.appendChild(li);
      totalPrice += item.price * item.quantity;
    }
    // Hiển thị tổng tiền
    totalPriceSpan.textContent = totalPrice.toLocaleString();
  }

  // Hàm xóa các món vừa chọn trong giỏ hàng (chưa gửi đi)
  function resetOrder() {
    newOrderItems = [];
    renderNewOrderItems();
    if (orderNoteTextarea) orderNoteTextarea.value = "";
  }

  // Sự kiện để lưu ghi chú khi người dùng gõ cho từng item
  orderItemsList.addEventListener("input", (e) => {
    if (e.target.classList && e.target.classList.contains("note-input")) {
      const index = parseInt(e.target.dataset.index, 10);
      if (!isNaN(index) && newOrderItems[index]) {
        newOrderItems[index].note = e.target.value;
      }
    }
  });

  // Hàm gửi các món đã chọn lên server
  async function submitOrder() {
    if (newOrderItems.length === 0) {
      alert("Vui lòng chọn thêm món trước khi cập nhật.");
      return;
    }

    const orderData = {
      table_id: currentTable.id,
      items: newOrderItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        note: item.note || null,
      })),
      note: orderNoteTextarea ? orderNoteTextarea.value : "",
    };

    try {
      updateOrderBtn.disabled = true;
      updateOrderBtn.textContent = "Đang gửi...";

      const response = await fetch(`${apiBaseUrl}/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Gửi đơn hàng thất bại.");
      }

      alert(result.message || "Cập nhật đơn hàng thành công!");
      resetOrder(); // Xóa giỏ hàng sau khi gửi thành công
    } catch (error) {
      console.error("Lỗi gửi đơn hàng:", error);
      alert(error.message);
    } finally {
      updateOrderBtn.disabled = false;
      updateOrderBtn.textContent = "Cập Nhật & Gửi Bếp";
    }
  }

  // Hàm quay lại màn hình chọn bàn
  function goBackToTables() {
    orderSectionDiv.classList.add("hidden");
    tableSelectionDiv.classList.remove("hidden");
    currentTable = null;
  }

  // Hàm xử lý đăng xuất
  function logout() {
    localStorage.clear(); // Xóa tất cả thông tin đã lưu
    window.location.href = "/login.html";
  }

  // ==========================================================================
  // 4. GÁN CÁC SỰ KIỆN VÀO CÁC NÚT BẤM
  // ==========================================================================
  updateOrderBtn.addEventListener("click", submitOrder);
  cancelOrderBtn.addEventListener("click", resetOrder);
  backToTablesBtn.addEventListener("click", goBackToTables);
  logoutBtn.addEventListener("click", logout);

  // ==========================================================================
  // 5. KHỞI CHẠY ỨNG DỤNG
  // ==========================================================================
  loadTables();
  loadProducts();
});
