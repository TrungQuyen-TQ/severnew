// File: public/script.js

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // 1. KIỂM TRA ĐĂNG NHẬP VÀ LẤY THÔNG TIN
  // ==========================================================================
  const username = localStorage.getItem("currentUsername");

  // BẢO VỆ TRANG: Nếu không có token (chưa đăng nhập), chuyển về trang login

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

  // Hàm tạo card cho MÓN (giữ nguyên hiển thị ảnh)
  function createProductCard(product, onClick) {
    const card = document.createElement("div");
    card.className = "item-card";
    const imageUrl = product.image_url || "/images/default-food.png";
    let disabled = product.quantity === 0;
    card.innerHTML = `
      <img src="${imageUrl}" alt="${product.name}" ${
      disabled ? 'style="filter: grayscale(1); opacity:0.5;"' : ""
    }>
      <div class="info">
        <h4>${product.name}</h4>
        <p>${product.price.toLocaleString()} VND</p>
        ${disabled ? '<span class="soldout-label">Hết hàng</span>' : ""}
      </div>
    `;
    if (!disabled) {
      card.addEventListener("click", onClick);
    } else {
      card.classList.add("disabled-product");
      card.style.pointerEvents = "none";
    }
    return card;
  }

  // Hàm tạo card cho BÀN:
  function createTableCard(table, onClick) {
    const card = document.createElement("div");
    card.className = "item-card table-card";

    // Lấy số bàn:
    let number = table.id || "";
    console.log("Table id:", table.id);
    if (!number && table.name) {
      const m = table.name.match(/\d+/);
      number = m ? m[0] : table.name;
    }

    // Chọn màu theo trạng thái
    let bgColor = "#bdc3c7"; // mặc định xám
    if (table.status === "Trống") bgColor = "#2ecc71"; // xanh
    else if (table.status === "Có khách") bgColor = "#e74c3c"; // đỏ
    else if (table.status === "Đã đặt") bgColor = "#f39c12"; // cam

    card.innerHTML = `
      <div class="table-number" style="background:${bgColor};">${number}</div>
    `;

    card.addEventListener("click", onClick);
    return card;
  }

  // Hàm tải và hiển thị danh sách bàn
  async function loadTables() {
    try {
      const response = await fetch(`${apiBaseUrl}/tables`, {
        // **THAY ĐỔI:** Bỏ header Authorization, thêm credentials
        credentials: "include",
      });

      // BẢO VỆ TRANG BẰNG CÁCH XỬ LÝ LỖI PHẢN HỒI
      if (response.status === 401 || response.status === 403) {
        alert(
          "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại."
        );
        logout(); // Chuyển hướng người dùng
        return;
      }
      if (!response.ok) throw new Error("Không thể tải danh sách bàn.");

      const tables = await response.json();
      tableListDiv.innerHTML = "";
      tables.forEach((table) => {
        const tableCard = createTableCard(table, () => selectTable(table));
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
        // **THAY ĐỔI:** Bỏ header Authorization, thêm credentials
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        // Đã được xử lý ở loadTables, nhưng thêm ở đây để đảm bảo
        // Nếu loadTables chưa chạy (hoặc có lỗi khác)
        console.warn("Lỗi 401/403 khi tải sản phẩm.");
        logout();
        return;
      }
      if (!response.ok) throw new Error("Không thể tải thực đơn.");

      const products = await response.json();
      productListDiv.innerHTML = "";
      products.forEach((product) => {
        const productCard = createProductCard(
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
  <div class="cart-item-top">
    <strong>${item.name}</strong>
  </div>
  <div class="cart-item-bottom">
    <div class="quantity-controls">
      <button class="qty-btn minus" data-index="${index}">−</button>
      <span class="qty-display">${item.quantity}</span>
      <button class="qty-btn plus" data-index="${index}">+</button>
    </div>
    <span class="price-text">${(
      item.price * item.quantity
    ).toLocaleString()} VND</span>
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

  // 📦 Lắng nghe sự kiện click trên danh sách món
  orderItemsList.addEventListener("click", (e) => {
    if (e.target.classList.contains("qty-btn")) {
      const index = parseInt(e.target.dataset.index, 10);
      if (isNaN(index)) return;

      if (e.target.classList.contains("plus")) {
        newOrderItems[index].quantity++;
      } else if (e.target.classList.contains("minus")) {
        newOrderItems[index].quantity--;
        if (newOrderItems[index].quantity <= 0) {
          newOrderItems.splice(index, 1); // Xóa món khi quantity = 0
        }
      }
      renderNewOrderItems();
    }
  });

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
          // **THAY ĐỔI:** Bỏ header Authorization
          // Authorization: `Bearer ${token}`,
        },
        // **THAY ĐỔI:** Thêm credentials để gửi cookie
        credentials: "include",
        body: JSON.stringify(orderData),
      });

      // Xử lý lỗi đăng nhập/hết hạn
      if (response.status === 401 || response.status === 403) {
        console.warn("Lỗi 401/403 khi gửi đơn hàng.");
        logout();
        return;
      }

      const result = await response.json();
      if (!response.ok) {
        // ✅ Hiển thị cảnh báo lỗi rõ ràng
        alert(result.message || result.error || "Không thể gửi đơn hàng.");

        // 🔁 Tải lại danh sách sản phẩm để hiển thị món hết hàng
        await loadProducts();

        // 🧹 Không reset giỏ hàng (để nhân viên có thể chỉnh lại)
        updateOrderBtn.disabled = false;
        updateOrderBtn.textContent = "Cập Nhật & Gửi Bếp";
        return;
      }

      alert(result.message || "Cập nhật đơn hàng thành công!");
      // Sau khi gửi đơn hàng, cập nhật trạng thái bàn thành "Có khách"
      if (currentTable && currentTable.id) {
        try {
          await fetch(`${apiBaseUrl}/tables/${currentTable.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status: "Có khách" }),
          });
        } catch (e) {
          console.error("Lỗi cập nhật trạng thái bàn:", e);
        }
      }
      resetOrder(); // Xóa giỏ hàng sau khi gửi thành công
      // Reload lại danh sách bàn để cập nhật màu
      loadTables();
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

  // =================== ĐỔI BÀN ===================
  async function loadTablesForChange() {
    console.log("Loading tables for change...");
    const response = await fetch("http://localhost:3000/api/tables", {
      credentials: "include",
    });
    const tables = await response.json();

    const oldSelect = document.getElementById("old-table-select");
    const newSelect = document.getElementById("new-table-select");

    oldSelect.innerHTML = "";
    newSelect.innerHTML = "";

    tables.forEach((table) => {
      const opt1 = document.createElement("option");
      opt1.value = table.id;
      opt1.textContent = `${table.name} (${table.status})`;
      oldSelect.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = table.id;
      opt2.textContent = `${table.name} (${table.status})`;
      newSelect.appendChild(opt2);
    });
  }

  async function changeTable() {
    const old_table_id = document.getElementById("old-table-select").value;
    const new_table_id = document.getElementById("new-table-select").value;
    const msg = document.getElementById("change-table-message");

    if (old_table_id === new_table_id) {
      msg.textContent = "⚠️ Không thể đổi cùng một bàn.";
      msg.style.color = "red";
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/api/change-table", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ old_table_id, new_table_id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi đổi bàn.");

      // ✅ Hiện thông báo thành công
      msg.textContent = data.message;
      msg.style.color = "green";

      // ✅ Giữ tab "Đổi bàn" luôn hiển thị
      const tabBtn = document.querySelector('[data-target="tab-doiban"]');
      const tabContent = document.getElementById("tab-doiban");

      if (tabBtn && tabContent) {
        tabBtn.classList.add("active");
        tabContent.classList.add("active");
      }

      // 🔁 Tải lại danh sách bàn mà KHÔNG ẩn tab
      await loadTablesForChange();
    } catch (error) {
      msg.textContent = "❌ " + error.message;
      msg.style.color = "red";
    }
    loadTables();
  }

  // =================== MÓN ĐÃ HOÀN THÀNH ===================

  // 🟩 1. Load danh sách bill có món đã COOKED
  async function loadCookedBills() {
    console.log("📦 Đang tải danh sách bill có món đã nấu...");

    const listDiv = document.getElementById("bills-list");
    const detailDiv = document.getElementById("bill-detail");
    listDiv.innerHTML = "<p>⏳ Đang tải dữ liệu...</p>";
    detailDiv.innerHTML = "";

    try {
      const res = await fetch("http://localhost:3000/api/cooked-orders", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Không thể tải danh sách bill từ server.");
      const bills = await res.json();

      if (!Array.isArray(bills) || bills.length === 0) {
        listDiv.innerHTML = "<p>✅ Hiện chưa có bill nào có món nấu xong.</p>";
        return;
      }

      listDiv.innerHTML = "";

      bills.forEach((bill) => {
        const billDiv = document.createElement("div");
        billDiv.classList.add("bill-item");
        billDiv.dataset.id = bill.Order_ID;

        billDiv.innerHTML = `
        <strong>Bill ${bill.Order_ID}</strong> (Bàn: ${bill.Ten_Ban})<br>
        <small>Lúc: ${new Date(
          bill.Thoi_Gian_Order
        ).toLocaleTimeString()}</small>
      `;

        billDiv.addEventListener("click", () => {
          document
            .querySelectorAll(".bill-item")
            .forEach((b) => b.classList.remove("active"));
          billDiv.classList.add("active");
          showBillDetail(bill.Order_ID, billDiv);
        });

        listDiv.appendChild(billDiv);
      });
    } catch (error) {
      console.error("❌ Lỗi loadCookedBills:", error);
      listDiv.innerHTML = `<p class="error">❌ ${error.message}</p>`;
    }
  }

  // 🟩 2. Hiển thị chi tiết các món trong 1 bill
  async function showBillDetail(orderId, element) {
    const detailDiv = document.getElementById("bill-detail");
    detailDiv.innerHTML = "<p>⏳ Đang tải chi tiết bill...</p>";

    try {
      const res = await fetch(
        `http://localhost:3000/api/cooked-orders/${orderId}`,
        { credentials: "include" }
      );
      const items = await res.json();

      if (!items || items.length === 0) {
        detailDiv.innerHTML = `<p>✅ Bill #${orderId} đã phục vụ xong.</p>`;
        await loadCookedBills();
        return;
      }

      let html = `
      <div class="bill-detail-header">
        <h2>Chi Tiết Bill #${orderId}</h2>
      </div>
      <table class="bill-table">
        <thead>
          <tr>
            <th>Phục vụ</th>
            <th>Hình ảnh</th>
            <th>Tên món & Ghi chú</th>
            <th>Số lượng</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
    `;

      items.forEach((item) => {
        const isServed = item.TrangThai === "SERVED";
        html += `
        <tr class="${isServed ? "served-row" : ""}">
          <td>
            <input type="checkbox"
              ${isServed ? "checked disabled" : ""}
              data-id="${item.order_detail_id}">
          </td>
          <td><img src="${item.image}" alt="${item.TenMon}" width="60"></td>
          <td><strong>${item.TenMon}</strong><br>${item.GhiChu || ""}</td>
          <td style="color:red;font-weight:600;">${item.SoLuong}</td>
          <td>${isServed ? "✅ Đã phục vụ" : "⏱ Chờ phục vụ"}</td>
        </tr>
      `;
      });

      html += `</tbody></table>`;
      detailDiv.innerHTML = html;

      detailDiv.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.addEventListener("change", async (e) => {
          const detailId = e.target.dataset.id;
          await serveItem(detailId, orderId);
        });
      });
    } catch (error) {
      detailDiv.innerHTML = `<p class="error">❌ ${error.message}</p>`;
    }
  }

  // 🟩 3. Cập nhật trạng thái món (COOKED → SERVED)
  async function serveItem(detailId, orderId) {
    try {
      const res = await fetch(
        `http://localhost:3000/api/serve-item/${detailId}`,
        {
          method: "PUT",
          credentials: "include",
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể phục vụ món.");

      console.log(`✅ ${data.message}`);
      await showBillDetail(
        orderId,
        document.querySelector(".bill-item.active")
      );
    } catch (err) {
      console.error("❌", err.message);
    }
  }

  // 🟢 Khi mở tab “Món đã hoàn thành” thì gọi hàm
  document
    .querySelector('[data-target="tab-monhoanthanh"]')
    .addEventListener("click", loadCookedBills);

  // 🟢 Nút làm mới danh sách bill
  document
    .getElementById("refresh-bills-btn")
    .addEventListener("click", loadCookedBills);

  // Tải danh sách bàn khi vào tab "Đổi bàn"
  const changeTabBtn = document.querySelector('[data-target="tab-doiban"]');
  if (changeTabBtn) {
    changeTabBtn.addEventListener("click", loadTablesForChange);
  }

  const changeBtn = document.getElementById("change-table-btn");
  if (changeBtn) {
    changeBtn.addEventListener("click", changeTable);
  }

  // Hàm xử lý đăng xuất
  async function logout() {
    // 1. Gửi yêu cầu đến server để xóa HttpOnly Cookie (Server phải thiết lập endpoint /api/logout)
    try {
      await fetch(`${apiBaseUrl}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Lỗi khi gọi API logout:", error);
      // Server có thể đã down hoặc gặp lỗi, vẫn tiếp tục xóa local storage và chuyển hướng
    }

    // 2. Xóa các thông tin không nhạy cảm đã lưu
    localStorage.removeItem("currentUsername");
    localStorage.removeItem("userRole");

    // 3. Chuyển hướng
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
