/* ================================

   CUSTOMER MANAGEMENT

   ================================ */

let customers = [];

let currentCustomerPage = 1;
const customerPageSize = 7;
let editingCustomerId = null;
let customerEventsInitialized = false;
let customerHistoryRequestId = 0;

async function loadCustomersFromAPI() {

    try {
        customers = await window.salesApi.customers.list();
    } catch (error) {
        customers = [];
        console.error("Không thể tải danh sách khách hàng:", error);
        if (error.status === 401) return;
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
                    <button
                        type="button"
                        class="customer-name customer-name-button"
                        onclick="openCustomerPurchaseHistory(${customer.id})"
                        title="Xem hóa đơn của khách hàng"
                    >
                        ${escapeCustomerHtml(customer.name)}
                    </button>
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
                            class="customer-action-button customer-history-button"
                            onclick="openCustomerPurchaseHistory(${customer.id})"
                        >
                            Lịch sử mua
                        </button>

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

                        <button
                            class="customer-action-button customer-delete-button"
                            onclick="deleteCustomer(${customer.id})"
                        >
                            Xóa
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


function formatCustomerHistoryMoney(value) {
    return `${Number(value || 0).toLocaleString("vi-VN")} ₫`;
}


function formatCustomerHistoryDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeCustomerHtml(value);
    return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


function formatCustomerPaymentMethod(value) {
    const methods = {
        cash: "Tiền mặt",
        transfer: "Chuyển khoản",
        bank_transfer: "Chuyển khoản",
        card: "Thẻ ngân hàng"
    };
    return methods[value] || value || "Chưa ghi nhận";
}


function renderCustomerPurchaseHistory(data) {
    const content = document.getElementById("customer-history-content");
    if (!content) return;

    const summary = data?.summary || {};
    const invoices = Array.isArray(data?.invoices) ? data.invoices : [];

    content.innerHTML = `
        <div class="customer-history-summary">
            <article>
                <span>Hóa đơn</span>
                <strong>${Number(summary.invoiceCount || 0).toLocaleString("vi-VN")}</strong>
            </article>
            <article>
                <span>Tổng chi tiêu</span>
                <strong>${formatCustomerHistoryMoney(summary.totalSpent)}</strong>
            </article>
            <article>
                <span>Sản phẩm đã mua</span>
                <strong>${Number(summary.totalItems || 0).toLocaleString("vi-VN")}</strong>
            </article>
            <article>
                <span>Lần mua gần nhất</span>
                <strong>${summary.lastPurchaseAt ? formatCustomerHistoryDate(summary.lastPurchaseAt) : "Chưa có"}</strong>
            </article>
        </div>

        ${invoices.length ? `
            <div class="customer-history-list">
                ${invoices.map((invoice, index) => `
                    <details class="customer-history-invoice" ${index === 0 ? "open" : ""}>
                        <summary>
                            <span class="customer-history-invoice-main">
                                <strong>${escapeCustomerHtml(invoice.invoiceCode || invoice.code)}</strong>
                                <small>${formatCustomerHistoryDate(invoice.createdAt || invoice.date)}</small>
                            </span>
                            <span class="customer-history-invoice-meta">
                                <small>${(invoice.items || []).length} mặt hàng</small>
                                <strong>${formatCustomerHistoryMoney(invoice.finalAmount)}</strong>
                            </span>
                        </summary>
                        <div class="customer-history-invoice-body">
                            <div class="customer-history-payment">
                                <span>Thanh toán: <strong>${escapeCustomerHtml(formatCustomerPaymentMethod(invoice.paymentMethod))}</strong></span>
                                <span>Giảm giá: <strong>${formatCustomerHistoryMoney(invoice.discount)}</strong></span>
                            </div>
                            <div class="customer-history-items-wrap">
                                <table class="customer-history-items">
                                    <thead>
                                        <tr>
                                            <th>Sản phẩm</th>
                                            <th>Số lượng</th>
                                            <th>Đơn giá</th>
                                            <th>Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(invoice.items || []).map(item => `
                                            <tr>
                                                <td>${escapeCustomerHtml(item.productName || "Sản phẩm")}</td>
                                                <td>${Number(item.quantity || 0).toLocaleString("vi-VN")}</td>
                                                <td>${formatCustomerHistoryMoney(item.unitPrice)}</td>
                                                <td>${formatCustomerHistoryMoney(item.amount)}</td>
                                            </tr>
                                        `).join("") || `
                                            <tr>
                                                <td colspan="4" class="customer-history-no-items">Hóa đơn chưa có chi tiết sản phẩm.</td>
                                            </tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </details>
                `).join("")}
            </div>
        ` : `
            <div class="customer-history-empty">
                <span>⌁</span>
                <strong>Khách hàng chưa có hóa đơn</strong>
                <p>Các sản phẩm đã mua sẽ xuất hiện tại đây sau khi lập hóa đơn cho khách hàng.</p>
            </div>
        `}
    `;
}


async function openCustomerPurchaseHistory(id) {
    const customer = customers.find(item => item.id === id);
    const modal = document.getElementById("customer-history-modal");
    const title = document.getElementById("customer-history-title");
    const subtitle = document.getElementById("customer-history-subtitle");
    const content = document.getElementById("customer-history-content");
    if (!customer || !modal || !title || !subtitle || !content) return;

    const requestId = ++customerHistoryRequestId;
    title.textContent = customer.name;
    subtitle.textContent = `${customer.code} · ${customer.phone || "Chưa có số điện thoại"}`;
    content.innerHTML = `
        <div class="customer-history-loading">
            <span></span>
            <p>Đang tải lịch sử mua hàng...</p>
        </div>
    `;
    modal.classList.add("active");

    try {
        const history = await window.salesApi.customers.purchaseHistory(id);
        if (requestId !== customerHistoryRequestId) return;
        renderCustomerPurchaseHistory(history);
    } catch (error) {
        if (requestId !== customerHistoryRequestId) return;
        content.innerHTML = `
            <div class="customer-history-error">
                <strong>Không thể tải lịch sử mua hàng</strong>
                <p>${escapeCustomerHtml(error.message || "Vui lòng thử lại sau.")}</p>
                <button type="button" onclick="openCustomerPurchaseHistory(${id})">Thử lại</button>
            </div>
        `;
    }
}


function closeCustomerPurchaseHistory() {
    customerHistoryRequestId += 1;
    document.getElementById("customer-history-modal")?.classList.remove("active");
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


async function deleteCustomer(id) {
    if (
        typeof requirePermission === "function" &&
        !requirePermission("customer_manage")
    ) {
        return;
    }
    const customer = customers.find(item => item.id === id);
    if (!customer) return;
    const confirmed = confirm(
        `Xóa vĩnh viễn khách hàng "${customer.name}"? Khách hàng đã có hóa đơn sẽ không thể xóa.`
    );
    if (!confirmed) return;
    try {
        await window.salesApi.customers.remove(id);
        customers = customers.filter(item => item.id !== id);
        renderCustomers();
        alert("Đã xóa khách hàng.");
    } catch (error) {
        alert(error.message || "Không thể xóa khách hàng.");
    }
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

    const historyModal = document.getElementById(
        "customer-history-modal"
    );

    const historyCloseButton = document.getElementById(
        "customer-history-modal-close"
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

    if (historyCloseButton) {
        historyCloseButton.addEventListener(
            "click",
            closeCustomerPurchaseHistory
        );
    }

    if (historyModal) {
        historyModal.addEventListener(
            "click",
            function (event) {
                if (event.target === historyModal) {
                    closeCustomerPurchaseHistory();
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
