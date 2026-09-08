let purchaseItems = [];

let purchaseProducts = [
    {
        id: 1,
        code: "SP001",
        name: "Nước suối 500ml",
        purchasePrice: 5000,
        stock: 120
    },
    {
        id: 2,
        code: "SP002",
        name: "Nước ngọt Coca Cola",
        purchasePrice: 9000,
        stock: 80
    },
    {
        id: 3,
        code: "SP003",
        name: "Bột giặt OMO",
        purchasePrice: 65000,
        stock: 35
    },
    {
        id: 4,
        code: "SP004",
        name: "Quạt điện",
        purchasePrice: 450000,
        stock: 12
    },
    {
        id: 5,
        code: "SP005",
        name: "Máy sấy tóc",
        purchasePrice: 280000,
        stock: 8
    },
    {
        id: 6,
        code: "SP006",
        name: "Ổ cắm điện",
        purchasePrice: 55000,
        stock: 25
    },
    {
        id: 7,
        code: "SP007",
        name: "Giấy vệ sinh",
        purchasePrice: 42000,
        stock: 50
    },
    {
        id: 8,
        code: "SP008",
        name: "Nước rửa chén",
        purchasePrice: 32000,
        stock: 40
    }
];

function formatPurchaseMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " ₫";
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
                <td colspan="6">
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
                    ${item.name}
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

function createPurchaseReceipt() {
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
    /*
     * Prototype:
     * Cập nhật tồn kho mock.
     * Chưa ghi database thật.
     */
        purchaseItems.forEach(item => {
            const product =
            purchaseProducts.find( product => product.id === item.productId);
        if (product) {
            product.stock += item.quantity;
        }
        });

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
                    <td>${product.code}</td>
                    <td>${product.name}</td>
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

function initPurchaseManagement() {
    if (
        typeof requirePermission === "function" &&
        !requirePermission("purchase_track")
    ) {
        return;
    }

    loadPurchaseProducts();
    renderPurchaseItems();
    updatePurchaseSummary();
    renderPurchaseInventory();
    setupPurchaseProductSelect();
}

document.addEventListener(
    "DOMContentLoaded",
    function () {

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