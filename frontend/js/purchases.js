let purchaseItems = [];

let purchaseProducts = [];

let purchaseHistoryRows = [];

let currentPurchaseHistoryPage = 1;

const PURCHASE_HISTORY_PAGE_SIZE = 6;

async function fetchPurchaseProducts() {

    try {
        purchaseProducts = (
            await window.salesApi.products.list()
        ).filter(product => product.isActive);
    } catch (error) {
        purchaseProducts = [];
        console.error("Không thể tải sản phẩm nhập hàng:", error);
        if (error.status === 401) return;
        alert("Không thể tải dữ liệu sản phẩm từ máy chủ.");
    }
}

function formatPurchaseMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " ₫";
}

function escapePurchaseHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getPurchaseProductImage(item) {
    const product = purchaseProducts.find(productItem =>
        Number(productItem.id) === Number(item?.productId) ||
        (item?.productCode && productItem.code === item.productCode) ||
        (item?.code && productItem.code === item.code)
    );
    return item?.productImageData || item?.imageData || product?.imageData ||
        "./assets/branding/sales-manager-logo.svg";
}

function normalizePurchaseText(value) {
    return String(value || "")
        .toLocaleLowerCase("vi")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
}

function localPurchaseDate() {
    const date = new Date();
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function displayPurchaseDate(value) {
    const [year, month, day] = String(value || "").slice(0, 10).split("-");
    return year && month && day ? `${day}/${month}/${year}` : "—";
}

async function fetchPurchaseHistory() {
    const body = document.getElementById("purchase-history-table-body");
    if (body) {
        body.innerHTML = '<tr><td colspan="9" class="purchase-history-empty">Đang tải lịch sử hàng nhập...</td></tr>';
    }
    try {
        purchaseHistoryRows = await window.salesApi.purchases.items();
    } catch (error) {
        purchaseHistoryRows = [];
        console.error("Không thể tải lịch sử hàng nhập:", error);
        renderPurchaseHistorySummary([]);
        const count = document.getElementById("purchase-history-count");
        if (count) count.textContent = "Không thể tải dữ liệu";
        if (body) body.innerHTML = `<tr><td colspan="9" class="purchase-history-empty">${escapePurchaseHTML(error.status === 401 ? "Phiên đăng nhập đã hết hạn." : error.message || "Không thể tải dữ liệu.")}</td></tr>`;
        renderPurchaseHistoryPagination(1, 0);
        return;
    }
    currentPurchaseHistoryPage = 1;
    renderPurchaseHistory();
}

function getFilteredPurchaseHistory() {
    const search = normalizePurchaseText(
        document.getElementById("purchase-history-search")?.value
    ).trim();
    const from = document.getElementById("purchase-history-from-date")?.value || "";
    const to = document.getElementById("purchase-history-to-date")?.value || "";

    if (from && to && from > to) return [];

    return purchaseHistoryRows.filter(row => {
        const date = row.purchaseDate || String(row.createdAt || "").slice(0, 10);
        const searchable = normalizePurchaseText([
            row.receiptCode,
            row.supplierName,
            row.productCode,
            row.productName,
            row.createdBy,
            row.username
        ].join(" "));
        return (!search || searchable.includes(search))
            && (!from || date >= from)
            && (!to || date <= to);
    });
}

function renderPurchaseHistorySummary(rows) {
    const receipts = new Set(rows.map(row => row.receiptId));
    const products = new Set(rows.map(row => row.productId));
    const quantity = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const value = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    document.getElementById("purchase-history-receipts").textContent =
        receipts.size.toLocaleString("vi-VN");
    document.getElementById("purchase-history-products").textContent =
        products.size.toLocaleString("vi-VN");
    document.getElementById("purchase-history-quantity").textContent =
        quantity.toLocaleString("vi-VN");
    document.getElementById("purchase-history-value").textContent =
        formatPurchaseMoney(value);
}

function createPurchaseHistoryPageButton(label, page, disabled, active) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    button.classList.toggle("active", active);
    button.setAttribute("aria-label", label === "‹" ? "Trang trước" : label === "›" ? "Trang sau" : `Trang ${page}`);
    if (active) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => {
        if (!disabled && page !== currentPurchaseHistoryPage) {
            currentPurchaseHistoryPage = page;
            renderPurchaseHistory();
        }
    });
    return button;
}

function renderPurchaseHistoryPagination(totalPages, totalRows) {
    const container = document.getElementById("purchase-history-pagination");
    if (!container) return;
    container.innerHTML = "";
    if (!totalRows) return;

    container.appendChild(createPurchaseHistoryPageButton(
        "‹", currentPurchaseHistoryPage - 1, currentPurchaseHistoryPage === 1, false
    ));
    const visibleCount = Math.min(5, totalPages);
    const first = Math.min(
        Math.max(currentPurchaseHistoryPage - 2, 1),
        Math.max(totalPages - visibleCount + 1, 1)
    );
    for (let page = first; page < first + visibleCount; page += 1) {
        container.appendChild(createPurchaseHistoryPageButton(
            String(page), page, false, page === currentPurchaseHistoryPage
        ));
    }
    container.appendChild(createPurchaseHistoryPageButton(
        "›", currentPurchaseHistoryPage + 1, currentPurchaseHistoryPage === totalPages, false
    ));
}

function renderPurchaseHistory() {
    const body = document.getElementById("purchase-history-table-body");
    const count = document.getElementById("purchase-history-count");
    if (!body || !count) return;

    const from = document.getElementById("purchase-history-from-date")?.value || "";
    const to = document.getElementById("purchase-history-to-date")?.value || "";
    const rows = getFilteredPurchaseHistory();
    renderPurchaseHistorySummary(rows);

    if (from && to && from > to) {
        body.innerHTML = '<tr><td colspan="9" class="purchase-history-empty">Ngày bắt đầu không được lớn hơn ngày kết thúc.</td></tr>';
        count.textContent = "Khoảng thời gian không hợp lệ";
        renderPurchaseHistoryPagination(1, 0);
        return;
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / PURCHASE_HISTORY_PAGE_SIZE));
    currentPurchaseHistoryPage = Math.min(Math.max(currentPurchaseHistoryPage, 1), totalPages);
    const start = (currentPurchaseHistoryPage - 1) * PURCHASE_HISTORY_PAGE_SIZE;
    const pageRows = rows.slice(start, start + PURCHASE_HISTORY_PAGE_SIZE);

    if (!pageRows.length) {
        body.innerHTML = '<tr><td colspan="9" class="purchase-history-empty">Không có hàng nhập phù hợp với bộ lọc.</td></tr>';
        count.textContent = "Không có dữ liệu";
        renderPurchaseHistoryPagination(1, 0);
        return;
    }

    body.innerHTML = pageRows.map((row, index) => `
        <tr>
            <td class="purchase-history-index">${start + index + 1}</td>
            <td class="purchase-history-date">${displayPurchaseDate(row.purchaseDate || row.createdAt)}</td>
            <td><strong class="purchase-history-code">${escapePurchaseHTML(row.receiptCode)}</strong></td>
            <td>${escapePurchaseHTML(row.supplierName || "—")}</td>
            <td>
                <div class="sales-product-cell purchase-history-product-cell">
                    <img
                        class="sales-product-thumbnail purchase-product-thumbnail"
                        src="${escapePurchaseHTML(getPurchaseProductImage(row))}"
                        alt="${escapePurchaseHTML(row.productName)}"
                        loading="lazy"
                    >
                    <div>
                        <strong class="purchase-history-product">${escapePurchaseHTML(row.productName)}</strong>
                        <small>${escapePurchaseHTML(row.productCode)}</small>
                    </div>
                </div>
            </td>
            <td class="purchase-history-quantity">${Number(row.quantity || 0).toLocaleString("vi-VN")} ${escapePurchaseHTML(row.unit || "")}</td>
            <td class="purchase-history-money">${formatPurchaseMoney(row.unitPrice)}</td>
            <td class="purchase-history-money total">${formatPurchaseMoney(row.amount)}</td>
            <td>
                <strong class="purchase-history-user">${escapePurchaseHTML(row.createdBy || "—")}</strong>
                <small>@${escapePurchaseHTML(row.username || "—")}</small>
            </td>
        </tr>
    `).join("");

    count.textContent = `Hiển thị ${start + 1}-${Math.min(start + PURCHASE_HISTORY_PAGE_SIZE, rows.length)} / ${rows.length} mặt hàng nhập`;
    renderPurchaseHistoryPagination(totalPages, rows.length);
}

function setupPurchaseHistoryFilters() {
    const search = document.getElementById("purchase-history-search");
    const from = document.getElementById("purchase-history-from-date");
    const to = document.getElementById("purchase-history-to-date");
    const clear = document.getElementById("purchase-history-clear-button");
    const today = document.getElementById("purchase-history-today-button");

    if (search && !search.dataset.initialized) {
        search.addEventListener("input", () => {
            currentPurchaseHistoryPage = 1;
            renderPurchaseHistory();
        });
        search.dataset.initialized = "true";
    }
    [from, to].forEach(input => {
        if (input && !input.dataset.initialized) {
            input.addEventListener("change", () => {
                currentPurchaseHistoryPage = 1;
                renderPurchaseHistory();
            });
            input.dataset.initialized = "true";
        }
    });
    if (clear && !clear.dataset.initialized) {
        clear.addEventListener("click", () => {
            if (search) search.value = "";
            if (from) from.value = "";
            if (to) to.value = "";
            currentPurchaseHistoryPage = 1;
            renderPurchaseHistory();
        });
        clear.dataset.initialized = "true";
    }
    if (today && !today.dataset.initialized) {
        today.addEventListener("click", () => {
            const date = localPurchaseDate();
            if (from) from.value = date;
            if (to) to.value = date;
            currentPurchaseHistoryPage = 1;
            renderPurchaseHistory();
        });
        today.dataset.initialized = "true";
    }
}

function generatePurchaseCode() {
    const now = new Date();

    const date =
        now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0");

    const random =
        Math.floor(Math.random() * 900 + 100);

    return `PN${date}${random}`;
}

function loadPurchaseProducts() {
    const select =
        document.getElementById("purchase-product-select");

    if (!select) {
        return;
    }

    select.innerHTML =
        '<option value="">-- Chọn sản phẩm --</option>';

    purchaseProducts.forEach(product => {
        const option =
            document.createElement("option");

        option.value = product.id;

        option.textContent =
            `${product.code} - ${product.name}`;

        select.appendChild(option);
    });
}

function addPurchaseProduct() {
    if (
        typeof requirePermission === "function" &&
        !requirePermission("purchase_track")
    ) {
        return;
    }

    const productSelect =
        document.getElementById("purchase-product-select");

    const quantityInput =
        document.getElementById("purchase-product-quantity");

    const priceInput =
        document.getElementById("purchase-product-price");

    if (!productSelect || !quantityInput || !priceInput) {
        return;
    }

    const productId =
        Number(productSelect.value);

    const quantity =
        Number(quantityInput.value);

    const unitPrice =
        Number(priceInput.value);

    if (!productId) {
        alert("Vui lòng chọn sản phẩm.");
        return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
        alert("Số lượng phải là số nguyên lớn hơn 0.");
        return;
    }

    if (unitPrice < 0 || Number.isNaN(unitPrice)) {
        alert("Giá nhập không hợp lệ.");
        return;
    }

    const product =
        purchaseProducts.find(
            item => item.id === productId
        );

    if (!product) {
        alert("Không tìm thấy sản phẩm.");
        return;
    }

    const existingItem =
        purchaseItems.find(
            item => item.productId === productId
        );

    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.unitPrice = unitPrice;
    } else {
        purchaseItems.push({
            productId: product.id,
            code: product.code,
            name: product.name,
            imageData: product.imageData,
            quantity: quantity,
            unitPrice: unitPrice
        });
    }

    renderPurchaseItems();
    updatePurchaseSummary();

    quantityInput.value = "1";
    priceInput.value = product.purchasePrice;
    productSelect.value = "";
}

function renderPurchaseItems() {
    const tbody =
        document.getElementById("purchase-items-body");

    if (!tbody) {
        return;
    }

    if (purchaseItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="purchase-empty">
                        Chưa có sản phẩm trong phiếu nhập.
                    </div>
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = purchaseItems.map(
        (item, index) => `
            <tr>
                <td>${index + 1}</td>

                <td>
                    <strong>${item.code}</strong>
                </td>

                <td>
                    <div class="sales-product-cell purchase-line-product-cell">
                        <img
                            class="sales-product-thumbnail purchase-product-thumbnail"
                            src="${escapePurchaseHTML(getPurchaseProductImage(item))}"
                            alt="${escapePurchaseHTML(item.name)}"
                        >
                        <strong>${escapePurchaseHTML(item.name)}</strong>
                    </div>
                </td>

                <td>
                    <input
                        type="number"
                        min="1"
                        class="purchase-quantity-input"
                        value="${item.quantity}"
                        onchange="updatePurchaseQuantity(
                            ${item.productId},
                            this.value
                        )"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        min="0"
                        class="purchase-price-input"
                        value="${item.unitPrice}"
                        onchange="updatePurchasePrice(
                            ${item.productId},
                            this.value
                        )"
                    >
                </td>

                <td>
                    ${formatPurchaseMoney(
                        item.quantity * item.unitPrice
                    )}
                </td>

                <td>
                    <button
                        type="button"
                        class="purchase-remove-button"
                        onclick="removePurchaseItem(
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

function updatePurchaseQuantity(productId, value) {
    if (
        typeof requirePermission === "function" &&
        !requirePermission("purchase_track")
    ) {
        return;
    }

    const quantity = Number(value);

    if (!Number.isInteger(quantity) || quantity <= 0) {
        alert("Số lượng phải lớn hơn 0.");
        renderPurchaseItems();
        return;
    }

    const item =
        purchaseItems.find(
            item => item.productId === productId
        );

    if (!item) {
        return;
    }

    item.quantity = quantity;

    renderPurchaseItems();
    updatePurchaseSummary();
}

function updatePurchasePrice(productId, value) {
    if (
        typeof requirePermission === "function" &&
        !requirePermission("purchase_track")
    ) {
        return;
    }

    const price = Number(value);

    if (Number.isNaN(price) || price < 0) {
        alert("Giá nhập không hợp lệ.");
        renderPurchaseItems();
        return;
    }

    const item =
        purchaseItems.find(
            item => item.productId === productId
        );

    if (!item) {
        return;
    }

    item.unitPrice = price;

    renderPurchaseItems();
    updatePurchaseSummary();
}

function removePurchaseItem(productId) {
    if (
        typeof requirePermission === "function" &&
        !requirePermission("purchase_track")
    ) {
        return;
    }

    purchaseItems =
        purchaseItems.filter(
            item => item.productId !== productId
        );

    renderPurchaseItems();
    updatePurchaseSummary();
}

function calculatePurchaseTotal() {
    return purchaseItems.reduce(
        (total, item) => {
            return total +
                item.quantity * item.unitPrice;
        },
        0
    );
}

function updatePurchaseSummary() {
    const total =
        calculatePurchaseTotal();

    const itemCount =
        purchaseItems.reduce(
            (count, item) =>
                count + item.quantity,
            0
        );

    const totalElement =
        document.getElementById(
            "purchase-total"
        );

    const countElement =
        document.getElementById(
            "purchase-item-count"
        );

    if (totalElement) {
        totalElement.textContent =
            formatPurchaseMoney(total);
    }

    if (countElement) {
        countElement.textContent =
            itemCount;
    }
}

async function createPurchaseReceipt() {
    if (
        typeof requirePermission === "function" &&
        !requirePermission("purchase_track")
    ) {
        return;
    }

    const supplierInput =
        document.getElementById(
            "purchase-supplier"
        );

    const supplier =
        supplierInput
            ? supplierInput.value.trim()
            : "";

    const purchaseDate =
        document.getElementById("purchase-date")?.value ||
        localPurchaseDate();

    if (!supplier) {
        alert("Vui lòng nhập tên nhà cung cấp.");
        return;
    }

    if (purchaseItems.length === 0) {
        alert("Phiếu nhập chưa có sản phẩm.");
        return;
    }

    const receiptCode =
        generatePurchaseCode();

    const total =
        calculatePurchaseTotal();

    const confirmed =
        confirm(
            `Xác nhận tạo phiếu nhập ${receiptCode}?\n\n` +
            `Nhà cung cấp: ${supplier}\n` +
            `Số sản phẩm: ${purchaseItems.length}\n` +
            `Tổng tiền: ${formatPurchaseMoney(total)}`
        );

    if (!confirmed) {
        return;
    }
    /* Ghi phiếu nhập và cập nhật tồn kho qua REST API. */
        try {
            await window.salesApi.purchases.create({
                receiptCode,
                supplierName: supplier,
                purchaseDate,
                items: purchaseItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice
                }))
            });
            await Promise.all([
                fetchPurchaseProducts(),
                fetchPurchaseHistory()
            ]);
        } catch (error) {
            alert(error.message || "Không thể tạo phiếu nhập.");
            return;
        }

        addHistory({
            action: "Thêm",
            actionType: "add",
            object: "Phiếu nhập",
            code: receiptCode,
            detail: `Tạo phiếu nhập ${receiptCode} từ nhà cung cấp ${supplier}, ${purchaseItems.length} sản phẩm, tổng tiền ${formatPurchaseMoney(total)}`
        });

        alert(
            `Tạo phiếu nhập ${receiptCode} thành công.`
        );
    renderPurchaseInventory();
    resetPurchaseForm();
}

function resetPurchaseForm() {
    purchaseItems = [];

    const supplierInput =
        document.getElementById(
            "purchase-supplier"
        );

    const productSelect =
        document.getElementById(
            "purchase-product-select"
        );

    const quantityInput =
        document.getElementById(
            "purchase-product-quantity"
        );

    const priceInput =
        document.getElementById(
            "purchase-product-price"
        );

    const dateInput =
        document.getElementById(
            "purchase-date"
        );

    if (supplierInput) {
        supplierInput.value = "";
    }

    if (productSelect) {
        productSelect.value = "";
    }

    if (quantityInput) {
        quantityInput.value = "1";
    }

    if (priceInput) {
        priceInput.value = "";
    }

    if (dateInput) {
        dateInput.value = localPurchaseDate();
    }

    renderPurchaseItems();
    updatePurchaseSummary();
}

function renderPurchaseInventory() {
    const tbody =
        document.getElementById(
            "purchase-inventory-body"
        );

    if (!tbody) {
        return;
    }

    tbody.innerHTML =
        purchaseProducts.map(product => {
            const stockClass =
                product.stock <= 10
                    ? "stock-low"
                    : "stock-normal";

            return `
                <tr>
                    <td>${escapePurchaseHTML(product.code)}</td>
                    <td>
                        <div class="sales-product-cell purchase-inventory-product-cell">
                            <img
                                class="sales-product-thumbnail purchase-product-thumbnail"
                                src="${escapePurchaseHTML(getPurchaseProductImage(product))}"
                                alt="${escapePurchaseHTML(product.name)}"
                                loading="lazy"
                            >
                            <span>${escapePurchaseHTML(product.name)}</span>
                        </div>
                    </td>
                    <td class="${stockClass}">
                        ${product.stock}
                    </td>
                </tr>
            `;
        }).join("");
}

function setupPurchaseProductSelect() {
    const select =
        document.getElementById(
            "purchase-product-select"
        );

    const priceInput =
        document.getElementById(
            "purchase-product-price"
        );

    if (!select || !priceInput) {
        return;
    }

    if (select.dataset.purchaseListenerAttached === "true") {
        return;
    }
    select.dataset.purchaseListenerAttached = "true";

    select.addEventListener(
        "change",
        function () {
            const productId =
                Number(this.value);

            const product =
                purchaseProducts.find(
                    item =>
                        item.id === productId
                );

            if (product) {
                priceInput.value =
                    product.purchasePrice;
            } else {
                priceInput.value = "";
            }
        }
    );
}

async function initPurchaseManagement() {
    if (
        typeof requirePermission === "function" &&
        !requirePermission("purchase_track")
    ) {
        return;
    }

    const dateInput = document.getElementById("purchase-date");
    if (dateInput && !dateInput.value) {
        dateInput.value = localPurchaseDate();
    }

    setupPurchaseHistoryFilters();

    await Promise.all([
        fetchPurchaseProducts(),
        fetchPurchaseHistory()
    ]);

    loadPurchaseProducts();
    renderPurchaseItems();
    updatePurchaseSummary();
    renderPurchaseInventory();
    setupPurchaseProductSelect();
}

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setupPurchaseHistoryFilters();

        const addButton =
            document.getElementById(
                "purchase-add-product-button"
            );

        const createButton =
            document.getElementById(
                "purchase-create-button"
            );

        const cancelButton =
            document.getElementById(
                "purchase-cancel-button"
            );

        if (addButton) {
            addButton.addEventListener(
                "click",
                addPurchaseProduct
            );
        }

        if (createButton) {
            createButton.addEventListener(
                "click",
                createPurchaseReceipt
            );
        }

        if (cancelButton) {
            cancelButton.addEventListener(
                "click",
                resetPurchaseForm
            );
        }
    }
);
