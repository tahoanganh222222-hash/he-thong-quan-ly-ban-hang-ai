/* ================================
   SALES INVOICE - UC04
   ================================ */

let invoiceItems = [];

/*
 * Products loaded from API Products + Inventory.
 */
let invoiceProducts = [];

/*
 * Customers loaded from API.
 */
let invoiceCustomers = [];

async function loadInvoiceReferenceData() {

    try {
        const [productData, customerData] = await Promise.all([
            window.salesApi.products.list(),
            window.salesApi.customers.list()
        ]);
        invoiceProducts = productData.filter(product => product.isActive);
        invoiceCustomers = customerData.filter(customer => customer.isActive);
    } catch (error) {
        invoiceProducts = [];
        invoiceCustomers = [];
        console.error("Không thể tải dữ liệu lập hóa đơn:", error);
        if (error.status === 401) return;
        alert("Không thể tải sản phẩm và khách hàng từ máy chủ.");
    }
}

/* ================================
   FORMAT
   ================================ */

function formatInvoiceMoney(value) {
    return Number(value || 0).toLocaleString(
        "vi-VN"
    ) + " ₫";
}

/* ================================
   INVOICE CODE
   ================================ */

function generateInvoiceCode() {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    const randomNumber = Math.floor(
        1000 + Math.random() * 9000
    );

    return `HD${year}${month}${day}-${randomNumber}`;
}

/* ================================
   LOAD CUSTOMERS
   ================================ */

function loadInvoiceCustomers() {
    const select = document.getElementById(
        "invoice-customer"
    );

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Khách lẻ
        </option>
    `;

    invoiceCustomers
        .filter(customer => customer.isActive)
        .forEach(customer => {
            const option =
                document.createElement("option");

            option.value = customer.id;

            option.textContent =
                `${customer.code} - ${customer.name} - ${customer.phone}`;

            select.appendChild(option);
        });
}

/* ================================
   LOAD PRODUCTS
   ================================ */

function loadInvoiceProducts() {
    const select = document.getElementById(
        "invoice-product"
    );

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Chọn sản phẩm
        </option>
    `;

    invoiceProducts
        .filter(product => product.stock > 0)
        .forEach(product => {
            const option =
                document.createElement("option");

            option.value = product.id;

            option.textContent =
                `${product.code} - ${product.name} (${product.stock} tồn)`;

            select.appendChild(option);
        });
}

/* ================================
   ADD PRODUCT
   ================================ */

function addInvoiceProduct() {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("invoice_create")
    ) {
        return;
    }

    const productSelect =
        document.getElementById(
            "invoice-product"
        );

    const quantityInput =
        document.getElementById(
            "invoice-quantity"
        );

    if (!productSelect || !quantityInput) {
        return;
    }

    const productId =
        Number(productSelect.value);

    const quantity =
        Number(quantityInput.value);

    if (!productId) {
        alert("Vui lòng chọn sản phẩm.");
        return;
    }

    if (
        !Number.isInteger(quantity) ||
        quantity <= 0
    ) {
        alert(
            "Số lượng phải là số nguyên lớn hơn 0."
        );
        return;
    }

    const product =
        invoiceProducts.find(
            item => item.id === productId
        );

    if (!product) {
        return;
    }

    const existingItem =
        invoiceItems.find(
            item => item.productId === productId
        );

    const newQuantity =
        existingItem
            ? existingItem.quantity + quantity
            : quantity;

    if (newQuantity > product.stock) {
        alert(
            `Số lượng vượt quá tồn kho. Hiện còn ${product.stock} ${product.name}.`
        );
        return;
    }

    if (existingItem) {
        existingItem.quantity =
            newQuantity;
        recalculateInvoiceItem(existingItem);
    } else {
        const newItem = {
            productId: product.id,
            code: product.code,
            name: product.name,
            quantity,
            unitPrice: product.sellingPrice,
            discountPerUnit: 0,
            discount: 0,
            amount: 0
        };
        recalculateInvoiceItem(newItem);
        invoiceItems.push(newItem);
    }

    productSelect.value = "";
    quantityInput.value = 1;

    renderInvoiceItems();
    updateInvoiceSummary();
}

/* ================================
   RENDER ITEMS
   ================================ */

function renderInvoiceItems() {
    const tableBody =
        document.getElementById(
            "invoice-product-table-body"
        );

    if (!tableBody) {
        return;
    }

    if (invoiceItems.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="invoice-empty">
                        Chưa có sản phẩm trong hóa đơn.
                    </div>
                </td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML =
        invoiceItems.map(
            (item, index) => `
                <tr>
                    <td>
                        ${index + 1}
                    </td>

                    <td>
                        <div class="invoice-product-name">
                            ${item.name}
                        </div>

                        <div class="invoice-product-code">
                            ${item.code}
                        </div>
                    </td>

                    <td>
                        ${formatInvoiceMoney(
                            item.unitPrice
                        )}
                    </td>

                    <td>
                        <input
                            type="number"
                            class="invoice-quantity-input"
                            min="1"
                            value="${item.quantity}"
                            onchange="updateInvoiceItemQuantity(
                                ${item.productId},
                                this.value
                            )"
                        >
                    </td>

                    <td>
                        <div class="invoice-item-discount-control">
                            <input
                                type="number"
                                class="invoice-item-discount-input"
                                min="0"
                                max="${item.unitPrice}"
                                step="1000"
                                inputmode="numeric"
                                value="${item.discountPerUnit}"
                                aria-label="Số tiền giảm trên mỗi đơn vị ${item.name}"
                                onchange="updateInvoiceItemDiscount(
                                    ${item.productId},
                                    this.value
                                )"
                            >
                            <span>₫</span>
                        </div>
                        <small class="invoice-item-final-price">
                            Còn ${formatInvoiceMoney(item.unitPrice - item.discountPerUnit)}/đơn vị
                        </small>
                    </td>

                    <td>
                        <strong class="invoice-item-amount">
                            ${formatInvoiceMoney(item.amount)}
                        </strong>
                        ${item.discount > 0 ? `
                            <small class="invoice-item-saving">
                                Giảm ${formatInvoiceMoney(item.discount)}
                            </small>
                        ` : ""}
                    </td>

                    <td>
                        <button
                            type="button"
                            class="invoice-remove-button"
                            onclick="removeInvoiceItem(
                                ${item.productId}
                            )"
                        >
                            Xóa
                        </button>
                    </td>
                </tr>
            `
        ).join("");
}

/* ================================
   UPDATE QUANTITY
   ================================ */

function updateInvoiceItemQuantity(
    productId,
    value
) {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("invoice_create")
    ) {
        return;
    }

    const quantity = Number(value);

    const item =
        invoiceItems.find(
            invoiceItem =>
                invoiceItem.productId === productId
        );

    const product =
        invoiceProducts.find(
            invoiceProduct =>
                invoiceProduct.id === productId
        );

    if (!item || !product) {
        return;
    }

    if (
        !Number.isInteger(quantity) ||
        quantity <= 0
    ) {
        alert(
            "Số lượng phải là số nguyên lớn hơn 0."
        );

        renderInvoiceItems();
        return;
    }

    if (quantity > product.stock) {
        alert(
            `Số lượng vượt quá tồn kho. Hiện còn ${product.stock}.`
        );

        renderInvoiceItems();
        return;
    }

    item.quantity = quantity;
    recalculateInvoiceItem(item);

    renderInvoiceItems();
    updateInvoiceSummary();
}

function recalculateInvoiceItem(item) {
    const grossAmount = Math.max(0, Number(item.unitPrice) || 0) * item.quantity;
    const discountPerUnit = Math.min(
        Number(item.unitPrice) || 0,
        Math.max(0, Number(item.discountPerUnit) || 0)
    );
    item.discountPerUnit = discountPerUnit;
    item.discount = Math.round(discountPerUnit * item.quantity);
    item.amount = Math.max(0, grossAmount - item.discount);
}

function updateInvoiceItemDiscount(productId, value) {
    if (
        typeof requirePermission === "function" &&
        !requirePermission("invoice_create")
    ) {
        return;
    }

    const discountPerUnit = Number(value);
    const item = invoiceItems.find(
        invoiceItem => invoiceItem.productId === productId
    );
    if (!item) return;

    if (
        !Number.isFinite(discountPerUnit) ||
        discountPerUnit < 0 ||
        discountPerUnit > item.unitPrice
    ) {
        alert(`Số tiền giảm mỗi đơn vị phải từ 0 đến ${formatInvoiceMoney(item.unitPrice)}.`);
        renderInvoiceItems();
        return;
    }

    item.discountPerUnit = discountPerUnit;
    recalculateInvoiceItem(item);
    renderInvoiceItems();
    updateInvoiceSummary();
}

/* ================================
   REMOVE ITEM
   ================================ */

function removeInvoiceItem(productId) {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("invoice_create")
    ) {
        return;
    }

    invoiceItems =
        invoiceItems.filter(
            item =>
                item.productId !== productId
        );

    renderInvoiceItems();
    updateInvoiceSummary();
}

/* ================================
   CALCULATE
   ================================ */

function calculateInvoiceTotal() {
    return invoiceItems.reduce(
        (total, item) =>
            total + item.amount,
        0
    );
}

function calculateInvoiceSubtotal() {
    return invoiceItems.reduce(
        (total, item) => total + item.quantity * item.unitPrice,
        0
    );
}

function calculateProductDiscountTotal() {
    return invoiceItems.reduce(
        (total, item) => total + Number(item.discount || 0),
        0
    );
}

function updateInvoiceSummary() {
    const subtotal = calculateInvoiceSubtotal();
    const productDiscount = calculateProductDiscountTotal();
    const finalAmount = calculateInvoiceTotal();

    const totalElement =
        document.getElementById(
            "invoice-total-amount"
        );

    const finalElement =
        document.getElementById(
            "invoice-final-amount"
        );

    const productDiscountElement =
        document.getElementById(
            "invoice-product-discount"
        );

    if (totalElement) {
        totalElement.textContent =
            formatInvoiceMoney(subtotal);
    }

    if (finalElement) {
        finalElement.textContent =
            formatInvoiceMoney(finalAmount);
    }

    if (productDiscountElement) {
        productDiscountElement.textContent =
            `- ${formatInvoiceMoney(productDiscount)}`;
    }

    return { subtotal, productDiscount, finalAmount };
}

/* ================================
   CREATE INVOICE
   ================================ */

async function createSalesInvoice() {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("invoice_create")
    ) {
        return;
    }

    if (invoiceItems.length === 0) {
        alert(
            "Vui lòng thêm ít nhất một sản phẩm vào hóa đơn."
        );
        return;
    }

    const customerSelect =
        document.getElementById(
            "invoice-customer"
        );

    const paymentMethod =
        document.querySelector(
            'input[name="invoice-payment"]:checked'
        );

    const customerId =
        customerSelect
            ? customerSelect.value
            : "";

    const finalAmount = calculateInvoiceTotal();

    if (!paymentMethod) {
        alert(
            "Vui lòng chọn phương thức thanh toán."
        );
        return;
    }

    const invoiceCode =
        document.getElementById(
            "invoice-code"
        ).textContent;

    const customer =
        invoiceCustomers.find(
            item =>
                String(item.id) ===
                String(customerId)
        );

    const paymentText =
        paymentMethod.value === "cash"
            ? "Tiền mặt"
            : paymentMethod.value === "transfer"
                ? "Chuyển khoản"
                : "Khác";

    const confirmed = confirm(
        `Xác nhận lập hóa đơn ${invoiceCode}?\n\n` +
        `Khách hàng: ${
            customer
                ? customer.name
                : "Khách lẻ"
        }\n` +
        `Tổng tiền: ${formatInvoiceMoney(
            finalAmount
        )}\n` +
        `Thanh toán: ${paymentText}`
    );

    if (!confirmed) {
        return;
    }

    try {
        await window.salesApi.invoices.create({
            invoiceCode,
            customerId: customerId ? Number(customerId) : null,
            discount: 0,
            paymentMethod: paymentMethod.value,
            items: invoiceItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount
            }))
        });
        await loadInvoiceReferenceData();
        document.dispatchEvent(new CustomEvent("sales:invoice-created"));
    } catch (error) {
        alert(error.message || "Không thể lập hóa đơn.");
        return;
    }

    alert(
        `Lập hóa đơn ${invoiceCode} thành công.`
    );

    resetSalesInvoice();
}

/* ================================
   RESET
   ================================ */

function resetSalesInvoice() {
    invoiceItems = [];

    const customerSelect =
        document.getElementById(
            "invoice-customer"
        );

    const productSelect =
        document.getElementById(
            "invoice-product"
        );

    const quantityInput =
        document.getElementById(
            "invoice-quantity"
        );

    if (customerSelect) {
        customerSelect.value = "";
    }

    if (productSelect) {
        productSelect.value = "";
    }

    if (quantityInput) {
        quantityInput.value = 1;
    }

    const cashPayment =
        document.querySelector(
            'input[name="invoice-payment"][value="cash"]'
        );

    if (cashPayment) {
        cashPayment.checked = true;
    }

    const invoiceCode =
        document.getElementById(
            "invoice-code"
        );

    if (invoiceCode) {
        invoiceCode.textContent =
            generateInvoiceCode();
    }

    renderInvoiceItems();
    updateInvoiceSummary();
}

/* ================================
   INIT
   ================================ */

async function initSalesInvoice() {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("invoice_create")
    ) {
        return;
    }

    invoiceItems = [];

    await loadInvoiceReferenceData();

    loadInvoiceCustomers();
    loadInvoiceProducts();

    const invoiceCode =
        document.getElementById(
            "invoice-code"
        );

    if (invoiceCode) {
        invoiceCode.textContent =
            generateInvoiceCode();
    }

    const quantityInput =
        document.getElementById(
            "invoice-quantity"
        );

    if (quantityInput) {
        quantityInput.value = 1;
    }

    renderInvoiceItems();
    updateInvoiceSummary();
}


/* ================================
   EVENT LISTENERS
   ================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const addProductButton =
            document.getElementById(
                "invoice-add-product-button"
            );

        const createButton =
            document.getElementById(
                "invoice-create-button"
            );

        const cancelButton =
            document.getElementById(
                "invoice-cancel-button"
            );

        if (addProductButton) {
            addProductButton.addEventListener(
                "click",
                addInvoiceProduct
            );
        }

        if (createButton) {
            createButton.addEventListener(
                "click",
                createSalesInvoice
            );
        }

        if (cancelButton) {
            cancelButton.addEventListener(
                "click",
                resetSalesInvoice
            );
        }

    }
);

/* =========================================================
   34. INVOICE SEARCH / FILTER
   CHỈ BỔ SUNG - KHÔNG SỬA CODE UC04 HIỆN CÓ
   ========================================================= */

(function () {

    "use strict";

    /* =========================================================
       34.1. DỮ LIỆU HÓA ĐƠN TỪ API
       ========================================================= */

    let invoiceSearchData = [];

    let invoiceSearchEventsInitialized = false;
    let invoiceSearchInitializationPromise = null;


    /* =========================================================
       34.2. BIẾN DỮ LIỆU LỌC
       ========================================================= */

    let filteredInvoiceSearchData = invoiceSearchData.slice();

    const invoicesPerPage = 5;
    let currentInvoiceSearchPage = 1;

    async function reloadInvoiceSearchData() {

        try {
            invoiceSearchData = await window.salesApi.invoices.list();
            filteredInvoiceSearchData = invoiceSearchData.slice();
            currentInvoiceSearchPage = 1;
            renderInvoiceSearchResults();
        } catch (error) {
            invoiceSearchData = [];
            filteredInvoiceSearchData = [];
            currentInvoiceSearchPage = 1;
            console.error("Không thể tải danh sách hóa đơn:", error);
            renderInvoiceSearchResults();
        }
    }


    /* =========================================================
       34.3. KIỂM TRA QUYỀN
       ========================================================= */

    function invoiceSearchHasPermission() {

        if (
            typeof window.hasCurrentUserPermission === "function"
        ) {
            return window.hasCurrentUserPermission(
                "invoice_search"
            );
        }

        return false;
    }


    /* =========================================================
       34.4. FORMAT TIỀN
       ========================================================= */

    function invoiceSearchFormatMoney(value) {

        if (
            typeof window.formatInvoiceMoney === "function"
        ) {
            return window.formatInvoiceMoney(value);
        }

        return new Intl.NumberFormat(
            "vi-VN"
        ).format(value) + " ₫";
    }


    /* =========================================================
       34.5. ESCAPE HTML
       ========================================================= */

    function invoiceSearchEscapeHTML(value) {

        const text = String(value || "");

        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =========================================================
       34.6. FORMAT PHƯƠNG THỨC THANH TOÁN
       ========================================================= */

    function invoiceSearchPaymentText(paymentMethod) {

        if (paymentMethod === "cash") {
            return "Tiền mặt";
        }

        if (paymentMethod === "transfer") {
            return "Chuyển khoản";
        }

        if (paymentMethod === "other") {
            return "Khác";
        }

        return "Không xác định";
    }


    /* =========================================================
       34.7. FORMAT TRẠNG THÁI
       ========================================================= */

    function invoiceSearchStatusText(status) {

        if (status === "completed") {
            return "Đã thanh toán";
        }

        if (status === "pending") {
            return "Chờ thanh toán";
        }

        if (status === "cancelled") {
            return "Đã hủy";
        }

        return "Không xác định";
    }


    /* =========================================================
       34.8. TẠO GIAO DIỆN TÌM KIẾM
       ========================================================= */

    function createInvoiceSearchUI() {

        if (
            document.getElementById(
                "invoice-search-filter-container"
            )
        ) {
            return;
        }


        const container = document.createElement("section");

        container.id =
            "invoice-search-filter-container";


        container.innerHTML = `
            <div class="invoice-search-box">

                <div class="invoice-search-title">
                    <div class="invoice-search-heading">
                        <span class="invoice-search-heading-icon" aria-hidden="true">⌕</span>
                        <div>
                            <h3>Tìm kiếm và lọc hóa đơn</h3>
                            <p>Tra cứu nhanh theo thông tin giao dịch và khoảng thời gian</p>
                        </div>
                    </div>
                    <span id="invoice-search-result-count">
                        Tìm thấy 0 hóa đơn
                    </span>
                </div>


                <div class="invoice-search-form">

                    <div class="invoice-search-field invoice-search-keyword">
                        <label for="invoice-search-input">
                            Từ khóa
                        </label>

                        <input
                            type="text"
                            id="invoice-search-input"
                            placeholder="Mã hóa đơn, khách hàng, SĐT..."
                        >
                    </div>


                    <div class="invoice-search-field invoice-search-date">
                        <label for="invoice-search-from-date">
                            Từ ngày
                        </label>

                        <input
                            type="date"
                            id="invoice-search-from-date"
                        >
                    </div>


                    <div class="invoice-search-field invoice-search-date">
                        <label for="invoice-search-to-date">
                            Đến ngày
                        </label>

                        <input
                            type="date"
                            id="invoice-search-to-date"
                        >
                    </div>


                    <div class="invoice-search-field invoice-search-select">
                        <label for="invoice-search-payment">
                            Thanh toán
                        </label>

                        <select id="invoice-search-payment">

                            <option value="">
                                Tất cả
                            </option>

                            <option value="cash">
                                Tiền mặt
                            </option>

                            <option value="transfer">
                                Chuyển khoản
                            </option>

                            <option value="other">
                                Khác
                            </option>

                        </select>
                    </div>


                    <div class="invoice-search-field invoice-search-select">
                        <label for="invoice-search-status">
                            Trạng thái
                        </label>

                        <select id="invoice-search-status">

                            <option value="">
                                Tất cả
                            </option>

                            <option value="completed">
                                Đã thanh toán
                            </option>

                            <option value="pending">
                                Chờ thanh toán
                            </option>

                            <option value="cancelled">
                                Đã hủy
                            </option>

                        </select>
                    </div>


                    <div class="invoice-search-secondary-row">
                        <div class="invoice-search-amount-group">
                            <span class="invoice-search-group-label">Khoảng giá trị hóa đơn</span>
                            <label class="invoice-search-amount-control" for="invoice-search-min-amount">
                                <span>Từ</span>
                                <input
                                    type="number"
                                    id="invoice-search-min-amount"
                                    min="0"
                                    step="1000"
                                    placeholder="0"
                                >
                                <b>₫</b>
                            </label>
                            <span class="invoice-search-amount-separator" aria-hidden="true">—</span>
                            <label class="invoice-search-amount-control" for="invoice-search-max-amount">
                                <span>Đến</span>
                                <input
                                    type="number"
                                    id="invoice-search-max-amount"
                                    min="0"
                                    step="1000"
                                    placeholder="Không giới hạn"
                                >
                                <b>₫</b>
                            </label>
                        </div>

                        <div class="invoice-search-actions">
                            <button
                                type="button"
                                id="invoice-search-button"
                                class="invoice-search-button"
                            >
                                <span aria-hidden="true">⌕</span>
                                Tìm kiếm
                            </button>

                            <button
                                type="button"
                                id="invoice-search-reset-button"
                                class="invoice-search-reset-button"
                            >
                                <span aria-hidden="true">↺</span>
                                Xóa bộ lọc
                            </button>
                        </div>
                    </div>

                </div>


                <div class="invoice-search-table-wrapper">

                    <table class="invoice-search-table">

                        <thead>

                            <tr>
                                <th>STT</th>
                                <th>Mã hóa đơn</th>
                                <th>Khách hàng</th>
                                <th>Ngày</th>
                                <th>Tổng tiền</th>
                                <th>Thanh toán</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>

                        </thead>

                        <tbody
                            id="invoice-search-table-body"
                        ></tbody>

                    </table>

                </div>

                <div class="invoice-search-pagination">
                    <span
                        class="invoice-search-pagination-info"
                        id="invoice-search-pagination-info"
                    >
                        Không có hóa đơn
                    </span>

                    <div
                        class="invoice-search-pagination-buttons"
                        id="invoice-search-pagination-buttons"
                        aria-label="Phân trang hóa đơn"
                    ></div>
                </div>

            </div>

            <div
                class="invoice-search-detail-modal"
                id="invoice-search-detail-modal"
                aria-hidden="true"
            >
                <div
                    class="invoice-search-detail-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="invoice-search-detail-title"
                >
                    <div class="invoice-search-detail-header">
                        <div>
                            <span>CHI TIẾT GIAO DỊCH</span>
                            <h3 id="invoice-search-detail-title">Thông tin hóa đơn</h3>
                        </div>
                        <button
                            type="button"
                            class="invoice-search-detail-close"
                            id="invoice-search-detail-close"
                            aria-label="Đóng chi tiết hóa đơn"
                        >×</button>
                    </div>
                    <div
                        class="invoice-search-detail-body"
                        id="invoice-search-detail-body"
                    ></div>
                </div>
            </div>
        `;


        /*
            Tìm vị trí phù hợp để chèn.

            Ưu tiên khu vực hóa đơn hiện có.
            Nếu không tìm thấy thì thêm vào cuối main.
        */

         const target = document.getElementById(
    "sales-invoice-page"
);

if (!target) {
    console.error(
        "❌ Không tìm thấy #sales-invoice-page"
    );
    return;
}

const header = target.querySelector(
    ".sales-invoice-page-header"
);

if (header) {
    header.insertAdjacentElement(
        "afterend",
        container
    );
} else {
    target.prepend(container);
}

const detailModal = document.getElementById(
    "invoice-search-detail-modal"
);

if (detailModal && detailModal.parentElement !== document.body) {
    document.body.appendChild(detailModal);
}
    }


    /* =========================================================
       34.9. LẤY GIÁ TRỊ BỘ LỌC
       ========================================================= */

    function getInvoiceSearchValue(id) {

        const element =
            document.getElementById(id);

        if (!element) {
            return "";
        }

        return String(
            element.value || ""
        ).trim();
    }


    /* =========================================================
       34.10. LỌC HÓA ĐƠN
       ========================================================= */

    function filterInvoiceSearch() {

        if (!invoiceSearchHasPermission()) {

            if (
                typeof window.requirePermission ===
                "function"
            ) {
                window.requirePermission(
                    "invoice_search"
                );
            }

            return;
        }


        const keyword =
            getInvoiceSearchValue(
                "invoice-search-input"
            ).toLowerCase();


        const fromDate =
            getInvoiceSearchValue(
                "invoice-search-from-date"
            );


        const toDate =
            getInvoiceSearchValue(
                "invoice-search-to-date"
            );


        const paymentMethod =
            getInvoiceSearchValue(
                "invoice-search-payment"
            );


        const status =
            getInvoiceSearchValue(
                "invoice-search-status"
            );


        const minAmountValue =
            getInvoiceSearchValue(
                "invoice-search-min-amount"
            );


        const maxAmountValue =
            getInvoiceSearchValue(
                "invoice-search-max-amount"
            );


        const minAmount =
            minAmountValue === ""
                ? null
                : Number(minAmountValue);


        const maxAmount =
            maxAmountValue === ""
                ? null
                : Number(maxAmountValue);


        if (
            fromDate &&
            toDate &&
            fromDate > toDate
        ) {

            alert(
                "Ngày bắt đầu không được lớn hơn ngày kết thúc."
            );

            return;
        }


        if (
            minAmount !== null &&
            maxAmount !== null &&
            minAmount > maxAmount
        ) {

            alert(
                "Giá trị tối thiểu không được lớn hơn giá trị tối đa."
            );

            return;
        }


        filteredInvoiceSearchData =
            invoiceSearchData.filter(
                function (invoice) {

                    /*
                        Tìm kiếm theo:

                        - Mã hóa đơn
                        - Mã khách hàng
                        - Tên khách hàng
                        - Số điện thoại
                    */

                    if (keyword) {

                        const searchText =
                            (
                                String(
                                    invoice.code || ""
                                ) +
                                " " +
                                String(
                                    invoice.customerCode || ""
                                ) +
                                " " +
                                String(
                                    invoice.customerName || ""
                                ) +
                                " " +
                                String(
                                    invoice.customerPhone || ""
                                )
                            ).toLowerCase();


                        if (
                            !searchText.includes(
                                keyword
                            )
                        ) {

                            return false;
                        }
                    }


                    /*
                        Lọc từ ngày
                    */

                    if (
                        fromDate &&
                        invoice.date < fromDate
                    ) {

                        return false;
                    }


                    /*
                        Lọc đến ngày
                    */

                    if (
                        toDate &&
                        invoice.date > toDate
                    ) {

                        return false;
                    }


                    /*
                        Lọc phương thức thanh toán
                    */

                    if (
                        paymentMethod &&
                        invoice.paymentMethod !==
                        paymentMethod
                    ) {

                        return false;
                    }


                    /*
                        Lọc trạng thái
                    */

                    if (
                        status &&
                        invoice.status !==
                        status
                    ) {

                        return false;
                    }


                    /*
                        Lọc giá trị tối thiểu
                    */

                    if (
                        minAmount !== null &&
                        invoice.totalAmount <
                        minAmount
                    ) {

                        return false;
                    }


                    /*
                        Lọc giá trị tối đa
                    */

                    if (
                        maxAmount !== null &&
                        invoice.totalAmount >
                        maxAmount
                    ) {

                        return false;
                    }


                    return true;
                }
            );

        currentInvoiceSearchPage = 1;
        renderInvoiceSearchResults();
    }


    /* =========================================================
       34.11. HIỂN THỊ KẾT QUẢ
       ========================================================= */

    function renderInvoiceSearchResults() {

        const tableBody =
            document.getElementById(
                "invoice-search-table-body"
            );


        if (!tableBody) {
            return;
        }


        const countElement =
            document.getElementById(
                "invoice-search-result-count"
            );


        if (countElement) {

            countElement.textContent =
                "Tìm thấy " +
                filteredInvoiceSearchData.length +
                " hóa đơn";
        }

        const totalItems =
            filteredInvoiceSearchData.length;

        const totalPages = Math.max(
            1,
            Math.ceil(totalItems / invoicesPerPage)
        );

        currentInvoiceSearchPage = Math.min(
            Math.max(currentInvoiceSearchPage, 1),
            totalPages
        );


        if (
            totalItems === 0
        ) {

            tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="invoice-search-empty"
                    >
                        Không tìm thấy hóa đơn phù hợp.
                    </td>
                </tr>
            `;

            renderInvoiceSearchPagination(
                totalItems,
                totalPages
            );

            return;
        }


        const startIndex =
            (currentInvoiceSearchPage - 1) *
            invoicesPerPage;

        const pageInvoices =
            filteredInvoiceSearchData.slice(
                startIndex,
                startIndex + invoicesPerPage
            );


        tableBody.innerHTML =
            pageInvoices
                .map(
                    function (invoice, index) {

                        return `
                            <tr>

                                <td>
                                    ${startIndex + index + 1}
                                </td>

                                <td>
                                    ${invoiceSearchEscapeHTML(
                                        invoice.code
                                    )}
                                </td>

                                <td>

                                    <div>
                                        ${invoiceSearchEscapeHTML(
                                            invoice.customerName ||
                                            "Khách lẻ"
                                        )}
                                    </div>

                                    ${
                                        invoice.customerPhone
                                            ? `
                                                <small>
                                                    ${invoiceSearchEscapeHTML(
                                                        invoice.customerPhone
                                                    )}
                                                </small>
                                            `
                                            : ""
                                    }

                                </td>

                                <td>
                                    ${invoiceSearchEscapeHTML(
                                        invoice.date
                                    )}
                                </td>

                                <td>
                                    ${invoiceSearchFormatMoney(
                                        invoice.totalAmount
                                    )}
                                </td>

                                <td>
                                    ${invoiceSearchEscapeHTML(
                                        invoiceSearchPaymentText(
                                            invoice.paymentMethod
                                        )
                                    )}
                                </td>

                                <td>
                                    ${invoiceSearchEscapeHTML(
                                        invoiceSearchStatusText(
                                            invoice.status
                                        )
                                    )}
                                </td>

                                <td>

                                    <button
                                        type="button"
                                        class="invoice-search-view-button"
                                        data-invoice-id="${invoice.id}"
                                    >
                                        Xem
                                    </button>

                                </td>

                            </tr>
                        `;
                    }
                )
                .join("");


        renderInvoiceSearchPagination(
            totalItems,
            totalPages
        );


        /*
            Gắn sự kiện nút Xem.
        */

        const viewButtons =
            tableBody.querySelectorAll(
                ".invoice-search-view-button"
            );


        viewButtons.forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const invoiceId =
                            Number(
                                button.getAttribute(
                                    "data-invoice-id"
                                )
                            );

                        viewInvoiceSearchDetail(
                            invoiceId
                        );
                    }
                );
            }
        );
    }


    /* =========================================================
       34.11.1. PHÂN TRANG KẾT QUẢ
       ========================================================= */

    function renderInvoiceSearchPagination(
        totalItems,
        totalPages
    ) {

        const info = document.getElementById(
            "invoice-search-pagination-info"
        );

        const buttons = document.getElementById(
            "invoice-search-pagination-buttons"
        );

        if (!info || !buttons) {
            return;
        }

        if (totalItems === 0) {
            info.textContent = "Không có hóa đơn";
            buttons.innerHTML = "";
            return;
        }

        const start =
            (currentInvoiceSearchPage - 1) *
            invoicesPerPage + 1;

        const end = Math.min(
            currentInvoiceSearchPage * invoicesPerPage,
            totalItems
        );

        info.textContent =
            `Hiển thị ${start}-${end} / ${totalItems} hóa đơn`;

        buttons.innerHTML = "";

        const createPageButton = function (
            label,
            targetPage,
            options = {}
        ) {

            const button = document.createElement("button");

            button.type = "button";
            button.className = "invoice-search-page-button";
            button.textContent = label;
            button.disabled = Boolean(options.disabled);
            button.setAttribute(
                "aria-label",
                options.ariaLabel || `Trang ${targetPage}`
            );

            if (options.active) {
                button.classList.add("active");
                button.setAttribute("aria-current", "page");
            }

            button.addEventListener("click", function () {
                if (
                    button.disabled ||
                    targetPage === currentInvoiceSearchPage
                ) {
                    return;
                }

                currentInvoiceSearchPage = targetPage;
                renderInvoiceSearchResults();
            });

            return button;
        };

        buttons.appendChild(
            createPageButton(
                "‹",
                currentInvoiceSearchPage - 1,
                {
                    disabled: currentInvoiceSearchPage === 1,
                    ariaLabel: "Trang hóa đơn trước"
                }
            )
        );

        for (let page = 1; page <= totalPages; page++) {
            buttons.appendChild(
                createPageButton(
                    String(page),
                    page,
                    {
                        active:
                            page === currentInvoiceSearchPage
                    }
                )
            );
        }

        buttons.appendChild(
            createPageButton(
                "›",
                currentInvoiceSearchPage + 1,
                {
                    disabled:
                        currentInvoiceSearchPage === totalPages,
                    ariaLabel: "Trang hóa đơn tiếp theo"
                }
            )
        );
    }


    /* =========================================================
       34.12. XEM CHI TIẾT
       ========================================================= */

    function closeInvoiceSearchDetail() {

        const modal = document.getElementById(
            "invoice-search-detail-modal"
        );

        if (!modal) {
            return;
        }

        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove(
            "invoice-search-detail-open"
        );
    }


    function openInvoiceSearchDetail() {

        const modal = document.getElementById(
            "invoice-search-detail-modal"
        );

        if (!modal) {
            return;
        }

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add(
            "invoice-search-detail-open"
        );
    }


    function renderInvoiceSearchDetail(invoice) {

        const body = document.getElementById(
            "invoice-search-detail-body"
        );

        if (!body) {
            return;
        }

        const items = Array.isArray(invoice.items)
            ? invoice.items
            : [];
        const productSubtotal = items.reduce(
            (total, item) => total + Number(item.unitPrice || 0) * Number(item.quantity || 0),
            0
        );
        const productDiscount = items.reduce(
            (total, item) => total + Number(item.discount || 0),
            0
        );
        const legacyInvoiceDiscount = Number(invoice.discount || 0);

        const productRows = items.length
            ? items.map(function (item, index) {
                const imageSource = item.productImageData ||
                    "./assets/branding/sales-manager-logo.svg";
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>
                            <div class="sales-product-cell invoice-detail-product-cell">
                                <img
                                    class="sales-product-thumbnail invoice-detail-product-thumbnail"
                                    src="${invoiceSearchEscapeHTML(imageSource)}"
                                    alt="${invoiceSearchEscapeHTML(item.productName || "Sản phẩm")}"
                                    loading="lazy"
                                >
                                <div>
                                    <strong>${invoiceSearchEscapeHTML(
                                        item.productName || "Sản phẩm"
                                    )}</strong>
                                    <small>${invoiceSearchEscapeHTML(
                                        item.productCode || `SP${item.productId || ""}`
                                    )}</small>
                                </div>
                            </div>
                        </td>
                        <td>${Number(item.quantity || 0).toLocaleString("vi-VN")}</td>
                        <td>${invoiceSearchFormatMoney(item.unitPrice)}</td>
                        <td>${invoiceSearchFormatMoney(item.discount)}</td>
                        <td><strong>${invoiceSearchFormatMoney(item.amount)}</strong></td>
                    </tr>
                `;
            }).join("")
            : `
                <tr>
                    <td colspan="6" class="invoice-search-detail-empty">
                        Hóa đơn chưa có thông tin sản phẩm.
                    </td>
                </tr>
            `;

        const customerDescription = invoice.customerPhone
            ? `${invoice.customerName || "Khách lẻ"} · ${invoice.customerPhone}`
            : (invoice.customerName || "Khách lẻ");

        body.innerHTML = `
            <div class="invoice-search-detail-meta">
                <article>
                    <span>Mã hóa đơn</span>
                    <strong>${invoiceSearchEscapeHTML(invoice.code || invoice.invoiceCode)}</strong>
                </article>
                <article>
                    <span>Khách hàng</span>
                    <strong>${invoiceSearchEscapeHTML(customerDescription)}</strong>
                </article>
                <article>
                    <span>Ngày lập</span>
                    <strong>${invoiceSearchEscapeHTML(invoice.date)}</strong>
                </article>
                <article>
                    <span>Thanh toán</span>
                    <strong>${invoiceSearchEscapeHTML(
                        invoiceSearchPaymentText(invoice.paymentMethod)
                    )}</strong>
                </article>
            </div>

            <div class="invoice-search-detail-products">
                <div class="invoice-search-detail-section-title">
                    <div>
                        <span>SẢN PHẨM ĐÃ MUA</span>
                        <h4>Danh sách mặt hàng</h4>
                    </div>
                    <strong>${items.length} mặt hàng</strong>
                </div>
                <div class="invoice-search-detail-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Sản phẩm</th>
                                <th>Số lượng</th>
                                <th>Đơn giá</th>
                                <th>Giảm giá</th>
                                <th>Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>${productRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="invoice-search-detail-footer">
                <div class="invoice-search-detail-status">
                    <span>Trạng thái</span>
                    <strong>${invoiceSearchEscapeHTML(
                        invoiceSearchStatusText(invoice.status)
                    )}</strong>
                </div>
                <div class="invoice-search-detail-totals">
                    <div>
                        <span>Tạm tính</span>
                        <strong>${invoiceSearchFormatMoney(productSubtotal)}</strong>
                    </div>
                    <div>
                        <span>Giảm theo sản phẩm</span>
                        <strong>${invoiceSearchFormatMoney(productDiscount)}</strong>
                    </div>
                    ${legacyInvoiceDiscount > 0 ? `
                        <div>
                            <span>Giảm thêm hóa đơn</span>
                            <strong>${invoiceSearchFormatMoney(legacyInvoiceDiscount)}</strong>
                        </div>
                    ` : ""}
                    <div class="total">
                        <span>Thành tiền</span>
                        <strong>${invoiceSearchFormatMoney(
                            invoice.finalAmount ?? invoice.totalAmount
                        )}</strong>
                    </div>
                </div>
            </div>
        `;
    }


    async function viewInvoiceSearchDetail(
        invoiceId
    ) {

        if (!invoiceSearchHasPermission()) {

            if (
                typeof window.requirePermission ===
                "function"
            ) {

                window.requirePermission(
                    "invoice_search"
                );
            }

            return;
        }


        const invoiceSummary =
            invoiceSearchData.find(
                function (item) {

                    return item.id === invoiceId;

                }
            );


        if (!invoiceSummary) {

            alert(
                "Không tìm thấy hóa đơn."
            );

            return;
        }


        const detailBody = document.getElementById(
            "invoice-search-detail-body"
        );

        if (detailBody) {
            detailBody.innerHTML = `
                <div class="invoice-search-detail-loading">
                    <span></span>
                    Đang tải sản phẩm trong hóa đơn...
                </div>
            `;
        }

        openInvoiceSearchDetail();

        try {
            const invoice = await window.salesApi.invoices.get(
                invoiceId
            );
            renderInvoiceSearchDetail(invoice);
        } catch (error) {
            console.error("Không thể tải chi tiết hóa đơn:", error);

            if (detailBody) {
                detailBody.innerHTML = `
                    <div class="invoice-search-detail-error">
                        <strong>Không thể tải chi tiết hóa đơn</strong>
                        <span>${invoiceSearchEscapeHTML(
                            error.message || "Vui lòng thử lại sau."
                        )}</span>
                    </div>
                `;
            }
        }
    }


    /* =========================================================
       34.13. XÓA BỘ LỌC
       ========================================================= */

    function resetInvoiceSearch() {

        if (!invoiceSearchHasPermission()) {

            if (
                typeof window.requirePermission ===
                "function"
            ) {

                window.requirePermission(
                    "invoice_search"
                );
            }

            return;
        }


        const ids = [
            "invoice-search-input",
            "invoice-search-from-date",
            "invoice-search-to-date",
            "invoice-search-min-amount",
            "invoice-search-max-amount"
        ];


        ids.forEach(
            function (id) {

                const element =
                    document.getElementById(id);

                if (element) {
                    element.value = "";
                }
            }
        );


        const payment =
            document.getElementById(
                "invoice-search-payment"
            );

        if (payment) {
            payment.value = "";
        }


        const status =
            document.getElementById(
                "invoice-search-status"
            );

        if (status) {
            status.value = "";
        }


        filteredInvoiceSearchData =
            invoiceSearchData.slice();

        currentInvoiceSearchPage = 1;
        renderInvoiceSearchResults();
    }


    /* =========================================================
       34.14. ÁP DỤNG PHÂN QUYỀN
       ========================================================= */

    function applyInvoiceSearchPermission() {

        const container =
            document.getElementById(
                "invoice-search-filter-container"
            );


        if (!container) {
            return;
        }


        if (
            !invoiceSearchHasPermission()
        ) {

            container.style.display =
                "none";

            container.setAttribute(
                "aria-hidden",
                "true"
            );

            return;
        }


        container.style.display =
            "";

        container.removeAttribute(
            "aria-hidden"
        );
    }


    /* =========================================================
       34.15. CSS
       ========================================================= */

    function injectInvoiceSearchStyles() {

        if (
            document.getElementById(
                "invoice-search-filter-styles"
            )
        ) {
            return;
        }


        const style =
            document.createElement("style");


        style.id =
            "invoice-search-filter-styles";


        style.textContent = `

            #invoice-search-filter-container {
                width: 100%;
                margin: 24px 0;
            }

            .invoice-search-box {
                width: 100%;
                box-sizing: border-box;
                overflow: hidden;
                border: 1px solid #d7e0ec;
                border-radius: 18px;
                background: #ffffff;
                box-shadow: 0 12px 32px rgba(15, 23, 42, 0.07);
            }

            .invoice-search-title {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 20px;
                padding: 22px 24px;
                border-bottom: 1px solid #e2e8f0;
                background: linear-gradient(135deg, #fbfdff, #f4f7ff);
            }

            .invoice-search-heading {
                display: flex;
                min-width: 0;
                align-items: center;
                gap: 13px;
            }

            .invoice-search-heading-icon {
                display: inline-flex;
                flex: 0 0 42px;
                width: 42px;
                height: 42px;
                align-items: center;
                justify-content: center;
                border-radius: 12px;
                color: #ffffff;
                background: linear-gradient(135deg, #4f46e5, #2563eb);
                box-shadow: 0 7px 16px rgba(79, 70, 229, 0.22);
                font-size: 21px;
            }

            .invoice-search-title h3 {
                margin: 0;
                color: #172033;
                font-size: 19px;
                line-height: 1.3;
            }

            .invoice-search-title p {
                margin: 4px 0 0;
                color: #7b879a;
                font-size: 12px;
            }

            #invoice-search-result-count {
                display: inline-flex;
                flex: 0 0 auto;
                align-items: center;
                gap: 7px;
                padding: 8px 12px;
                border: 1px solid #dbe4f0;
                border-radius: 999px;
                color: #526077;
                background: #ffffff;
                font-size: 12px;
                font-weight: 700;
            }

            #invoice-search-result-count::before {
                content: "";
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #22c55e;
                box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
            }

            .invoice-search-form {
                display: grid;
                grid-template-columns: repeat(12, minmax(0, 1fr));
                gap: 16px;
                padding: 22px 24px 24px;
                border-bottom: 1px solid #e2e8f0;
                background: #ffffff;
            }

            .invoice-search-field {
                display: flex;
                grid-column: span 2;
                flex-direction: column;
                gap: 8px;
                min-width: 0;
            }

            .invoice-search-keyword {
                grid-column: span 4;
            }

            .invoice-search-field label {
                color: #3d4b61;
                font-size: 12px;
                font-weight: 700;
            }

            .invoice-search-field input,
            .invoice-search-field select {
                width: 100%;
                box-sizing: border-box;
                height: 46px;
                padding: 0 13px;
                border: 1px solid #cbd6e4;
                border-radius: 11px;
                color: #334155;
                background: #ffffff;
                outline: none;
                font: inherit;
                font-size: 13px;
                transition: border-color 0.18s ease, box-shadow 0.18s ease;
            }

            .invoice-search-field input:hover,
            .invoice-search-field select:hover {
                border-color: #9eacc0;
            }

            .invoice-search-field input:focus,
            .invoice-search-field select:focus {
                border-color: #6366f1;
                box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.11);
            }

            .invoice-search-secondary-row {
                display: flex;
                grid-column: 1 / -1;
                align-items: flex-end;
                justify-content: space-between;
                gap: 18px;
                margin-top: 2px;
                padding-top: 18px;
                border-top: 1px dashed #d7e0ec;
            }

            .invoice-search-amount-group {
                display: flex;
                min-width: 0;
                align-items: center;
                gap: 9px;
            }

            .invoice-search-group-label {
                margin-right: 4px;
                color: #3d4b61;
                font-size: 12px;
                font-weight: 700;
                white-space: nowrap;
            }

            .invoice-search-amount-control {
                display: flex;
                width: 210px;
                height: 44px;
                box-sizing: border-box;
                align-items: center;
                gap: 8px;
                padding: 0 11px;
                border: 1px solid #cbd6e4;
                border-radius: 11px;
                color: #738096;
                background: #ffffff;
                transition: border-color 0.18s ease, box-shadow 0.18s ease;
            }

            .invoice-search-amount-control:focus-within {
                border-color: #6366f1;
                box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.11);
            }

            .invoice-search-amount-control > span,
            .invoice-search-amount-control > b {
                flex: 0 0 auto;
                font-size: 11px;
                font-weight: 700;
            }

            .invoice-search-amount-control input {
                width: 100%;
                min-width: 0;
                height: 38px;
                padding: 0;
                border: 0 !important;
                color: #334155;
                background: transparent !important;
                outline: 0;
                box-shadow: none !important;
                font: inherit;
                font-size: 13px;
            }

            html:not([data-app-theme="dark"]) .main-content .invoice-search-amount-control input,
            html:not([data-app-theme="dark"]) .main-content .invoice-search-amount-control input:hover,
            html:not([data-app-theme="dark"]) .main-content .invoice-search-amount-control input:focus,
            html[data-app-theme="dark"] .main-content .invoice-search-amount-control input,
            html[data-app-theme="dark"] .main-content .invoice-search-amount-control input:hover,
            html[data-app-theme="dark"] .main-content .invoice-search-amount-control input:focus {
                border: 0 !important;
                border-radius: 0;
                background: transparent !important;
                box-shadow: none !important;
            }

            .invoice-search-amount-separator {
                color: #94a3b8;
            }

            .invoice-search-actions {
                display: flex;
                flex: 0 0 auto;
                align-items: center;
                gap: 10px;
            }

            .invoice-search-button,
            .invoice-search-reset-button {
                display: inline-flex;
                height: 44px;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 0 17px;
                border-radius: 11px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
            }

            .invoice-search-button {
                border: 1px solid #4f46e5;
                color: #ffffff;
                background: linear-gradient(135deg, #4f46e5, #2563eb);
                box-shadow: 0 7px 16px rgba(79, 70, 229, 0.2);
            }

            .invoice-search-reset-button {
                border: 1px solid #cbd6e4;
                color: #536176;
                background: #f8fafc;
            }

            .invoice-search-button:hover,
            .invoice-search-reset-button:hover {
                transform: translateY(-1px);
            }

            .invoice-search-reset-button:hover {
                border-color: #9eacc0;
                background: #f1f5f9;
            }

            .invoice-search-table-wrapper {
                width: 100%;
                overflow-x: auto;
                background: #ffffff;
            }

            .invoice-search-table {
                width: 100%;
                border-collapse: collapse;
            }

            .invoice-search-table th,
            .invoice-search-table td {
                padding: 14px 16px;
                border-right: 1px solid #d8e0eb;
                border-bottom: 1px solid #d8e0eb;
                text-align: left;
                white-space: nowrap;
            }

            .invoice-search-table th:last-child,
            .invoice-search-table td:last-child {
                border-right: 0;
            }

            .invoice-search-table th {
                color: #4a586e;
                background: #f5f8fc;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.04em;
                text-transform: uppercase;
            }

            .invoice-search-table td {
                color: #475569;
                font-size: 13px;
            }

            .invoice-search-table small {
                display: block;
                margin-top: 3px;
                color: #6b7280;
            }

            .invoice-search-view-button {
                padding: 7px 13px;
                border: 1px solid #c7d2fe;
                border-radius: 8px;
                color: #4338ca;
                background: #eef2ff;
                font-weight: 700;
                cursor: pointer;
            }

            body.invoice-search-detail-open {
                overflow: hidden;
            }

            .invoice-search-detail-modal {
                position: fixed;
                inset: 0;
                z-index: 1500;
                display: none;
                align-items: center;
                justify-content: center;
                width: 100vw;
                height: 100vh;
                height: 100dvh;
                box-sizing: border-box;
                padding: 24px;
                background: rgba(15, 23, 42, 0.64);
                backdrop-filter: blur(6px);
            }

            .invoice-search-detail-modal.active {
                display: flex;
            }

            .invoice-search-detail-dialog {
                display: flex;
                flex-direction: column;
                width: min(980px, 100%);
                max-height: min(820px, calc(100dvh - 48px));
                overflow: hidden;
                border: 1px solid rgba(99, 102, 241, 0.28);
                border-radius: 22px;
                background: #ffffff;
                box-shadow: 0 30px 80px rgba(15, 23, 42, 0.3);
                animation: invoiceDetailEnter 0.2s ease both;
            }

            @keyframes invoiceDetailEnter {
                from { opacity: 0; transform: translateY(12px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            .invoice-search-detail-header {
                flex: 0 0 auto;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
                padding: 22px 26px;
                color: #ffffff;
                background: linear-gradient(135deg, #4338ca, #2563eb);
            }

            .invoice-search-detail-header span {
                display: block;
                margin-bottom: 5px;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.14em;
                opacity: 0.78;
            }

            .invoice-search-detail-header h3 {
                margin: 0;
                font-size: 24px;
            }

            .invoice-search-detail-close {
                width: 42px;
                height: 42px;
                border: 1px solid rgba(255, 255, 255, 0.35);
                border-radius: 12px;
                color: #ffffff;
                background: rgba(255, 255, 255, 0.12);
                font-size: 26px;
                line-height: 1;
                cursor: pointer;
            }

            .invoice-search-detail-body {
                flex: 1 1 auto;
                min-height: 0;
                overflow-y: auto;
                padding: 24px 26px 28px;
            }

            .invoice-search-detail-meta {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 12px;
                margin-bottom: 22px;
            }

            .invoice-search-detail-meta article {
                min-width: 0;
                padding: 14px 16px;
                border: 1px solid #cbd5e1;
                border-radius: 13px;
                background: #f8fafc;
            }

            .invoice-search-detail-meta span,
            .invoice-search-detail-status span {
                display: block;
                margin-bottom: 5px;
                color: #64748b;
                font-size: 12px;
                font-weight: 700;
            }

            .invoice-search-detail-meta strong {
                display: block;
                overflow-wrap: anywhere;
                color: #172033;
                font-size: 14px;
            }

            .invoice-search-detail-products {
                overflow: hidden;
                border: 1px solid #aebbd0;
                border-radius: 15px;
            }

            .invoice-search-detail-section-title {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding: 15px 18px;
                border-bottom: 1px solid #aebbd0;
                background: linear-gradient(135deg, #f8faff, #eef4ff);
            }

            .invoice-search-detail-section-title span {
                color: #4f46e5;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.13em;
            }

            .invoice-search-detail-section-title h4 {
                margin: 3px 0 0;
                color: #172033;
                font-size: 17px;
            }

            .invoice-search-detail-section-title > strong {
                padding: 7px 10px;
                border-radius: 999px;
                color: #4338ca;
                background: #e0e7ff;
                font-size: 12px;
            }

            .invoice-search-detail-table-wrap {
                overflow-x: auto;
            }

            .invoice-search-detail-table-wrap table {
                width: 100%;
                min-width: 720px;
                border-collapse: collapse;
            }

            .invoice-search-detail-table-wrap th,
            .invoice-search-detail-table-wrap td {
                padding: 13px 15px;
                border-right: 1px solid #cbd5e1;
                border-bottom: 1px solid #cbd5e1;
                text-align: left;
            }

            .invoice-search-detail-table-wrap th:last-child,
            .invoice-search-detail-table-wrap td:last-child {
                border-right: 0;
            }

            .invoice-search-detail-table-wrap tbody tr:last-child td {
                border-bottom: 0;
            }

            .invoice-search-detail-table-wrap th {
                color: #475569;
                background: #f1f5f9;
                font-size: 11px;
                letter-spacing: 0.04em;
                text-transform: uppercase;
            }

            .invoice-search-detail-table-wrap td {
                color: #475569;
                font-size: 13px;
            }

            .invoice-search-detail-table-wrap td strong {
                color: #172033;
            }

            .invoice-search-detail-table-wrap td small {
                display: block;
                margin-top: 3px;
                color: #7c8aa0;
            }

            .invoice-search-detail-footer {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 24px;
                margin-top: 22px;
            }

            .invoice-search-detail-status strong {
                display: inline-flex;
                padding: 7px 11px;
                border-radius: 999px;
                color: #047857;
                background: #d1fae5;
                font-size: 12px;
            }

            .invoice-search-detail-totals {
                width: min(330px, 100%);
            }

            .invoice-search-detail-totals > div {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
                padding: 7px 0;
                color: #64748b;
                font-size: 13px;
            }

            .invoice-search-detail-totals strong {
                color: #172033;
            }

            .invoice-search-detail-totals .total {
                margin-top: 6px;
                padding-top: 13px;
                border-top: 1px solid #cbd5e1;
                color: #172033;
                font-size: 15px;
                font-weight: 800;
            }

            .invoice-search-detail-totals .total strong {
                color: #4f46e5;
                font-size: 21px;
            }

            .invoice-search-detail-loading,
            .invoice-search-detail-error,
            .invoice-search-detail-empty {
                padding: 40px 20px !important;
                text-align: center !important;
            }

            .invoice-search-detail-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                color: #64748b;
            }

            .invoice-search-detail-loading span {
                width: 20px;
                height: 20px;
                border: 3px solid #c7d2fe;
                border-top-color: #4f46e5;
                border-radius: 50%;
                animation: invoiceDetailSpin 0.75s linear infinite;
            }

            @keyframes invoiceDetailSpin {
                to { transform: rotate(360deg); }
            }

            .invoice-search-detail-error {
                display: flex;
                flex-direction: column;
                gap: 7px;
                color: #b91c1c;
            }

            .invoice-search-empty {
                text-align: center !important;
                padding: 30px !important;
                color: #6b7280;
            }

            .invoice-search-pagination {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                padding: 16px 24px 20px;
                background: #ffffff;
            }

            .invoice-search-pagination-info {
                color: #64748b;
                font-size: 13px;
                font-weight: 600;
            }

            .invoice-search-pagination-buttons {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
            }

            .invoice-search-page-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 36px;
                height: 36px;
                padding: 0 10px;
                border: 1px solid #cbd5e1;
                border-radius: 9px;
                background: #ffffff;
                color: #334155;
                font-weight: 700;
                cursor: pointer;
                transition:
                    color 0.2s ease,
                    border-color 0.2s ease,
                    background 0.2s ease,
                    transform 0.2s ease,
                    box-shadow 0.2s ease;
            }

            .invoice-search-page-button:hover:not(:disabled) {
                color: #ffffff;
                border-color: #4f46e5;
                background: #4f46e5;
                box-shadow: 0 6px 14px rgba(79, 70, 229, 0.2);
                transform: translateY(-1px);
            }

            .invoice-search-page-button.active {
                color: #ffffff;
                border-color: #4f46e5;
                background: linear-gradient(135deg, #4f46e5, #2563eb);
                box-shadow: 0 6px 14px rgba(79, 70, 229, 0.24);
            }

            .invoice-search-page-button:disabled {
                opacity: 0.45;
                cursor: not-allowed;
            }

            html[data-app-theme="dark"] .invoice-search-box {
                border-color: #3a4a61;
                background: #101b2d;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
            }

            html[data-app-theme="dark"] .invoice-search-title {
                border-bottom-color: #3a4a61;
                background: linear-gradient(135deg, #17243a, #121f33);
            }

            html[data-app-theme="dark"] .invoice-search-title h3 {
                color: #f1f5fb;
            }

            html[data-app-theme="dark"] .invoice-search-title p {
                color: #9cabc0;
            }

            html[data-app-theme="dark"] #invoice-search-result-count {
                color: #d8e2ef;
                border-color: #46566e;
                background: #0d1728;
            }

            html[data-app-theme="dark"] .invoice-search-form,
            html[data-app-theme="dark"] .invoice-search-table-wrapper,
            html[data-app-theme="dark"] .invoice-search-pagination {
                border-color: #3a4a61;
                background: #101b2d;
            }

            html[data-app-theme="dark"] .invoice-search-secondary-row {
                border-top-color: #3b4b62;
            }

            html[data-app-theme="dark"] .invoice-search-field label,
            html[data-app-theme="dark"] .invoice-search-group-label {
                color: #d8e2ef;
            }

            html[data-app-theme="dark"] .invoice-search-field input,
            html[data-app-theme="dark"] .invoice-search-field select,
            html[data-app-theme="dark"] .invoice-search-amount-control {
                color: #e5edf7;
                border-color: #46566e;
                background: #0d1728;
            }

            html[data-app-theme="dark"] .invoice-search-field input:focus,
            html[data-app-theme="dark"] .invoice-search-field select:focus,
            html[data-app-theme="dark"] .invoice-search-amount-control:focus-within {
                border-color: #818cf8;
                box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.13);
            }

            html[data-app-theme="dark"] .invoice-search-amount-control input {
                color: #e5edf7;
            }

            html[data-app-theme="dark"] .invoice-search-reset-button {
                color: #d7e1ef;
                border-color: #46566e;
                background: #17243a;
            }

            html[data-app-theme="dark"] .invoice-search-reset-button:hover {
                border-color: #63738c;
                background: #1c2b42;
            }

            html[data-app-theme="dark"] .invoice-search-table th {
                color: #bac7d9;
                border-color: #3a4a61;
                background: #17243a;
            }

            html[data-app-theme="dark"] .invoice-search-table td {
                color: #d6e0ed;
                border-color: #34445b;
                background: #101b2d;
            }

            html[data-app-theme="dark"] .invoice-search-table tbody tr:hover td {
                background: #16243a;
            }

            html[data-app-theme="dark"] .invoice-search-table small,
            html[data-app-theme="dark"] .invoice-search-pagination-info {
                color: #9cabc0;
            }

            html[data-app-theme="dark"] .invoice-search-view-button {
                color: #c7d2fe;
                border-color: #4b5687;
                background: #242c59;
            }

            html[data-app-theme="dark"] .invoice-search-page-button {
                color: #d8e2ef;
                border-color: #46566e;
                background: #142238;
            }

            @media (max-width: 1200px) {
                .invoice-search-form {
                    grid-template-columns: repeat(6, minmax(0, 1fr));
                }

                .invoice-search-keyword {
                    grid-column: span 6;
                }

                .invoice-search-date,
                .invoice-search-select {
                    grid-column: span 3;
                }

                .invoice-search-secondary-row {
                    align-items: stretch;
                    flex-direction: column;
                }

                .invoice-search-actions {
                    justify-content: flex-end;
                }
            }

            @media (max-width: 850px) {
                .invoice-search-form {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .invoice-search-keyword {
                    grid-column: 1 / -1;
                }

                .invoice-search-date,
                .invoice-search-select {
                    grid-column: span 1;
                }

                .invoice-search-amount-group {
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    width: 100%;
                }

                .invoice-search-group-label {
                    grid-column: 1 / -1;
                }

                .invoice-search-amount-control {
                    width: 100%;
                }
            }

            @media (max-width: 768px) {

                .invoice-search-title {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .invoice-search-actions {
                    width: 100%;
                    align-items: stretch;
                }

                .invoice-search-button,
                .invoice-search-reset-button {
                    flex: 1;
                }

                .invoice-search-pagination {
                    align-items: flex-start;
                    flex-direction: column;
                }

                .invoice-search-detail-modal {
                    padding: 12px;
                }

                .invoice-search-detail-dialog {
                    max-height: calc(100dvh - 24px);
                    border-radius: 16px;
                }

                .invoice-search-detail-header,
                .invoice-search-detail-body {
                    padding-left: 18px;
                    padding-right: 18px;
                }

                .invoice-search-detail-meta {
                    grid-template-columns: 1fr 1fr;
                }

                .invoice-search-detail-footer {
                    flex-direction: column;
                }

                .invoice-search-detail-totals {
                    width: 100%;
                }

            }

            @media (max-width: 560px) {
                .invoice-search-title,
                .invoice-search-form {
                    padding-left: 16px;
                    padding-right: 16px;
                }

                .invoice-search-form {
                    grid-template-columns: 1fr;
                }

                .invoice-search-keyword,
                .invoice-search-date,
                .invoice-search-select {
                    grid-column: span 1;
                }

                .invoice-search-amount-group {
                    grid-template-columns: 1fr;
                }

                .invoice-search-group-label,
                .invoice-search-amount-control,
                .invoice-search-amount-separator {
                    grid-column: span 1;
                }

                .invoice-search-amount-separator {
                    display: none;
                }

                .invoice-search-actions {
                    flex-direction: column;
                }

                .invoice-search-pagination {
                    padding-left: 16px;
                    padding-right: 16px;
                }
            }

        `;


        document.head.appendChild(style);
    }


    /* =========================================================
       34.16. KHỞI TẠO
       ========================================================= */

    function initInvoiceSearchFeature() {

        if (invoiceSearchInitializationPromise) {
            return invoiceSearchInitializationPromise;
        }

        invoiceSearchInitializationPromise =
            initializeInvoiceSearchFeature()
                .finally(function () {
                    invoiceSearchInitializationPromise = null;
                });

        return invoiceSearchInitializationPromise;
    }


    async function initializeInvoiceSearchFeature() {

        /*
            Đồng bộ user hiện tại nếu hệ thống có hàm.
        */

        if (
            typeof window.syncCurrentPermissionUser ===
            "function"
        ) {

            window.syncCurrentPermissionUser();
        }


        /*
            Tải quyền đã lưu nếu hệ thống có hàm.
        */

        if (
            typeof window.loadPermissionsFromAPI ===
            "function"
        ) {

            await window.loadPermissionsFromAPI();
        }


        /*
            Tạo CSS.
        */

        injectInvoiceSearchStyles();


        /*
            Tạo giao diện.
        */

        createInvoiceSearchUI();


        /*
            Áp dụng quyền.
        */

        applyInvoiceSearchPermission();


        /*
            Nếu không có quyền thì không gắn
            các sự kiện thao tác.
        */

        if (
            !invoiceSearchHasPermission()
        ) {

            return;
        }

        await reloadInvoiceSearchData();

        if (invoiceSearchEventsInitialized) {
            return;
        }

        invoiceSearchEventsInitialized = true;


        /*
            Nút tìm kiếm.
        */

        const searchButton =
            document.getElementById(
                "invoice-search-button"
            );


        if (searchButton) {

            searchButton.addEventListener(
                "click",
                filterInvoiceSearch
            );
        }


        /*
            Nút xóa bộ lọc.
        */

        const resetButton =
            document.getElementById(
                "invoice-search-reset-button"
            );


        if (resetButton) {

            resetButton.addEventListener(
                "click",
                resetInvoiceSearch
            );
        }


        /*
            Tìm kiếm khi nhập từ khóa.
        */

        const searchInput =
            document.getElementById(
                "invoice-search-input"
            );


        if (searchInput) {

            searchInput.addEventListener(
                "input",
                filterInvoiceSearch
            );
        }


        /*
            Lọc khi thay đổi ngày.
        */

        const fromDate =
            document.getElementById(
                "invoice-search-from-date"
            );

        const toDate =
            document.getElementById(
                "invoice-search-to-date"
            );


        if (fromDate) {

            fromDate.addEventListener(
                "change",
                filterInvoiceSearch
            );
        }


        if (toDate) {

            toDate.addEventListener(
                "change",
                filterInvoiceSearch
            );
        }


        /*
            Lọc phương thức thanh toán.
        */

        const payment =
            document.getElementById(
                "invoice-search-payment"
            );


        if (payment) {

            payment.addEventListener(
                "change",
                filterInvoiceSearch
            );
        }


        /*
            Lọc trạng thái.
        */

        const status =
            document.getElementById(
                "invoice-search-status"
            );


        if (status) {

            status.addEventListener(
                "change",
                filterInvoiceSearch
            );
        }


        /*
            Lọc khoảng tiền.
        */

        const minAmount =
            document.getElementById(
                "invoice-search-min-amount"
            );

        const maxAmount =
            document.getElementById(
                "invoice-search-max-amount"
            );


        if (minAmount) {

            minAmount.addEventListener(
                "input",
                filterInvoiceSearch
            );
        }


        if (maxAmount) {

            maxAmount.addEventListener(
                "input",
                filterInvoiceSearch
            );
        }


        const detailModal = document.getElementById(
            "invoice-search-detail-modal"
        );

        const detailClose = document.getElementById(
            "invoice-search-detail-close"
        );

        if (detailClose) {
            detailClose.addEventListener(
                "click",
                closeInvoiceSearchDetail
            );
        }

        if (detailModal) {
            detailModal.addEventListener("click", function (event) {
                if (event.target === detailModal) {
                    closeInvoiceSearchDetail();
                }
            });
        }

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeInvoiceSearchDetail();
            }
        });


        /*
            Hiển thị dữ liệu ban đầu.
        */

        renderInvoiceSearchResults();
    }


    /* =========================================================
       34.17. DOM READY
       ========================================================= */

    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initInvoiceSearchFeature
        );

    } else {

        initInvoiceSearchFeature();

    }

    document.addEventListener(
        "sales:invoice-created",
        reloadInvoiceSearchData
    );

    window.addEventListener(
        "auth:login",
        initInvoiceSearchFeature
    );

    window.refreshInvoiceSearchData =
        reloadInvoiceSearchData;

    window.initInvoiceSearchFeature =
        initInvoiceSearchFeature;


    console.log(
        "✓ Invoice Search / Filter loaded."
    );

})();
