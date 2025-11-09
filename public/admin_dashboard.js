// admin_dashboard.js

const API_BASE_URL = 'http://localhost:3000/api'; 
const modal = document.getElementById('crudModal');
const modalTitle = document.getElementById('modalTitle');
const crudForm = document.getElementById('crudForm');

let currentEntity = ''; // 'product', 'table', hoặc 'user'
let currentMode = ''; // 'create' hoặc 'edit'
let currentId = null; 
const ALL_ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'CHEF'];
const TABLE_STATUSES = ['Trống', 'Có khách', 'Đã đặt'];

// --- 1. Xử lý Đăng nhập & Auth (Dùng Cookie) ---
function checkAuth() {
    const role = localStorage.getItem('userRole');
    const username = localStorage.getItem('currentUsername');

    // Nếu không có role, coi như chưa đăng nhập hoặc cookie đã hết hạn. Chuyển hướng.
    if (!role) {
        window.location.href = 'login.html'; 
        return null;
    }
    document.getElementById('userRoleDisplay').textContent = role;
    document.getElementById('currentUsernameDisplay').textContent = username;
    return role;
}

function logout() {
    // 1. Gọi API để xóa HttpOnly Cookie trên Server
    fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include' // Quan trọng: Gửi cookie hiện tại để server xóa
    }).finally(() => {
        // 2. Xóa dữ liệu hiển thị trên Client
        localStorage.removeItem('userRole');
        localStorage.removeItem('currentUsername');
        // 3. Chuyển hướng
        window.location.href = 'login.html';
    });
}

const userRole = checkAuth(); // Kiểm tra ngay khi load trang

// --- 2. Xử lý Tabs ---
function openTab(evt, tabName) {
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
    
    if (tabName === 'Products') fetchProducts();
    if (tabName === 'Tables') fetchTables();
    if (tabName === 'Users') fetchUsers();
}

// --- 3. Xử lý Modal Pop-up (CRUD) ---

function closeModal() {
    modal.style.display = 'none';
    crudForm.reset(); // Xóa dữ liệu form
    crudForm.innerHTML = '';
    currentEntity = '';
    currentMode = '';
    currentId = null;
    document.getElementById('modalMessage').textContent = '';
}

function openModal(entity, mode, data = {}) {
    currentEntity = entity;
    currentMode = mode;
    currentId = data.id || null;

    modalTitle.textContent = `${mode === 'create' ? 'Thêm mới' : 'Chỉnh sửa'} ${entity}`;
    crudForm.innerHTML = generateFormHtml(entity, data);
    
    crudForm.onsubmit = (e) => {
        e.preventDefault();
        handleSubmitCrud();
    };

    modal.style.display = 'block';
}

// Hàm tạo HTML Form động
function generateFormHtml(entity, data) {
    let html = '';
    if (entity === 'product') {
        html = `
            <div class="form-group">
                <label>Tên món:</label><input type="text" name="name" value="${data.name || ''}" required>
            </div>
            <div class="form-group">
                <label>Giá:</label><input type="number" name="price" value="${data.price || ''}" required>
            </div>
            <div class="form-group">
                <label>Quantity:</label><input type="number" name="stock" value="${data.quantity || ''}" required>
            </div>
            <div class="form-group">
                <label>ID Loại (category_id):</label><input type="number" name="category_id" value="${data.category_id || 1}" required>
            </div>
            <div class="form-group">
                <label>Ảnh (Tệp):</label><input type="file" name="image" accept="image/*">
            </div>
            ${data.image_url ? `<p>Ảnh hiện tại: <img src="${data.image_url}" style="width: 50px;"></p>` : ''}
        `;
    } else if (entity === 'table') {
        html = `
            <div class="form-group">
                <label>Tên bàn:</label><input type="text" name="name" value="${data.name || ''}" required>
            </div>
            <div class="form-group">
                <label>Trạng thái:</label>
                <select name="status">
                    ${TABLE_STATUSES.map(s => 
                        `<option value="${s}" ${data.status === s ? 'selected' : ''}>${s}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Ảnh (Tệp):</label><input type="file" name="image" accept="image/*">
            </div>
            ${data.image_url ? `<p>Ảnh hiện tại: <img src="${data.image_url}" style="width: 50px;"></p>` : ''}
        `;
    } else if (entity === 'user') {
        html = `
            <div class="form-group">
                <label>Username:</label><input type="text" name="username" value="${data.username || ''}" required ${currentMode === 'edit' ? 'disabled' : ''}>
            </div>
            <div class="form-group">
                <label>Mật khẩu (${currentMode === 'edit' ? 'Để trống nếu không đổi' : 'Bắt buộc'}):</label><input type="password" name="password" ${currentMode === 'create' ? 'required' : ''}>
            </div>
            <div class="form-group">
                <label>Vai trò:</label>
                <select name="role">
                    ${ALL_ROLES.map(r => 
                        `<option value="${r}" ${data.role === r ? 'selected' : ''}>${r}</option>`
                    ).join('')}
                </select>
            </div>
        `;
    }
    html += `<button type="submit">${currentMode === 'create' ? 'Thêm' : 'Lưu'}</button>`;
    return html;
}

// Hàm gửi dữ liệu CRUD lên API
async function handleSubmitCrud() {
    const messageElement = document.getElementById('modalMessage');
    messageElement.textContent = 'Đang xử lý...';
    
    let url = `${API_BASE_URL}/${currentEntity}s`; 
    let method = currentMode === 'create' ? 'POST' : 'PUT';

    // 1. Chuẩn bị dữ liệu (Sử dụng FormData cho Product/Table vì có upload ảnh)
    let body;
    let headers = {};

    if (currentEntity === 'product' || currentEntity === 'table') {
        // **QUAN TRỌNG:** Sử dụng FormData khi upload file (dùng Multer ở backend)
        body = new FormData(crudForm);

        // Đối với PUT/UPDATE, phải thêm ID vào URL
        if (currentMode === 'edit') url += `/${currentId}`;
        
        // Cần thêm trường Category ID cho Product nếu form chưa có
        if (currentEntity === 'product' && !body.get('category_id')) {
            body.append('category_id', crudForm.elements.category_id.value); 
        }

    } else if (currentEntity === 'user') {
        // User không upload file, dùng JSON
        const formData = new FormData(crudForm);
        body = {};
        formData.forEach((value, key) => {
            if (value !== null && value !== undefined && value !== "") {
                 body[key] = value;
            }});
        
        // Fix cho trường hợp Edit User, không đổi username (đang bị disabled ở form)
        
        if (currentMode === 'edit') {
            url += `/${currentId}`;
            // Nếu không nhập pass, loại bỏ trường password khỏi body
            if (!body.password) delete body.password;
        }
        if (!body.username) {
                delete body.username;
            }

        // Cần JSON header
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
    }
    // --- LOG 8: Yêu cầu CRUD gửi đi ---
    console.log(`[CRUD] REQUEST: Đang gọi ${method} ${url}`);
    // 2. Gọi API
    try {
        const response = await fetch(url, {
            method: method,
            // Header Content-Type không cần cho FormData, cần cho JSON
            ...(currentEntity === 'user' ? { headers } : {}), 
            // **QUAN TRỌNG:** Phải thêm credentials: 'include'
            credentials: 'include', 
            body: body
        });
// --- LOG 9: Trạng thái CRUD phản hồi ---
        console.log(`[CRUD] RESPONSE: Trạng thái HTTP:`, response.status);
        if (response.status === 401 || response.status === 403) {
             // 401 Unauthorized hoặc 403 Forbidden (hết hạn cookie hoặc không có quyền)
            throw new Error('Phiên hết hạn hoặc bạn không có quyền thực hiện thao tác này.');
        }

        const result = await response.json();

        if (response.ok) {
            messageElement.textContent = `${currentEntity} đã được ${currentMode === 'create' ? 'thêm' : 'cập nhật'} thành công!`;
            
            // Tải lại dữ liệu
            if (currentEntity === 'product') fetchProducts();
            if (currentEntity === 'table') fetchTables();
            if (currentEntity === 'user') fetchUsers();

            setTimeout(closeModal, 1500); 
        } else {
            messageElement.textContent = result.error || result.message || `Lỗi khi ${currentMode} ${currentEntity}.`;
        }

    } catch (error) {
        console.error('Lỗi gọi API:', error);
        if (error.message.includes('Phiên hết hạn')) {
             alert(error.message);
             logout();
        }
        messageElement.textContent = `Lỗi: ${error.message}`;
    }
}


// --- 4. Xử lý GET và Hiển thị Dữ liệu ---

async function fetchData(entity) {
    const statusElement = document.getElementById(`${entity}sStatus`);
    statusElement.textContent = 'Đang tải dữ liệu...';

    try {
        // --- LOG 5: Yêu cầu gửi đi ---
        console.log(`[${entity.toUpperCase()}] REQUEST: Đang gọi GET /api/${entity}s`);
        console.log(`[${entity.toUpperCase()}] REQUEST: Đang gửi credentials (HttpOnly Cookie)`);
        const response = await fetch(`${API_BASE_URL}/${entity}s`, {
            method: 'GET',
            credentials: 'include' // Gửi Cookie
        });
        console.log(`[${entity.toUpperCase()}] RESPONSE: Trạng thái HTTP:`, response.status);

        if (response.status === 401 || response.status === 403) {
            throw new Error('Bạn không có quyền hoặc phiên đăng nhập đã hết hạn.');
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Lỗi khi tải danh sách ${entity}.`);
        }

        const data = await response.json();
        statusElement.textContent = '';
        return data;

    } catch (error) {
        console.error(`Lỗi tải ${entity}:`, error);
        statusElement.textContent = `Lỗi: ${error.message}`;
        if (error.message.includes('hết hạn')) logout();
        return [];
    }
}

// Products
async function fetchProducts() {
    const products = await fetchData('product');
    renderProductTable(products);
}

function renderProductTable(products) {
    const tableBody = document.querySelector('#productsTable tbody');
    tableBody.innerHTML = '';
    products.forEach(p => {
        const row = tableBody.insertRow();
        const dataForModal = {
            id: p.id,
            name: p.name,
            price: p.price,
            quantity: p.quantity,
            image_url: p.image_url, // URL ảnh hiện tại
            category_id: p.category_id 
        };
        row.innerHTML = `
            <td>${p.id}</td>
            <td>${p.name}</td>
            <td>${p.price.toLocaleString('vi-VN')} VNĐ</td>
            <td>${p.quantity}</td>
            <td>${p.image_url ? `<img src="${p.image_url}" alt="Ảnh" style="width: 50px;">` : 'N/A'}</td>
            <td>
                <button onclick="openModal('product', 'edit', ${JSON.stringify(dataForModal).replace(/"/g, '&quot;')})">Sửa</button>
                <button onclick="handleDelete('product', ${p.id})" style="background-color: #f44336; border: none; color: white;">Xóa</button>
            </td>
        `;
    });
}

// Tables
async function fetchTables() {
    const tables = await fetchData('table');
    renderTableTable(tables);
}

function renderTableTable(tables) {
    const tableBody = document.querySelector('#tablesTable tbody');
    tableBody.innerHTML = '';
    tables.forEach(t => {
        const row = tableBody.insertRow();
        const dataForModal = {
            id: t.id,
            name: t.name,
            status: t.status,
            image: t.image // URL ảnh hiện tại
        };
        row.innerHTML = `
            <td>${t.id}</td>
            <td>${t.name}</td>
            <td>${t.status}</td>
            <td>${t.image ? `<img src="${t.image}" alt="Ảnh" style="width: 50px;">` : 'N/A'}</td>
            <td>
                <button onclick="openModal('table', 'edit', ${JSON.stringify(dataForModal).replace(/"/g, '&quot;')})">Sửa</button>
                <button onclick="handleDelete('table', ${t.id})" style="background-color: #f44336; border: none; color: white;">Xóa</button>
            </td>
        `;
    });
}

// Users
async function fetchUsers() {
    const users = await fetchData('user');
    renderUserTable(users);
}

function renderUserTable(users) {
    const tableBody = document.querySelector('#usersTable tbody');
    tableBody.innerHTML = '';
    users.forEach(u => {
        const row = tableBody.insertRow();
        const dataForModal = {
            id: u.id,
            username: u.username,
            role: u.role
        };
        row.innerHTML = `
            <td>${u.id}</td>
            <td>${u.username}</td>
            <td>${u.role}</td>
            <td>
                <button onclick="openModal('user', 'edit', ${JSON.stringify(dataForModal).replace(/"/g, '&quot;')})">Sửa</button>
                <button onclick="handleDelete('user', ${u.id})" style="background-color: #f44336; border: none; color: white;">Xóa</button>
            </td>
        `;
    });
}


// --- 5. Xử lý Xóa ---
async function handleDelete(entity, id) {
    if (!confirm(`Bạn có chắc chắn muốn xóa ${entity} ID ${id} này không? Thao tác này không thể hoàn tác.`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/${entity}s/${id}`, {
            method: 'DELETE',
            credentials: 'include' // Gửi Cookie
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error('Bạn không có quyền hoặc phiên đăng nhập đã hết hạn.');
        }

        if (response.ok) {
            alert(`${entity} đã xóa thành công!`);
            // Tải lại dữ liệu
            if (entity === 'product') fetchProducts();
            if (entity === 'table') fetchTables();
            if (entity === 'user') fetchUsers();
        } else {
            const result = await response.json();
            alert(result.error || 'Lỗi khi xóa.');
        }

    } catch (error) {
        console.error('Lỗi xóa:', error);
        alert(`Lỗi: ${error.message}`);
        if (error.message.includes('hết hạn')) logout();
    }
}


// Khởi tạo: Mở tab Products ngay khi tải trang
document.addEventListener('DOMContentLoaded', () => {
    // Chỉ chạy logic tab nếu đã có role
    if (userRole) {
        document.querySelector('.tab-button.active').click(); 
    }
});