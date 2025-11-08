// File: chef.js (Đã sửa đổi cho luồng làm việc liên tục và sửa lỗi)

document.addEventListener("DOMContentLoaded", () => {
  // LƯU Ý: Biến token KHÔNG CẦN thiết nếu dùng HttpOnly Cookie
  const userRole = localStorage.getItem("userRole"); // role được lưu tạm
  const username = localStorage.getItem("currentUsername"); // Đã thống nhất tên key

  // Khai báo API
  const apiBaseUrl = "http://localhost:3000/api";

  // Khai báo Element
  const pendingBillListDiv = document.getElementById("pending-bill-list");
  const billDetailsPanel = document.getElementById("bill-details-panel");
  const detailsTitle = document.getElementById("details-title");
  const mealListDetails = document.getElementById("meal-list-details");
  const completeOrderBtn = document.getElementById("complete-order-btn");
  const backToBillsBtn = document.getElementById("back-to-bills-btn");

  // Biến lưu trữ dữ liệu
  let allPendingBills = {}; // Lưu trữ Bills đã nhóm

  document.getElementById(
    "welcome-message"
  ).textContent = `Chào Đầu bếp, ${username}!`;

  // --- HÀM XỬ LÝ LỖI AUTHENTICATION (MỚI THÊM) ---
  /**
   * Kiểm tra response. Nếu là lỗi Auth (ví dụ 401/403), tự động logout và trả về true.
   * @param {Response} response - Đối tượng Response từ fetch.
   * @returns {boolean} - True nếu lỗi Auth được xử lý, False nếu không phải lỗi Auth.
   */
  function handleAuthError(response) {
    if (response.status === 401 || response.status === 403) {
      console.warn("Lỗi xác thực (401/403). Đang chuyển hướng về trang đăng nhập.");
      logout(); // Gọi hàm logout đã định nghĩa ở cuối file
      return true; // Báo hiệu đã xử lý lỗi
    }
    return false; // Không phải lỗi Auth
  }
  // --- HÀM XỬ LÝ CHÍNH ---

  // Hàm tải và nhóm đơn hàng thành các Bill
  // Tải danh sách các món ăn đang chờ (PENDING MEALS)
  async function fetchAndGroupOrders() {
    pendingBillListDiv.innerHTML =
      '<div class="loading-state">Đang tải đơn hàng...</div>';
    try {
      const response = await fetch(`${apiBaseUrl}/chef/pending-meals`, {
        method: "GET",
        credentials: "include", // Trình duyệt tự động gửi HttpOnly Cookie
      });

      if (handleAuthError(response)) return; // ✅ SỬ DỤNG HÀM MỚI

      if (!response.ok)
        throw new Error("Không thể tải danh sách món ăn đang chờ.");

      const meals = await response.json();
      groupMealsByOrder(meals);
    } catch (error) {
      console.error("Lỗi tải món ăn đang chờ:", error);
      pendingBillListDiv.innerHTML = `<div class="error-state">Lỗi: ${error.message}</div>`;
    }
  }

  // Nhóm các món ăn theo Order_ID và hiển thị ra danh sách Bill
  function groupMealsByOrder(meals) {
    allPendingBills = meals.reduce((acc, meal) => {
      if (!acc[meal.Order_ID]) {
        acc[meal.Order_ID] = {
          orderId: meal.Order_ID,
          tableName: meal.Ten_Ban,
          time: new Date(meal.Thoi_Gian_Order),
          items: [],
        };
      }
      acc[meal.Order_ID].items.push(meal);
      return acc;
    }, {});

    renderPendingBills();
  }

  // Hàm hiển thị danh sách Bills
  function renderPendingBills() {
    pendingBillListDiv.innerHTML = "";
    const bills = Object.values(allPendingBills);

    if (bills.length === 0) {
        pendingBillListDiv.innerHTML = '<div class="empty-state">Không có Bill đang chờ nào.</div>';
    }

    bills.forEach((bill, index) => {
      const billCard = document.createElement("div");
      billCard.className = "bill-card";
      billCard.dataset.orderId = bill.orderId;
      billCard.innerHTML = `
                <h3>Bill ${index + 1} (Mã: ${bill.orderId})</h3>
                <p>Bàn: ${bill.tableName}</p>
                <p>Lúc: ${bill.time.toLocaleTimeString()}</p>
            `;
      billCard.addEventListener("click", () => selectBill(bill.orderId));
      pendingBillListDiv.appendChild(billCard);
    });

    // Tự động tải Bill tiếp theo nếu có
    loadNextBill();
  }

  // ⭐ HÀM MỚI: Tải Bill đầu tiên trong danh sách và làm sạch giao diện
  function loadNextBill() {
    const bills = Object.values(allPendingBills);

    if (bills.length > 0) {
      // Hiển thị Bill đầu tiên (Bill được order sớm nhất do API đã ORDER BY created_at)
      selectBill(bills[0].orderId);
      billDetailsPanel.classList.remove("hidden");

      // Highlight Bill đang được chọn
      document
        .querySelectorAll(".bill-card")
        .forEach((card) => (card.style.backgroundColor = "white"));
      const currentCard = document.querySelector(
        `.bill-card[data-order-id="${bills[0].orderId}"]`
      );
      if (currentCard) {
        currentCard.style.backgroundColor = "#f0fff0"; // Highlight Bill đang làm
      }
    } else {
      // Không còn Bill nào, làm sạch giao diện chi tiết
      billDetailsPanel.classList.add("hidden");
      mealListDetails.innerHTML = "";
      detailsTitle.textContent = "Chi Tiết Bill";
    }
  }

  // Hàm hiển thị chi tiết Bill khi click
  function selectBill(orderId) {
    const bill = allPendingBills[orderId];
    if (!bill) return;

    // Highlight Bill đang được chọn
    document
      .querySelectorAll(".bill-card")
      .forEach((card) => (card.style.backgroundColor = "white"));
    const currentCard = document.querySelector(
      `.bill-card[data-order-id="${orderId}"]`
    );
    if (currentCard) {
      currentCard.style.backgroundColor = "#f0fff0"; // Highlight Bill đang làm
    }

    // Cập nhật tiêu đề và Order ID
    detailsTitle.textContent = `Chi Tiết Bill #${bill.orderId} (${bill.tableName})`;
    completeOrderBtn.dataset.orderId = bill.orderId;

    // === BẮT ĐẦU PHẦN THAY ĐỔI: THÊM HEADER CỘT ===

    // 1. Định nghĩa hàng tiêu đề
    const headerRow = `
            <div class="meal-detail-header">
                <div style="font-weight: bold; margin-right: 10px; width: 30px;">STT</div>
                <div style="font-weight: bold; width: 60px;">Hình ảnh</div>
                <div class="item-info" style="font-weight: bold;">Tên món ăn & Ghi chú</div>
                <div class="item-quantity" style="font-weight: bold; color: var(--dark-text);">Số lượng</div>
            </div>
        `;

    // 2. Render danh sách món ăn (mapping từ data)
    const mealItemsHtml = bill.items
      .map(
        (meal, index) => `
            <div class="meal-detail-item">
                <div style="font-weight: bold; margin-right: 10px; width: 30px;">${
                  index + 1
                }.</div>
                <img src="${
                  meal.image_url || "/images/default-food.png"
                }" alt="${meal.Ten_Mon_An}">
                <div class="item-info">
                    <strong>${meal.Ten_Mon_An}</strong>
                    <span style="color: #888;">${
                      meal.Ghi_Chu ? `(Ghi chú: ${meal.Ghi_Chu})` : ""
                    }</span>
                </div>
                <div class="item-quantity">${meal.So_Luong}</div>
            </div>
        `
      )
      .join("");

    // 3. Gán cả header và items vào element
    mealListDetails.innerHTML = headerRow + mealItemsHtml;

    // === KẾT THÚC PHẦN THAY ĐỔI ===

    billDetailsPanel.classList.remove("hidden");
    // Cuộn đến đầu danh sách bill trên mobile
    if (window.innerWidth <= 768) {
      billDetailsPanel.scrollIntoView({ behavior: "smooth" });
    }
  }

  // Hàm xử lý nút Hoàn thành Bill & Phục vụ
  async function completeOrder() {
    const orderId = completeOrderBtn.dataset.orderId;
    console.log("DEBUG: Completing order ID:", orderId);
    if (!orderId) return;

    if (
      !confirm(
        `Xác nhận hoàn thành tất cả món ăn trong Bill #${orderId} và chuyển trạng thái thành 'Đã phục vụ'?`
      )
    ) {
      return;
    }

    try {
      completeOrderBtn.disabled = true;
      completeOrderBtn.textContent = "Đang xử lý...";

      // Gọi API để cập nhật trạng thái
      const response = await fetch(
        `${apiBaseUrl}/chef/serve-order/${orderId}`,
        {
          method: "PUT",
          credentials: "include", // Dùng Cookie thay vì Token Header
        }
      );

      if (handleAuthError(response)) return; // ✅ SỬ DỤNG HÀM MỚI

      if (!response.ok) throw new Error("Cập nhật trạng thái thất bại.");

      // Tải lại và hiển thị Bill tiếp theo
      await fetchAndGroupOrders();
    } catch (error) {
      console.error("Lỗi khi hoàn thành Bill:", error);
      alert(error.message);
    } finally {
      completeOrderBtn.disabled = false;
      completeOrderBtn.textContent = "Hoàn Thành Bill & Phục Vụ";
    }
  }

  // Hàm quay lại danh sách trên mobile
  function goBackToBills() {
    billDetailsPanel.classList.add("hidden");
    pendingBillListDiv.scrollIntoView({ behavior: "smooth" });
  }

  // --- GÁN SỰ KIỆN ---
  completeOrderBtn.addEventListener("click", completeOrder);
  backToBillsBtn.addEventListener("click", goBackToBills);

  // HÀM LOGOUT
  async function logout() {
    const apiBaseUrl = "http://localhost:3000/api"; 

    try {
      await fetch(`${apiBaseUrl}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Lỗi khi gọi API logout:", error);
    }

    localStorage.clear();
    window.location.href = "/login.html";
  }

  // --- KHỞI CHẠY ---
  fetchAndGroupOrders();
  // Tự động làm mới danh sách sau mỗi 30 giây
  setInterval(fetchAndGroupOrders, 30000);
});