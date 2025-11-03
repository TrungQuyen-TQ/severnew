// File: chef.js (Đã sửa đổi cho luồng làm việc liên tục)

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    const userRole = localStorage.getItem("userRole");
    const username = localStorage.getItem("username");

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

    // BẢO VỆ TRANG
    if (!token || userRole !== "chef") {
        alert("Truy cập bị từ chối! Trang này chỉ dành cho Đầu bếp.");
        logout();
        return;
    }

    document.getElementById("welcome-message").textContent = `Chào Đầu bếp, ${username}!`;

    // --- HÀM XỬ LÝ CHÍNH ---

    // Hàm tải và nhóm đơn hàng thành các Bill
    async function fetchAndGroupOrders() {
        try {
            const response = await fetch(`${apiBaseUrl}/chef/pending-meals`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            
            if (response.status === 401 || response.status === 403) {
                alert("Phiên đăng nhập đã hết hạn.");
                logout();
                return;
            }
            if (!response.ok) throw new Error("Không thể tải danh sách Bill.");

            const data = await response.json(); 
            allPendingBills = {}; 

            if (data.length === 0) {
                pendingBillListDiv.innerHTML = '<div class="empty-state">🥳 Hiện tại không có Bill nào đang chờ chế biến!</div>';
                billDetailsPanel.classList.add("hidden");
                return;
            }
            
            // Nhóm món ăn theo Order ID (Bill)
            data.forEach(item => {
                const orderId = item.Order_ID;
                if (!allPendingBills[orderId]) {
                    allPendingBills[orderId] = {
                        order_id: orderId,
                        table_name: item.Ten_Ban,
                        created_at: item.Thoi_Gian_Order,
                        meals: []
                    };
                }
                allPendingBills[orderId].meals.push(item);
            });
            
            renderPendingBills();

        } catch (error) {
            console.error("Lỗi tải Bills cho bếp:", error);
            pendingBillListDiv.innerHTML = `<div class="empty-state" style="color: var(--danger-color);">Đã xảy ra lỗi khi tải dữ liệu.</div>`;
        }
    }
    
    // Hàm hiển thị danh sách Bills
    function renderPendingBills() {
        pendingBillListDiv.innerHTML = "";
        const bills = Object.values(allPendingBills);
        
        bills.forEach((bill, index) => {
            const billCard = document.createElement("div");
            billCard.className = "bill-card";
            billCard.dataset.orderId = bill.order_id;
            billCard.innerHTML = `
                <h3>Bill ${index + 1} (Mã: ${bill.order_id})</h3>
                <p>Bàn: ${bill.table_name}</p>
                <p>Lúc: ${new Date(bill.created_at).toLocaleTimeString()}</p>
            `;
            billCard.addEventListener('click', () => selectBill(bill.order_id));
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
            selectBill(bills[0].order_id);
            billDetailsPanel.classList.remove("hidden");
            
            // Highlight Bill đang được chọn
            document.querySelectorAll('.bill-card').forEach(card => card.style.backgroundColor = 'white');
            const currentCard = document.querySelector(`.bill-card[data-order-id="${bills[0].order_id}"]`);
            if (currentCard) {
                currentCard.style.backgroundColor = '#f0fff0'; // Highlight Bill đang làm
            }
        } else {
            // Không còn Bill nào, làm sạch giao diện chi tiết
            billDetailsPanel.classList.add("hidden");
            mealListDetails.innerHTML = '';
            detailsTitle.textContent = 'Chi Tiết Bill';
        }
    }

    // Hàm hiển thị chi tiết Bill khi click
    // Hàm hiển thị chi tiết Bill khi click
    function selectBill(orderId) {
        const bill = allPendingBills[orderId];
        if (!bill) return;

        // Highlight Bill đang được chọn
        document.querySelectorAll('.bill-card').forEach(card => card.style.backgroundColor = 'white');
        const currentCard = document.querySelector(`.bill-card[data-order-id="${orderId}"]`);
        if (currentCard) {
            currentCard.style.backgroundColor = '#f0fff0'; // Highlight Bill đang làm
        }
        
        // Cập nhật tiêu đề và Order ID
        detailsTitle.textContent = `Chi Tiết Bill #${bill.order_id} (${bill.table_name})`;
        completeOrderBtn.dataset.orderId = bill.order_id;
        
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
        const mealItemsHtml = bill.meals.map((meal, index) => `
            <div class="meal-detail-item">
                <div style="font-weight: bold; margin-right: 10px; width: 30px;">${index + 1}.</div>
                <img src="${meal.image_url || '/images/default-food.png'}" alt="${meal.Ten_Mon_An}">
                <div class="item-info">
                    <strong>${meal.Ten_Mon_An}</strong>
                    <span style="color: #888;">${meal.Ghi_Chu ? `(Ghi chú: ${meal.Ghi_Chu})` : ''}</span>
                </div>
                <div class="item-quantity">${meal.So_Luong}</div>
            </div>
        `).join('');

        // 3. Gán cả header và items vào element
        mealListDetails.innerHTML = headerRow + mealItemsHtml;

        // === KẾT THÚC PHẦN THAY ĐỔI ===

        billDetailsPanel.classList.remove("hidden");
        // Cuộn đến đầu danh sách bill trên mobile
        if (window.innerWidth <= 768) {
            billDetailsPanel.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Hàm xử lý nút Hoàn thành Bill & Phục vụ
    async function completeOrder() {
        const orderId = completeOrderBtn.dataset.orderId;
        if (!orderId) return;

        if (!confirm(`Xác nhận hoàn thành tất cả món ăn trong Bill #${orderId} và chuyển trạng thái thành 'Đã phục vụ'?`)) {
            return;
        }

        try {
            completeOrderBtn.disabled = true;
            completeOrderBtn.textContent = "Đang xử lý...";
            
            // Gọi API để cập nhật trạng thái
            const response = await fetch(`${apiBaseUrl}/chef/serve-order/${orderId}`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) throw new Error("Cập nhật trạng thái thất bại.");
            
            //alert(`Bill #${orderId} đã được hoàn thành.`); // Bỏ alert để luồng làm việc nhanh hơn
            
            // ----------------------------------------------------
            // THAY ĐỔI LỚN TẠI ĐÂY: Tải lại và hiển thị Bill tiếp theo
            await fetchAndGroupOrders(); 
            // Hàm fetchAndGroupOrders() sẽ gọi renderPendingBills(),
            // và renderPendingBills() sẽ gọi loadNextBill() để hiển thị Bill kế tiếp.
            // ----------------------------------------------------

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
        pendingBillListDiv.scrollIntoView({ behavior: 'smooth' });
    }

    // --- GÁN SỰ KIỆN ---
    completeOrderBtn.addEventListener("click", completeOrder);
    backToBillsBtn.addEventListener("click", goBackToBills);
    
    function logout() {
        localStorage.clear();
        window.location.href = "/login.html";
    }
    document.getElementById("logout-btn").addEventListener("click", logout);

    // --- KHỞI CHẠY ---
    fetchAndGroupOrders();
    // Tự động làm mới danh sách sau mỗi 30 giây
    setInterval(fetchAndGroupOrders, 30000); 
});