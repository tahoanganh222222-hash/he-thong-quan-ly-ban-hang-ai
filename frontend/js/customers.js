/* ================================

   CUSTOMER MANAGEMENT

   ================================ */

let customers = [];

let currentCustomerPage = 1;
const customerPageSize = 8;
let editingCustomerId = null;
let customerEventsInitialized = false;
let customerHistoryRequestId = 0;
let selectedCustomerId = null;
const customerDetailCache = new Map();
const customerDetailLoading = new Set();

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

    const groupFilter = document.getElementById(
        "customer-group-filter"
    );

    const keyword = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    const status = statusFilter
        ? statusFilter.value
        : "all";

    const group = groupFilter
        ? groupFilter.value
        : "all";

    return customers.filter(customer => {

        const matchesKeyword =
            customer.code.toLowerCase().includes(keyword) ||
            customer.name.toLowerCase().includes(keyword) ||
            String(customer.phone || "").toLowerCase().includes(keyword) ||
            String(customer.email || "").toLowerCase().includes(keyword) ||
            String(customer.address || "").toLowerCase().includes(keyword);

        let matchesStatus = true;

        if (status === "active") {
            matchesStatus = customer.isActive;
        }

        if (status === "inactive") {
            matchesStatus = !customer.isActive;
        }

        const matchesGroup =
            group === "all" ||
            (customer.customerGroup || "Khách thường") === group;

        return matchesKeyword && matchesStatus && matchesGroup;
    });
}


function getCustomerInitials(name) {
    const words = String(name || "KH")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!words.length) return "KH";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}


function renderCustomerStats() {
    const total = customers.length;
    const active = customers.filter(customer => customer.isActive).length;
    const loyal = customers.filter(customer => {
        const group = customer.customerGroup || "Khách thường";
        return group === "Khách thân thiết" || group === "Khách VIP";
    }).length;
    const inactive = total - active;
    const activeRate = total ? Math.round((active / total) * 100) : 0;

    const values = {
        "customer-stat-total": total,
        "customer-stat-active": active,
        "customer-stat-loyal": loyal,
        "customer-stat-inactive": inactive
    };
    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = Number(value).toLocaleString("vi-VN");
    });
    const rateElement = document.getElementById("customer-stat-active-rate");
    if (rateElement) rateElement.textContent = `${activeRate}% tổng khách hàng`;
}


function selectCustomer(id) {
    selectedCustomerId = Number(id);
    renderCustomers();
}


async function loadCustomerDetailSummary(customerId) {
    if (customerDetailCache.has(customerId) || customerDetailLoading.has(customerId)) return;
    customerDetailLoading.add(customerId);
    try {
        const history = await window.salesApi.customers.purchaseHistory(customerId);
        customerDetailCache.set(customerId, history?.summary || {});
    } catch (error) {
        customerDetailCache.set(customerId, { error: error.message || "Không thể tải thống kê." });
    } finally {
        customerDetailLoading.delete(customerId);
        if (selectedCustomerId === customerId) {
            renderCustomerDetail(customers.find(customer => customer.id === customerId));
        }
    }
}


function renderCustomerDetail(customer) {
    const panel = document.getElementById("customer-detail-panel");
    if (!panel) return;

    if (!customer) {
        panel.innerHTML = `
            <div class="customer-detail-empty">
                <span aria-hidden="true">◎</span>
                <strong>Không có khách hàng phù hợp</strong>
                <p>Thay đổi điều kiện tìm kiếm hoặc thêm khách hàng mới.</p>
            </div>
        `;
        return;
    }

    const summary = customerDetailCache.get(customer.id);
    const isLoading = !summary || customerDetailLoading.has(customer.id);
    const statusText = customer.isActive ? "Đang hoạt động" : "Ngừng hoạt động";

    panel.innerHTML = `
        <header class="customer-detail-header">
            <div>
                <span>THÔNG TIN KHÁCH HÀNG</span>
                <h3>Hồ sơ chi tiết</h3>
            </div>
            <button type="button" onclick="openCustomerPurchaseHistory(${customer.id})" title="Xem toàn bộ lịch sử mua">↗</button>
        </header>

        <div class="customer-detail-identity">
            <span class="customer-detail-avatar">${escapeCustomerHtml(getCustomerInitials(customer.name))}</span>
            <div>
                <strong>${escapeCustomerHtml(customer.name)}</strong>
                <small>${escapeCustomerHtml(customer.code)}</small>
            </div>
            <span class="customer-status ${customer.isActive ? "active" : "inactive"}">${statusText}</span>
        </div>

        <div class="customer-detail-tabs">
            <button type="button" class="active">Thông tin</button>
            <button type="button" onclick="openCustomerPurchaseHistory(${customer.id})">Lịch sử mua hàng</button>
        </div>

        <div class="customer-detail-section">
            <h4>Thông tin liên hệ</h4>
            <dl class="customer-detail-list">
                <div><dt>Số điện thoại</dt><dd>${escapeCustomerHtml(customer.phone || "Chưa cập nhật")}</dd></div>
                <div><dt>Email</dt><dd>${escapeCustomerHtml(customer.email || "Chưa cập nhật")}</dd></div>
                <div><dt>Địa chỉ</dt><dd>${escapeCustomerHtml(customer.address || "Chưa cập nhật")}</dd></div>
            </dl>
        </div>

        <div class="customer-detail-section">
            <h4>Nhóm khách hàng</h4>
            <span class="customer-group">${escapeCustomerHtml(customer.customerGroup || "Khách thường")}</span>
        </div>

        <div class="customer-detail-section customer-detail-stat-section">
            <div class="customer-detail-section-heading">
                <h4>Thống kê mua hàng</h4>
                ${isLoading ? '<span class="customer-detail-loading">Đang tải...</span>' : ""}
            </div>
            ${summary?.error ? `
                <p class="customer-detail-error">${escapeCustomerHtml(summary.error)}</p>
            ` : `
                <div class="customer-detail-stats">
                    <article><strong>${isLoading ? "—" : Number(summary?.invoiceCount || 0).toLocaleString("vi-VN")}</strong><span>Hóa đơn</span></article>
                    <article><strong>${isLoading ? "—" : formatCustomerHistoryMoney(summary?.totalSpent)}</strong><span>Tổng chi tiêu</span></article>
                    <article><strong>${isLoading ? "—" : Number(summary?.totalItems || 0).toLocaleString("vi-VN")}</strong><span>Sản phẩm</span></article>
                </div>
                <p class="customer-detail-last-purchase">Lần mua gần nhất: <strong>${isLoading ? "Đang tải" : (summary?.lastPurchaseAt ? formatCustomerHistoryDate(summary.lastPurchaseAt) : "Chưa có")}</strong></p>
            `}
        </div>

        <footer class="customer-detail-actions">
            <button type="button" class="is-primary" onclick="editCustomer(${customer.id})">Chỉnh sửa</button>
            <button type="button" onclick="openCustomerPurchaseHistory(${customer.id})">Lịch sử mua</button>
            <button type="button" class="${customer.isActive ? "is-warning" : "is-success"}" onclick="toggleCustomerStatus(${customer.id})">${customer.isActive ? "Ngừng hoạt động" : "Mở hoạt động"}</button>
            <button type="button" class="is-danger" onclick="deleteCustomer(${customer.id})">Xóa</button>
        </footer>
    `;

    if (!summary) loadCustomerDetailSummary(customer.id);
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

    renderCustomerStats();

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

    if (pageCustomers.length && !pageCustomers.some(customer => customer.id === selectedCustomerId)) {
        selectedCustomerId = pageCustomers[0].id;
    }

    if (pageCustomers.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="customer-empty">
                        Không tìm thấy khách hàng phù hợp.
                    </div>
                </td>
            </tr>
        `;

        renderCustomerPagination(0, 0);
        renderCustomerDetail(null);
        return;
    }

    tableBody.innerHTML = pageCustomers.map(
        customer => `
            <tr class="${customer.id === selectedCustomerId ? "selected" : ""}" onclick="selectCustomer(${customer.id})">
                <td>
                    <div class="customer-table-identity">
                        <span class="customer-table-avatar">${escapeCustomerHtml(getCustomerInitials(customer.name))}</span>
                        <div>
                    <button
                        type="button"
                        class="customer-name customer-name-button"
                                onclick="event.stopPropagation(); selectCustomer(${customer.id})"
                                title="Xem thông tin khách hàng"
                    >
                        ${escapeCustomerHtml(customer.name)}
                    </button>
                            <small>${escapeCustomerHtml(customer.code)}</small>
                        </div>
                    </div>
                </td>

                <td>
                    <div class="customer-table-contact">
                        <strong>${escapeCustomerHtml(customer.phone || "-")}</strong>
                        <small>${escapeCustomerHtml(customer.email || "Chưa có email")}</small>
                    </div>
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
                            type="button"
                            class="customer-action-button customer-view-button"
                            onclick="event.stopPropagation(); selectCustomer(${customer.id})"
                        >
                            Chi tiết
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
    renderCustomerDetail(
        customers.find(customer => customer.id === selectedCustomerId)
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
    const invoiceCount = Number(summary.invoiceCount || 0);
    const totalSpent = Number(summary.totalSpent || 0);
    const averageSpent = invoiceCount ? totalSpent / invoiceCount : 0;

    const lastPurchase = document.getElementById("customer-history-last-purchase");
    const lifetimeSpend = document.getElementById("customer-history-lifetime-spend");
    if (lastPurchase) {
        lastPurchase.textContent = summary.lastPurchaseAt
            ? formatCustomerHistoryDate(summary.lastPurchaseAt)
            : "Chưa có";
    }
    if (lifetimeSpend) {
        lifetimeSpend.textContent = invoiceCount
            ? `Tổng chi tiêu ${formatCustomerHistoryMoney(totalSpent)}`
            : "Chưa ghi nhận chi tiêu";
    }

    content.innerHTML = `
        <div class="customer-history-summary">
            <article>
                <i class="customer-history-summary-icon is-blue" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 2.8v3M16 2.8v3M5 8.5h14M9 12h6M9 15.5h4"/></svg>
                </i>
                <div><span>Tổng hóa đơn</span>
                <strong>${invoiceCount.toLocaleString("vi-VN")}</strong>
                <small>Hóa đơn mua hàng</small></div>
            </article>
            <article>
                <i class="customer-history-summary-icon is-green" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M4.5 7.5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-10Z"/><path d="m5 7 10-3v3.5M15 12h5v4h-5a2 2 0 1 1 0-4Z"/></svg>
                </i>
                <div><span>Tổng chi tiêu</span>
                <strong>${formatCustomerHistoryMoney(totalSpent)}</strong>
                <small>Giá trị đã thanh toán</small></div>
            </article>
            <article>
                <i class="customer-history-summary-icon is-purple" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v8.5"/></svg>
                </i>
                <div><span>Sản phẩm đã mua</span>
                <strong>${Number(summary.totalItems || 0).toLocaleString("vi-VN")}</strong>
                <small>Tổng số lượng sản phẩm</small></div>
            </article>
            <article>
                <i class="customer-history-summary-icon is-orange" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>
                </i>
                <div><span>Chi tiêu trung bình</span>
                <strong>${formatCustomerHistoryMoney(averageSpent)}</strong>
                <small>Trung bình mỗi hóa đơn</small></div>
            </article>
        </div>

        ${invoices.length ? `
            <div class="customer-history-list">
                ${invoices.map((invoice, index) => `
                    <details class="customer-history-invoice" ${index === 0 ? "open" : ""}>
                        <summary>
                            <span class="customer-history-invoice-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none"><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3v-17Z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>
                            </span>
                            <span class="customer-history-invoice-main">
                                <span class="customer-history-invoice-title">
                                    <strong>${escapeCustomerHtml(invoice.invoiceCode || invoice.code)}</strong>
                                    <em>✓ Đã thanh toán</em>
                                </span>
                                <small>▣&nbsp; ${formatCustomerHistoryDate(invoice.createdAt || invoice.date)} &nbsp;&nbsp; Thanh toán: <b>${escapeCustomerHtml(formatCustomerPaymentMethod(invoice.paymentMethod))}</b></small>
                            </span>
                            <span class="customer-history-invoice-meta">
                                <small>${(invoice.items || []).length} mặt hàng</small>
                                <strong>${formatCustomerHistoryMoney(invoice.finalAmount)}</strong>
                            </span>
                        </summary>
                        <div class="customer-history-invoice-body">
                            <div class="customer-history-items-wrap">
                                <table class="customer-history-items">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Sản phẩm</th>
                                            <th>Đơn giá</th>
                                            <th>Số lượng</th>
                                            <th>Giảm giá</th>
                                            <th>Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(invoice.items || []).map((item, itemIndex) => `
                                            <tr>
                                                <td>${itemIndex + 1}</td>
                                                <td>
                                                    <div class="customer-history-product">
                                                        <img src="${escapeCustomerHtml(item.productImageData || "./assets/branding/sales-manager-logo.svg")}" alt="${escapeCustomerHtml(item.productName || "Sản phẩm")}">
                                                        <span><strong>${escapeCustomerHtml(item.productName || "Sản phẩm")}</strong><small>${escapeCustomerHtml(item.productCode || "")}</small></span>
                                                    </div>
                                                </td>
                                                <td>${formatCustomerHistoryMoney(item.unitPrice)}</td>
                                                <td>${Number(item.quantity || 0).toLocaleString("vi-VN")}</td>
                                                <td>${formatCustomerHistoryMoney(item.discount)}</td>
                                                <td>${formatCustomerHistoryMoney(item.amount)}</td>
                                            </tr>
                                        `).join("") || `
                                            <tr>
                                                <td colspan="6" class="customer-history-no-items">Hóa đơn chưa có chi tiết sản phẩm.</td>
                                            </tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>
                            <div class="customer-history-invoice-footer">
                                <div><strong>Tổng cộng</strong><small>${(invoice.items || []).length} mặt hàng</small></div>
                                <dl>
                                    <div><dt>Tạm tính</dt><dd>${formatCustomerHistoryMoney(invoice.totalAmount)}</dd></div>
                                    <div><dt>Giảm giá</dt><dd>${formatCustomerHistoryMoney(invoice.discount)}</dd></div>
                                    <div class="is-total"><dt>Thành tiền</dt><dd>${formatCustomerHistoryMoney(invoice.finalAmount)}</dd></div>
                                </dl>
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
    const content = document.getElementById("customer-history-content");
    if (!customer || !modal || !title || !content) return;

    const requestId = ++customerHistoryRequestId;
    title.textContent = customer.name;
    const code = document.getElementById("customer-history-code");
    const phone = document.getElementById("customer-history-phone");
    const group = document.getElementById("customer-history-group");
    const lastPurchase = document.getElementById("customer-history-last-purchase");
    const lifetimeSpend = document.getElementById("customer-history-lifetime-spend");
    if (code) code.textContent = customer.code || `KH${customer.id}`;
    if (phone) phone.textContent = customer.phone || "Chưa có số điện thoại";
    if (group) group.textContent = customer.customerGroup || "Khách thường";
    if (lastPurchase) lastPurchase.textContent = "Đang tải...";
    if (lifetimeSpend) lifetimeSpend.textContent = "Đang tải dữ liệu mua hàng";
    content.scrollTop = 0;
    content.innerHTML = `
        <div class="customer-history-loading">
            <span></span>
            <p>Đang tải lịch sử mua hàng...</p>
        </div>
    `;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("customer-history-open");

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
    const modal = document.getElementById("customer-history-modal");
    modal?.classList.remove("active");
    modal?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("customer-history-open");
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
            selectedCustomerId = createdCustomer.id;
            customerDetailCache.delete(createdCustomer.id);
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
            selectedCustomerId = updatedCustomer.id;
            customerDetailCache.delete(updatedCustomer.id);
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
        selectedCustomerId = id;
        customerDetailCache.delete(id);
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
        customerDetailCache.delete(id);
        if (selectedCustomerId === id) selectedCustomerId = null;
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

    const groupFilter = document.getElementById(
        "customer-group-filter"
    );

    const resetButton = document.getElementById(
        "customer-reset-filter"
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

    if (groupFilter) {
        groupFilter.addEventListener("change", function () {
            currentCustomerPage = 1;
            renderCustomers();
        });
    }

    if (resetButton) {
        resetButton.addEventListener("click", function () {
            if (searchInput) searchInput.value = "";
            if (groupFilter) groupFilter.value = "all";
            if (statusFilter) statusFilter.value = "all";
            currentCustomerPage = 1;
            renderCustomers();
            searchInput?.focus();
        });
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

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && historyModal?.classList.contains("active")) {
            closeCustomerPurchaseHistory();
        }
    });
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
    selectedCustomerId = customers[0]?.id ?? null;
    customerDetailCache.clear();

    if (!customerEventsInitialized) {
        setupCustomerFilters();
        setupCustomerModal();
        customerEventsInitialized = true;
    }

    renderCustomers();
}
