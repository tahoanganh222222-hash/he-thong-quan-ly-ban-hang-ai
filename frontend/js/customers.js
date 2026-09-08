/* ================================

   CUSTOMER MANAGEMENT

   ================================ */

let customers = [
    {
        id: 1,
        code: "KH001",
        name: "Nguyễn Văn An",
        phone: "0912345678",
        email: "nguyenvanan@gmail.com",
        address: "Thái Nguyên",
        customerGroup: "Khách thường",
        isActive: true
    },
    {
        id: 2,
        code: "KH002",
        name: "Trần Thị Bình",
        phone: "0987654321",
        email: "tranthibinh@gmail.com",
        address: "Hà Nội",
        customerGroup: "Khách thân thiết",
        isActive: true
    },
    {
        id: 3,
        code: "KH003",
        name: "Lê Văn Cường",
        phone: "0905123456",
        email: "levancuong@gmail.com",
        address: "Thái Nguyên",
        customerGroup: "Khách thường",
        isActive: true
    },
    {
        id: 4,
        code: "KH004",
        name: "Phạm Thị Dung",
        phone: "0978123456",
        email: "phamthidung@gmail.com",
        address: "Bắc Ninh",
        customerGroup: "Khách thân thiết",
        isActive: true
    },
    {
        id: 5,
        code: "KH005",
        name: "Hoàng Văn Đức",
        phone: "0961234567",
        email: "",
        address: "Thái Nguyên",
        customerGroup: "Khách thường",
        isActive: false
    },
    {
        id: 6,
        code: "KH006",
        name: "Đỗ Thị Hà",
        phone: "0934567890",
        email: "dothiha@gmail.com",
        address: "Hà Nội",
        customerGroup: "Khách VIP",
        isActive: true
    },
    {
        id: 7,
        code: "KH007",
        name: "Nguyễn Minh Hoàng",
        phone: "0923456789",
        email: "nguyenminhhoang@gmail.com",
        address: "Thái Nguyên",
        customerGroup: "Khách thường",
        isActive: true
    },
    {
        id: 8,
        code: "KH008",
        name: "Vũ Thị Lan",
        phone: "0945678901",
        email: "vuthilan@gmail.com",
        address: "Bắc Giang",
        customerGroup: "Khách thân thiết",
        isActive: true
    },
    {
        id: 9,
        code: "KH009",
        name: "Bùi Văn Nam",
        phone: "0915678901",
        email: "",
        address: "Thái Nguyên",
        customerGroup: "Khách thường",
        isActive: true
    },
    {
        id: 10,
        code: "KH010",
        name: "Phan Thị Oanh",
        phone: "0981234567",
        email: "phanthioanh@gmail.com",
        address: "Hà Nội",
        customerGroup: "Khách VIP",
        isActive: true
    }
];

let currentCustomerPage = 1;
const customerPageSize = 7;
let editingCustomerId = null;


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

function saveCustomer(event) {

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

        customers.push({

            id: Date.now(),
            code,
            name,
            phone,
            email,
            address,
            customerGroup,
            isActive: true

        });

        alert("Thêm khách hàng thành công.");

    } else {

        const customer = customers.find(
            item => item.id === editingCustomerId
        );

        if (customer) {

            customer.code = code;
            customer.name = name;
            customer.phone = phone;
            customer.email = email;
            customer.address = address;
            customer.customerGroup = customerGroup;

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

function toggleCustomerStatus(id) {

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

    customer.isActive = !customer.isActive;

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

function initCustomerManagement() {

    // KIỂM TRA PHÂN QUYỀN
    if (
        typeof requirePermission === "function" &&
        !requirePermission("customer_manage")
    ) {
        return;
    }

    currentCustomerPage = 1;

    setupCustomerFilters();

    setupCustomerModal();

    renderCustomers();
}