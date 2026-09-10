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

        existingItem.amount =
            existingItem.quantity *
            existingItem.unitPrice;
    } else {
        invoiceItems.push({
            productId: product.id,
            code: product.code,
            name: product.name,
            quantity,
            unitPrice: product.sellingPrice,
            amount:
                quantity *
                product.sellingPrice
        });
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
                        ${formatInvoiceMoney(
                            item.amount
                        )}
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

    item.amount =
        item.quantity *
        item.unitPrice;

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

function updateInvoiceSummary() {
    const totalAmount =
        calculateInvoiceTotal();

    const discountInput =
        document.getElementById(
            "invoice-discount"
        );

    const discount =
        Number(
            discountInput
                ? discountInput.value
                : 0
        ) || 0;

    const safeDiscount =
        Math.max(
            0,
            Math.min(
                discount,
                totalAmount
            )
        );

    const finalAmount =
        totalAmount - safeDiscount;

    const totalElement =
        document.getElementById(
            "invoice-total-amount"
        );

    const finalElement =
        document.getElementById(
            "invoice-final-amount"
        );

    if (totalElement) {
        totalElement.textContent =
            formatInvoiceMoney(totalAmount);
    }

    if (finalElement) {
        finalElement.textContent =
            formatInvoiceMoney(finalAmount);
    }

    if (
        discountInput &&
        Number(discountInput.value) !== safeDiscount
    ) {
        discountInput.value =
            safeDiscount;
    }
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

    const discountInput =
        document.getElementById(
            "invoice-discount"
        );

    const paymentMethod =
        document.querySelector(
            'input[name="invoice-payment"]:checked'
        );

    const customerId =
        customerSelect
            ? customerSelect.value
            : "";

    const totalAmount =
        calculateInvoiceTotal();

    const discount =
        Number(
            discountInput
                ? discountInput.value
                : 0
        ) || 0;

    const finalAmount =
        Math.max(
            0,
            totalAmount - discount
        );

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
            discount,
            paymentMethod: paymentMethod.value,
            items: invoiceItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: 0
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

    const discountInput =
        document.getElementById(
            "invoice-discount"
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

    if (discountInput) {
        discountInput.value = 0;
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

        const discountInput =
            document.getElementById(
                "invoice-discount"
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

        if (discountInput) {
            discountInput.addEventListener(
                "input",
                updateInvoiceSummary
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
                    <h3>Tìm kiếm và lọc hóa đơn</h3>
                    <span id="invoice-search-result-count">
                        Tìm thấy 0 hóa đơn
                    </span>
                </div>


                <div class="invoice-search-form">

                    <div class="invoice-search-field">
                        <label for="invoice-search-input">
                            Từ khóa
                        </label>

                        <input
                            type="text"
                            id="invoice-search-input"
                            placeholder="Mã hóa đơn, khách hàng, SĐT..."
                        >
                    </div>


                    <div class="invoice-search-field">
                        <label for="invoice-search-from-date">
                            Từ ngày
                        </label>

                        <input
                            type="date"
                            id="invoice-search-from-date"
                        >
                    </div>


                    <div class="invoice-search-field">
                        <label for="invoice-search-to-date">
                            Đến ngày
                        </label>

                        <input
                            type="date"
                            id="invoice-search-to-date"
                        >
                    </div>


                    <div class="invoice-search-field">
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


                    <div class="invoice-search-field">
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


                    <div class="invoice-search-field">
                        <label for="invoice-search-min-amount">
                            Giá trị từ
                        </label>

                        <input
                            type="number"
                            id="invoice-search-min-amount"
                            min="0"
                            placeholder="0"
                        >
                    </div>


                    <div class="invoice-search-field">
                        <label for="invoice-search-max-amount">
                            Giá trị đến
                        </label>

                        <input
                            type="number"
                            id="invoice-search-max-amount"
                            min="0"
                            placeholder="Không giới hạn"
                        >
                    </div>


                    <div class="invoice-search-actions">

                        <button
                            type="button"
                            id="invoice-search-button"
                            class="invoice-search-button"
                        >
                            Tìm kiếm
                        </button>

                        <button
                            type="button"
                            id="invoice-search-reset-button"
                            class="invoice-search-reset-button"
                        >
                            Xóa bộ lọc
                        </button>

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

    function viewInvoiceSearchDetail(
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


        const invoice =
            invoiceSearchData.find(
                function (item) {

                    return item.id === invoiceId;

                }
            );


        if (!invoice) {

            alert(
                "Không tìm thấy hóa đơn."
            );

            return;
        }


        alert(
            "Thông tin hóa đơn\n\n" +

            "Mã hóa đơn: " +
            invoice.code +

            "\nKhách hàng: " +
            (
                invoice.customerName ||
                "Khách lẻ"
            ) +

            "\nNgày: " +
            invoice.date +

            "\nTổng tiền: " +
            invoiceSearchFormatMoney(
                invoice.totalAmount
            ) +

            "\nThanh toán: " +
            invoiceSearchPaymentText(
                invoice.paymentMethod
            ) +

            "\nTrạng thái: " +
            invoiceSearchStatusText(
                invoice.status
            )
        );
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
                margin-top: 20px;
                margin-bottom: 20px;
            }

            .invoice-search-box {
                width: 100%;
                box-sizing: border-box;
                padding: 20px;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                background: #ffffff;
            }

            .invoice-search-title {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 15px;
                margin-bottom: 18px;
            }

            .invoice-search-title h3 {
                margin: 0;
                font-size: 18px;
            }

            #invoice-search-result-count {
                font-size: 13px;
                color: #6b7280;
            }

            .invoice-search-form {
                display: grid;
                grid-template-columns:
                    repeat(auto-fit, minmax(180px, 1fr));
                gap: 14px;
                margin-bottom: 20px;
            }

            .invoice-search-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .invoice-search-field label {
                font-size: 13px;
                font-weight: 600;
            }

            .invoice-search-field input,
            .invoice-search-field select {
                width: 100%;
                box-sizing: border-box;
                min-height: 38px;
                padding: 8px 10px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                background: #ffffff;
            }

            .invoice-search-actions {
                display: flex;
                align-items: flex-end;
                gap: 8px;
            }

            .invoice-search-button,
            .invoice-search-reset-button {
                min-height: 38px;
                padding: 8px 14px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
            }

            .invoice-search-reset-button {
                background: #e5e7eb;
            }

            .invoice-search-table-wrapper {
                width: 100%;
                overflow-x: auto;
            }

            .invoice-search-table {
                width: 100%;
                border-collapse: collapse;
            }

            .invoice-search-table th,
            .invoice-search-table td {
                padding: 10px;
                border-bottom: 1px solid #e5e7eb;
                text-align: left;
                white-space: nowrap;
            }

            .invoice-search-table th {
                font-weight: 600;
            }

            .invoice-search-table small {
                display: block;
                margin-top: 3px;
                color: #6b7280;
            }

            .invoice-search-view-button {
                padding: 6px 12px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
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
                padding-top: 16px;
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

            @media (max-width: 768px) {

                .invoice-search-title {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .invoice-search-actions {
                    align-items: stretch;
                    flex-direction: column;
                }

                .invoice-search-pagination {
                    align-items: flex-start;
                    flex-direction: column;
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
