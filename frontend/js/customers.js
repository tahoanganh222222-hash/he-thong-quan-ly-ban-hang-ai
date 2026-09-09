/* ================================

   CUSTOMER MANAGEMENT

   ================================ */

let customers = [];

let currentCustomerPage = 1;
const customerPageSize = 7;
let editingCustomerId = null;
let customerEventsInitialized = false;

async function loadCustomersFromAPI() {

    try {
        customers = await window.salesApi.customers.list();
    } catch (error) {
        customers = [];
        console.error("Không thể tải danh sách khách hàng:", error);
        alert("Không thể tải dữ liệu khách hàng từ máy chủ.");
    }
}


/* ================================

   FORMAT

   ================================ */

function escapeCustomerHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ================================

   FILTER

   ================================ */

function getFilteredCustomers() {

    const searchInput = document.getElementById(
        "customer-search-input"
    );

    const statusFilter = document.getElementById(
        "customer-status-filter"
    );

    const keyword = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    const status = statusFilter
        ? statusFilter.value
        : "all";

    return customers.filter(customer => {

        const matchesKeyword =
            customer.code.toLowerCase().includes(keyword) ||
            customer.name.toLowerCase().includes(keyword) ||
            customer.phone.toLowerCase().includes(keyword);

        let matchesStatus = true;

        if (status === "active") {
            matchesStatus = customer.isActive;
        }

        if (status === "inactive") {
            matchesStatus = !customer.isActive;
        }

        return matchesKeyword && matchesStatus;
    });
}


/* ================================

   RENDER TABLE

   ================================ */

function renderCustomers() {

    const tableBody = document.getElementById(
        "customer-table-body"
    );

    const countElement = document.getElementById(
        "customer-count"
    );

    if (!tableBody || !countElement) {
        return;
    }

    const filteredCustomers = getFilteredCustomers();

    countElement.textContent =
        `${filteredCustomers.length} khách hàng`;

    const totalPages = Math.max(
        1,
        Math.ceil(
            filteredCustomers.length / customerPageSize
        )
    );

    if (currentCustomerPage > totalPages) {
        currentCustomerPage = totalPages;
    }

    const startIndex =
        (currentCustomerPage - 1) * customerPageSize;

    const pageCustomers = filteredCustomers.slice(
        startIndex,
        startIndex + customerPageSize
    );

    if (pageCustomers.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="customer-empty">
                        Không tìm thấy khách hàng phù hợp.
                    </div>
                </td>
            </tr>
        `;

        renderCustomerPagination(0, 0);
        return;
    }

    tableBody.innerHTML = pageCustomers.map(
        (customer, index) => `
            <tr>
                <td>${startIndex + index + 1}</td>

                <td>
                    <span class="customer-code">
                        ${escapeCustomerHtml(customer.code)}
                    </span>
                </td>

                <td>
                    <span class="customer-name">
                        ${escapeCustomerHtml(customer.name)}
                    </span>
                </td>

                <td class="customer-phone">
                    ${escapeCustomerHtml(customer.phone || "-")}
                </td>

                <td>
                    ${escapeCustomerHtml(customer.email || "-")}
                </td>

                <td>
                    ${escapeCustomerHtml(customer.address || "-")}
                </td>

                <td>
                    <span class="customer-group">
                        ${escapeCustomerHtml(
                            customer.customerGroup || "Khách thường"
                        )}
                    </span>
                </td>

                <td>
                    <span class="customer-status ${
                        customer.isActive
                            ? "active"
                            : "inactive"
                    }">
                        ${
                            customer.isActive
                                ? "Đang hoạt động"
                                : "Ngừng hoạt động"
                        }
                    </span>
                </td>

                <td>
                    <div class="customer-actions">

                        <button
                            class="customer-action-button customer-edit-button"
                            onclick="editCustomer(${customer.id})"
                        >
                            Sửa
                        </button>

                        <button
                            class="customer-action-button customer-toggle-button"
                            onclick="toggleCustomerStatus(${customer.id})"
                        >
                            ${
                                customer.isActive
                                    ? "Khóa"
                                    : "Mở khóa"
                            }
                        </button>

                    </div>
                </td>
            </tr>
        `
    );

    renderCustomerPagination(
        filteredCustomers.length,
        totalPages
    );
}


/* ================================

   PAGINATION

   ================================ */

function renderCustomerPagination(
    totalItems,
    totalPages
) {

    const info = document.getElementById(
        "customer-pagination-info"
    );

    const buttons = document.getElementById(
        "customer-pagination-buttons"
    );

    if (!info || !buttons) {
        return;
    }

    if (totalItems === 0) {
        info.textContent = "Không có khách hàng";
        buttons.innerHTML = "";
        return;
    }

    const start =
        (currentCustomerPage - 1) * customerPageSize + 1;

    const end = Math.min(
        currentCustomerPage * customerPageSize,
        totalItems
    );

    info.textContent =
        `Hiển thị ${start}-${end} trên ${totalItems} khách hàng`;

    let html = "";

    html += `
        <button
            class="customer-page-button"
            onclick="changeCustomerPage(${currentCustomerPage - 1})"
            ${currentCustomerPage === 1 ? "disabled" : ""}
        >
            ‹
        </button>
    `;

    for (let page = 1; page <= totalPages; page++) {

        html += `
            <button
                class="customer-page-button ${
                    page === currentCustomerPage
                        ? "active"
                        : ""
                }"
                onclick="changeCustomerPage(${page})"
            >
                ${page}
            </button>
        `;
    }

    html += `
        <button
            class="customer-page-button"
            onclick="changeCustomerPage(${currentCustomerPage + 1})"
            ${
                currentCustomerPage === totalPages
                    ? "disabled"
                    : ""
            }
        >
            ›
        </button>
    `;

    buttons.innerHTML = html;
}

function changeCustomerPage(page) {

    const filteredCustomers = getFilteredCustomers();

    const totalPages = Math.max(
        1,
        Math.ceil(
            filteredCustomers.length / customerPageSize
        )
    );

    if (page < 1 || page > totalPages) {
        return;
    }

    currentCustomerPage = page;
    renderCustomers();
}


/* ================================

   MODAL

   ================================ */

function openAddCustomerModal() {

    // KIỂM TRA PHÂN QUYỀN
    if (
        typeof requirePermission === "function" &&
        !requirePermission("customer_manage")
    ) {
        return;
    }

    editingCustomerId = null;

    const modal = document.getElementById(
        "customer-modal"
    );

    const title = document.getElementById(
        "customer-modal-title"
    );

    const form = document.getElementById(
        "customer-form"
    );

    if (!modal || !title || !form) {
        return;
    }

    title.textContent = "Thêm khách hàng";

    form.reset();

    document.getElementById(
        "customer-code"
    ).value = generateCustomerCode();

    modal.classList.add("active");
}

function editCustomer(id) {

    // KIỂM TRA PHÂN QUYỀN
    if (
        typeof requirePermission === "function" &&
        !requirePermission("customer_manage")
    ) {
        return;
    }

    const customer = customers.find(
        item => item.id === id
    );

    if (!customer) {
        return;
    }

    editingCustomerId = id;

    const modal = document.getElementById(
        "customer-modal"
    );

    const title = document.getElementById(
        "customer-modal-title"
    );

    if (!modal || !title) {
        return;
    }

    title.textContent = "Chỉnh sửa khách hàng";

    document.getElementById("customer-code").value =
        customer.code;

    document.getElementById("customer-name").value =
        customer.name;

    document.getElementById("customer-phone").value =
        customer.phone;

    document.getElementById("customer-email").value =
        customer.email;

    document.getElementById("customer-address").value =
        customer.address;

    document.getElementById("customer-group").value =
        customer.customerGroup;

    modal.classList.add("active");
}

function closeCustomerModal() {

    const modal = document.getElementById(
        "customer-modal"
    );

    if (modal) {
        modal.classList.remove("active");
    }

    editingCustomerId = null;
}

function generateCustomerCode() {

    let maxNumber = 0;

    customers.forEach(customer => {

        const match = customer.code.match(
            /^KH(\d+)$/
        );

        if (match) {

            maxNumber = Math.max(
                maxNumber,
                Number(match[1])
            );
        }
    });

    return `KH${String(maxNumber + 1).padStart(3, "0")}`;
}


/* ================================

   SAVE

   ================================ */

async function saveCustomer(event) {

    event.preventDefault();

    // KIỂM TRA PHÂN QUYỀN
    if (
        typeof requirePermission === "function" &&
        !requirePermission("customer_manage")
    ) {
        return;
    }

    const code = document.getElementById(
        "customer-code"
    ).value.trim();

    const name = document.getElementById(
        "customer-name"
    ).value.trim();

    const phone = document.getElementById(
        "customer-phone"
    ).value.trim();

    const email = document.getElementById(
        "customer-email"
    ).value.trim();

    const address = document.getElementById(
        "customer-address"
    ).value.trim();

    const customerGroup = document.getElementById(
        "customer-group"
    ).value;

    if (!code || !name || !phone) {

        alert(
            "Vui lòng nhập đầy đủ mã, tên và số điện thoại khách hàng."
        );

        return;
    }

    const phoneRegex = /^[0-9]{9,11}$/;

    if (!phoneRegex.test(phone)) {

        alert(
            "Số điện thoại phải gồm từ 9 đến 11 chữ số."
        );

        return;
    }

    if (email) {

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {

            alert("Email không hợp lệ.");

            return;
        }
    }

    const duplicateCode = customers.some(
        customer =>
            customer.code.toLowerCase() ===
                code.toLowerCase() &&
            customer.id !== editingCustomerId
    );

    if (duplicateCode) {

        alert("Mã khách hàng đã tồn tại.");

        return;
    }

    if (editingCustomerId === null) {

        try {
            const createdCustomer = await window.salesApi.customers.create({
                code,
                name,
                phone,
                email,
                address,
                customerGroup,
                isActive: true
            });
            customers.push(createdCustomer);
        } catch (error) {
            alert(error.message || "Không thể thêm khách hàng.");
            return;
        }

        alert("Thêm khách hàng thành công.");

    } else {

        const customer = customers.find(
            item => item.id === editingCustomerId
        );

        if (!customer) {
            return;
        }

        try {
            const updatedCustomer = await window.salesApi.customers.update(
                editingCustomerId,
                { code, name, phone, email, address, customerGroup }
            );
            customers = customers.map(item =>
                item.id === editingCustomerId ? updatedCustomer : item
            );
        } catch (error) {
            alert(error.message || "Không thể cập nhật khách hàng.");
            return;
        }

        alert("Cập nhật khách hàng thành công.");
    }

    closeCustomerModal();

    currentCustomerPage = 1;

    renderCustomers();
}


/* ================================

   STATUS

   ================================ */

async function toggleCustomerStatus(id) {

    // KIỂM TRA PHÂN QUYỀN
    if (
        typeof requirePermission === "function" &&
        !requirePermission("customer_manage")
    ) {
        return;
    }

    const customer = customers.find(
        item => item.id === id
    );

    if (!customer) {
        return;
    }

    const action = customer.isActive
        ? "khóa"
        : "mở khóa";

    const confirmed = confirm(
        `Bạn có chắc muốn ${action} khách hàng "${customer.name}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const updatedCustomer = await window.salesApi.customers.update(
            id,
            { isActive: !customer.isActive }
        );
        customers = customers.map(item =>
            item.id === id ? updatedCustomer : item
        );
    } catch (error) {
        alert(error.message || "Không thể cập nhật trạng thái khách hàng.");
        return;
    }

    renderCustomers();
}


/* ================================

   FILTER EVENTS

   ================================ */

function setupCustomerFilters() {

    const searchInput = document.getElementById(
        "customer-search-input"
    );

    const statusFilter = document.getElementById(
        "customer-status-filter"
    );

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function () {

                currentCustomerPage = 1;

                renderCustomers();
            }
        );
    }

    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            function () {

                currentCustomerPage = 1;

                renderCustomers();
            }
        );
    }
}


/* ================================

   MODAL EVENTS

   ================================ */

function setupCustomerModal() {

    const addButton = document.getElementById(
        "add-customer-button"
    );

    const closeButton = document.getElementById(
        "customer-modal-close"
    );

    const cancelButton = document.getElementById(
        "customer-cancel-button"
    );

    const form = document.getElementById(
        "customer-form"
    );

    const modal = document.getElementById(
        "customer-modal"
    );

    if (addButton) {

        addButton.addEventListener(
            "click",
            openAddCustomerModal
        );
    }

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeCustomerModal
        );
    }

    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            closeCustomerModal
        );
    }

    if (form) {

        form.addEventListener(
            "submit",
            saveCustomer
        );
    }

    if (modal) {

        modal.addEventListener(
            "click",
            function (event) {

                if (event.target === modal) {
                    closeCustomerModal();
                }
            }
        );
    }
}


/* ================================

   INIT

   ================================ */

async function initCustomerManagement() {

    // KIỂM TRA PHÂN QUYỀN
    if (
        typeof requirePermission === "function" &&
        !requirePermission("customer_manage")
    ) {
        return;
    }

    await loadCustomersFromAPI();

    currentCustomerPage = 1;

    if (!customerEventsInitialized) {
        setupCustomerFilters();
        setupCustomerModal();
        customerEventsInitialized = true;
    }

    renderCustomers();
}
