// File: chef.js (ĐÃ CẬP NHẬT LOGIC BILL DISAPPEAR VÀ VỊ TRÍ CỘT)

// ✅ HÀM LOGOUT PHẢI NẰM Ở PHẠM VI TOÀN CỤC
async function logout() {
  const apiBaseUrl = "http://localhost:3000/api"; 
  console.log("DEBUG: Đang gọi hàm logout");
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


document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("currentUsername"); 
  const apiBaseUrl = "http://localhost:3000/api";

  const pendingBillListDiv = document.getElementById("pending-bill-list");
  const billDetailsPanel = document.getElementById("bill-details-panel");
  const detailsTitle = document.getElementById("details-title");
  const mealListDetails = document.getElementById("meal-list-details");
  const completeOrderBtn = document.getElementById("complete-order-btn");
  const backToBillsBtn = document.getElementById("back-to-bills-btn");

  let allPendingBills = {}; 

  document.getElementById(
    "welcome-message"
  ).textContent = `Chào Đầu bếp, ${username}!`;

  // --- HÀM XỬ LÝ LỖI AUTHENTICATION ---
  function handleAuthError(response) {
    if (response.status === 401 || response.status === 403) {
      console.warn("Lỗi xác thực (401/403). Đang chuyển hướng về trang đăng nhập.");
      logout(); 
      return true;
    }
    return false;
  }

  // --- HÀM XỬ LÝ CHÍNH ---

  async function fetchAndGroupOrders() {
    pendingBillListDiv.innerHTML =
      '<div class="loading-state">Đang tải đơn hàng...</div>';
    try {
      const response = await fetch(`${apiBaseUrl}/chef/pending-meals`, {
        method: "GET",
        credentials: "include",
      });

      if (handleAuthError(response)) return;

      if (!response.ok)
        throw new Error("Không thể tải danh sách món ăn đang chờ.");

      const meals = await response.json();
      groupMealsByOrder(meals);
    } catch (error) {
      console.error("Lỗi tải món ăn đang chờ:", error);
      pendingBillListDiv.innerHTML = `<div class="error-state">Lỗi: ${error.message}</div>`;
    }
  }

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

  function renderPendingBills() {
    pendingBillListDiv.innerHTML = "";
    const bills = Object.values(allPendingBills);

    if (bills.length === 0) {
        pendingBillListDiv.innerHTML = '<div class="empty-state">Không có Bill đang chờ nào.</div>';
        billDetailsPanel.classList.add("hidden"); 
        return;
    }

    bills.sort((a, b) => a.time - b.time);

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

    loadNextBill();
  }

  function loadNextBill() {
    const bills = Object.values(allPendingBills);
    bills.sort((a, b) => a.time - b.time); 

    if (bills.length > 0) {
      const nextOrderId = bills[0].orderId;
      selectBill(nextOrderId);
      billDetailsPanel.classList.remove("hidden");
      
      document
        .querySelectorAll(".bill-card")
        .forEach((card) => (card.style.backgroundColor = "white"));
      const currentCard = document.querySelector(
        `.bill-card[data-order-id="${nextOrderId}"]`
      );
      if (currentCard) {
        currentCard.style.backgroundColor = "#f0fff0";
      }
    } else {
      billDetailsPanel.classList.add("hidden");
      mealListDetails.innerHTML = "";
      detailsTitle.textContent = "Chi Tiết Bill";
    }
  }

  
  function selectBill(orderId) {
    const bill = allPendingBills[orderId];
    if (!bill) return;

    // Sắp xếp: PENDING -> COOKED
    bill.items.sort((a, b) => {
        const orderMap = { 'PENDING': 0, 'COOKED': 1, 'SERVED': 2 };
        return (orderMap[a.Trang_Thai_Mon] || 0) - (orderMap[b.Trang_Thai_Mon] || 0); 
    });

    document
      .querySelectorAll(".bill-card")
      .forEach((card) => (card.style.backgroundColor = "white"));
    const currentCard = document.querySelector(
      `.bill-card[data-order-id="${orderId}"]`
    );
    if (currentCard) {
      currentCard.style.backgroundColor = "#f0fff0";
    }

    detailsTitle.textContent = `Chi Tiết Bill #${bill.orderId} (${bill.tableName})`;
    completeOrderBtn.dataset.orderId = bill.orderId;
    
    // 1. Định nghĩa hàng tiêu đề (CHỌN Ở CUỐI)
    const headerRow = `
        <div class="meal-detail-header">
            <div style="font-weight: bold; margin-right: 10px; width: 30px;">STT</div>
            <div style="font-weight: bold; width: 60px;">Hình ảnh</div>
            <div class="item-info" style="font-weight: bold;">Tên món ăn & Ghi chú</div>
            <div class="item-quantity" style="font-weight: bold; color: var(--dark-text);">Số lượng</div>
            <div style="font-weight: bold; width: 80px; text-align: center;">Hành động</div> 
            <div style="font-weight: bold; width: 30px; text-align: center;">Chọn</div>
        </div>
    `;

    // 2. Render danh sách món ăn (Cú pháp HTML đã sửa và vị trí cột đã đổi)
    const mealItemsHtml = bill.items
      .map(
        (meal, index) => {
            const detailId = meal.Chi_Tiet_ID; 
            const status = meal.Trang_Thai_Mon; 
            
            const isPending = status === 'PENDING';
            const isCooked = status === 'COOKED';
            
            let checkboxHtml = '';
            if (isPending) {
                checkboxHtml = `<input type="checkbox" class="cook-checkbox" data-detail-id="${detailId}">`;
            } else if (isCooked) {
                checkboxHtml = `<span style="color: #27ae60;">✔</span>`; 
            }
            
            let actionHtml = '';
            if (isPending) {
                actionHtml = `<span style="color: #e67e22; font-weight: bold;">Đang Chờ</span>`;
            } else if (isCooked) {
                actionHtml = `<span style="color: #27ae60; font-weight: bold;">Đã Nấu</span>`;
            } 
            
            const itemClass = isCooked ? 'done-item' : '';
            
            return `
                <div class="meal-detail-item ${itemClass}">
                    <div style="font-weight: bold; margin-right: 10px; width: 30px;">${index + 1}.</div> 
                    <img src="${meal.image_url || "/images/default-food.png"}" alt="${meal.Ten_Mon_An}"> 
                    <div class="item-info"> 
                        <strong>${meal.Ten_Mon_An}</strong>
                        <span style="color: #888;">${
                          meal.Ghi_Chu ? `(Ghi chú: ${meal.Ghi_Chu})` : ""
                        }</span>
                    </div>
                    <div class="item-quantity">${meal.So_Luong}</div> 
                    <div style="width: 80px; text-align: center;">${actionHtml}</div> 
                    <div style="width: 30px; text-align: center;">${checkboxHtml}</div> 
                </div>
            `;
        }
      )
      .join("");

    mealListDetails.innerHTML = headerRow + mealItemsHtml;

    // ✅ LOGIC CẬP NHẬT NÚT HOÀN THÀNH
    const updateCompleteButton = () => {
        const checkedCount = document.querySelectorAll('#bill-details-panel .cook-checkbox:checked').length;
        
        completeOrderBtn.textContent = checkedCount > 0 
            ? `Hoàn Thành ${checkedCount} Món Đã Chọn`
            : 'Chưa có món nào được chọn';
        
        completeOrderBtn.disabled = checkedCount === 0;
        
        const hasPendingItems = bill.items.some(item => item.Trang_Thai_Mon === 'PENDING');

        if (!hasPendingItems) {
             completeOrderBtn.classList.add('hidden');
             mealListDetails.innerHTML += '<div class="empty-state" style="margin-top: 20px; color: green; font-weight: bold;">✅ Bill này đã hoàn thành công đoạn Bếp!</div>';
        } else {
            completeOrderBtn.classList.remove('hidden');
        }
    };
    
    // Gán sự kiện cho tất cả checkbox
    document.querySelectorAll('#bill-details-panel .cook-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateCompleteButton);
    });

    // Cập nhật trạng thái nút lần đầu
    updateCompleteButton(); 

    billDetailsPanel.classList.remove("hidden");
    if (window.innerWidth <= 768) {
      billDetailsPanel.scrollIntoView({ behavior: "smooth" });
    }
  }

  
  // Hàm xử lý nút Hoàn thành (cập nhật các món đã chọn thành COOKED)
  async function completeOrder() {
    const orderId = completeOrderBtn.dataset.orderId;
    if (!orderId || completeOrderBtn.disabled) return;

    // 1. Lấy tất cả detail_id đã được tích chọn
    const checkedCheckboxes = document.querySelectorAll('#bill-details-panel .cook-checkbox:checked');
    const checkedDetails = Array.from(checkedCheckboxes)
                                .map(checkbox => checkbox.dataset.detailId);
    
    if (checkedDetails.length === 0) {
        alert("Vui lòng chọn ít nhất một món để hoàn thành.");
        return;
    }

    if (
      !confirm(
        `Xác nhận chuyển ${checkedDetails.length} món ăn đã chọn trong Bill #${orderId} thành 'Đã nấu xong' ('COOKED')?`
      )
    ) {
      return;
    }

    try {
      completeOrderBtn.disabled = true;
      completeOrderBtn.textContent = "Đang xử lý...";
      
      // GỌI API THEO VÒNG LẶP: PUT /api/chef/cook-meal/:detail_id
      const updatePromises = checkedDetails.map(detail_id => 
          fetch(`${apiBaseUrl}/chef/cook-meal/${detail_id}`, {
              method: "PUT",
              credentials: "include", 
          })
      );
      
      const results = await Promise.all(updatePromises);
      
      let successCount = 0;
      let errorMessages = [];

      // Kiểm tra kết quả
      for (let i = 0; i < results.length; i++) {
          const response = results[i];
          if (handleAuthError(response)) return;
          
          if (response.ok) {
              successCount++;
          } else {
              const errorBody = await response.json();
              errorMessages.push(`Món ${checkedDetails[i]}: ${errorBody.error || "Lỗi không xác định"}`);
          }
      }

      if (successCount > 0) {
          alert(`✅ Đã hoàn thành nấu ${successCount} món ăn. \n${errorMessages.join('\n')}`);
      } else {
          throw new Error("Không có món nào được cập nhật thành công.");
      }

      // 2. ✅ GỌI API SERVER ĐỂ KIỂM TRA & CẬP NHẬT TRẠNG THÁI BILL TỔNG THỂ
      await updateOrderStatusIfFullyCooked(orderId);


      // Tải lại: Bill sẽ biến mất nếu trạng thái orders.status đã được chuyển sang COOKED
      await fetchAndGroupOrders();
      
    } catch (error) {
      console.error("Lỗi khi hoàn thành món ăn:", error);
      alert(error.message);
    } finally {
      // Trạng thái nút sẽ được cập nhật lại sau khi fetchAndGroupOrders xong
    }
  }
  
  // ✅ HÀM MỚI: GỌI API SERVER ĐỂ CẬP NHẬT TRẠNG THÁI BILL TỔNG THỂ
  async function updateOrderStatusIfFullyCooked(orderId) {
    // Đảm bảo URL cơ sở có sẵn
    const apiBaseUrl = "http://localhost:3000/api";
    try {
        const response = await fetch(`${apiBaseUrl}/chef/check-complete-cooking/${orderId}`, {
            method: 'PUT',
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Lỗi kiểm tra hoàn thành bill:", errorBody.error);
        }
        // Nếu thành công, orders.status đã được chuyển sang 'COOKED' trên server
    } catch (error) {
        console.error("Lỗi mạng khi cập nhật trạng thái bill:", error);
    }
}

  function goBackToBills() {
    billDetailsPanel.classList.add("hidden");
    pendingBillListDiv.scrollIntoView({ behavior: "smooth" });
  }

  // --- GÁN SỰ KIỆN ---
  completeOrderBtn.addEventListener("click", completeOrder);
  backToBillsBtn.addEventListener("click", goBackToBills);

  // --- KHỞI CHẠY ---
  fetchAndGroupOrders();
  // Tự động làm mới danh sách sau mỗi 30 giây
  setInterval(fetchAndGroupOrders, 30000);
});