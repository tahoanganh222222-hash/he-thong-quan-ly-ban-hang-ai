/* ============================================================
   PRODUCT MANAGEMENT - PART 5
   ============================================================ */


/*
 * ============================================================
 * DATA LOADED FROM REST API
 * ============================================================
 *
 * Danh sách được tải khi mở trang sản phẩm.
 */

let products = [];


/*
 * ============================================================
 * STATE
 * ============================================================
 */

let currentProductPage = 1;

const productsPerPage = 8;

let editingProductId = null;
let productFiltersInitialized = false;
let productImageData = null;
let productImageEventsInitialized = false;
let productDetailEventsInitialized = false;
let productDetailReturnFocus = null;
const productCategoryImageByName = new Map();

const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function escapeProductHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getProductImageSource(product) {
    if (product?.imageData) return product.imageData;
    return productCategoryImageByName.get(product?.category || "") ||
        "./assets/branding/sales-manager-logo.svg";
}

function updateProductImagePreview(product = null) {
    const preview = document.getElementById("product-image-preview");
    if (!preview) return;
    const category = document.getElementById("product-category")?.value || product?.category || "";
    preview.src = productImageData || getProductImageSource({ category });
}

function readProductImage(file) {
    if (!PRODUCT_IMAGE_TYPES.has(file.type)) {
        alert("Vui lòng chọn ảnh PNG, JPG hoặc WebP.");
        return;
    }
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
        alert("Kích thước ảnh không được vượt quá 2 MB.");
        return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
        productImageData = String(reader.result || "");
        updateProductImagePreview();
    });
    reader.addEventListener("error", () => alert("Không thể đọc tệp ảnh đã chọn."));
    reader.readAsDataURL(file);
}

function setupProductImageEditor() {
    if (productImageEventsInitialized) return;
    document.getElementById("product-image-input")?.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (file) readProductImage(file);
        event.target.value = "";
    });
    document.getElementById("product-image-remove")?.addEventListener("click", () => {
        productImageData = null;
        updateProductImagePreview();
    });
    document.getElementById("product-category")?.addEventListener("change", () => {
        if (!productImageData) updateProductImagePreview();
    });
    productImageEventsInitialized = true;
}

async function loadProductsFromAPI() {

    try {
        products = (
            await window.salesApi.products.list()
        ).sort(function (a, b) {
            return Number(b.id) - Number(a.id);
        });
    } catch (error) {
        products = [];
        console.error("Không thể tải danh sách sản phẩm:", error);
        if (error.status === 401) return;
        alert("Không thể tải dữ liệu sản phẩm từ máy chủ.");
    }
}


/*
 * ============================================================
 * FORMAT MONEY
 * ============================================================
 */

function formatProductMoney(value) {

    return new Intl.NumberFormat(
        "vi-VN"
    ).format(value) + " ₫";

}


/*
 * ============================================================
 * GET FILTERED PRODUCTS
 * ============================================================
 */

function getFilteredProducts() {

    const searchInput =
        document.getElementById(
            "product-search-input"
        );

    const categoryFilter =
        document.getElementById(
            "product-category-filter"
        );

    const statusFilter =
        document.getElementById(
            "product-status-filter"
        );


    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";


    const category =
        categoryFilter
            ? categoryFilter.value
            : "all";


    const status =
        statusFilter
            ? statusFilter.value
            : "all";


    return products.filter(product => {

        const matchesSearch =
            !search ||
            product.name
                .toLowerCase()
                .includes(search) ||
            product.code
                .toLowerCase()
                .includes(search);


        const matchesCategory =
            category === "all" ||
            product.category === category;


        const matchesStatus =
            status === "all" ||
            (
                status === "active" &&
                product.isActive
            ) ||
            (
                status === "inactive" &&
                !product.isActive
            );


        return (
            matchesSearch &&
            matchesCategory &&
            matchesStatus
        );

    });

}


/*
 * ============================================================
 * LOAD CATEGORY FILTER
 * ============================================================
 */

function loadProductCategories() {

    const select =
        document.getElementById(
            "product-category-filter"
        );


    if (!select) {
        return;
    }


    const currentValue =
        select.value;


    const categories =
        [
            ...new Set(
                products.map(
                    product =>
                        product.category
                )
            )
        ];


    select.innerHTML = `
        <option value="all">
            Tất cả danh mục
        </option>
    `;


    categories.forEach(category => {

        const option =
            document.createElement(
                "option"
            );

        option.value = category;

        option.textContent = category;

        select.appendChild(option);

    });


    if (
        categories.includes(
            currentValue
        )
    ) {

        select.value =
            currentValue;

    }

}


/*
 * ============================================================
 * RENDER PRODUCTS
 * ============================================================
 */

function renderProducts() {

    const tbody =
        document.getElementById(
            "product-table-body"
        );


    const countElement =
        document.getElementById(
            "product-count"
        );


    if (!tbody) {
        return;
    }


    const filteredProducts =
        getFilteredProducts();


    if (countElement) {

        countElement.textContent =
            `${filteredProducts.length} sản phẩm`;

    }


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                filteredProducts.length /
                productsPerPage
            )
        );


    if (
        currentProductPage >
        totalPages
    ) {

        currentProductPage =
            totalPages;

    }


    const startIndex =
        (
            currentProductPage - 1
        ) *
        productsPerPage;


    const pageProducts =
        filteredProducts.slice(
            startIndex,
            startIndex +
            productsPerPage
        );


    tbody.innerHTML = "";


    if (pageProducts.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="product-empty"
                >
                    Không tìm thấy sản phẩm phù hợp.
                </td>
            </tr>
        `;

        renderProductPagination(
            0,
            1
        );

        return;

    }


    pageProducts.forEach(product => {

        const row =
            document.createElement(
                "tr"
            );


        const statusClass =
            product.isActive
                ? "active"
                : "inactive";


        const statusText =
            product.isActive
                ? "Đang kinh doanh"
                : "Ngừng kinh doanh";


        row.innerHTML = `

            <td>
                <span class="product-code">
                    ${escapeProductHtml(product.code)}
                </span>
            </td>

            <td>
                <div
                    class="product-visual product-detail-trigger"
                    role="button"
                    tabindex="0"
                    onclick="openProductDetail(${product.id})"
                    onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProductDetail(${product.id}); }"
                    title="Xem chi tiết ${escapeProductHtml(product.name)}"
                    aria-label="Xem chi tiết sản phẩm ${escapeProductHtml(product.name)}"
                >
                    <span class="product-thumbnail-frame">
                        <img class="product-thumbnail" src="${escapeProductHtml(getProductImageSource(product))}" alt="" loading="lazy">
                    </span>
                    <span class="product-name-copy">
                        <strong>${escapeProductHtml(product.name)}</strong>
                        <small>${escapeProductHtml(product.code)}</small>
                    </span>
                    <span class="product-detail-arrow" aria-hidden="true">›</span>
                </div>
            </td>

            <td>
                <span class="product-category">
                    ${escapeProductHtml(product.category)}
                </span>
            </td>

            <td>
                <span class="product-price">
                    ${formatProductMoney(
                        product.purchasePrice
                    )}
                </span>
            </td>

            <td>
                <span class="product-price">
                    ${formatProductMoney(
                        product.sellingPrice
                    )}
                </span>
            </td>

            <td>
                <span class="product-unit">
                    ${escapeProductHtml(product.unit)}
                </span>
            </td>

            <td>
                <span
                    class="product-status ${statusClass}"
                >
                    ${statusText}
                </span>
            </td>

            <td>

                <div class="product-actions">

                    <button
                        class="product-action-button edit"
                        onclick="editProduct(${product.id})"
                    >
                        Sửa
                    </button>

                    <button
                        class="product-action-button toggle"
                        onclick="toggleProductStatus(${product.id})"
                    >
                        ${
                            product.isActive
                                ? "Ngừng"
                                : "Kích hoạt"
                        }
                    </button>

                    <button
                        class="product-action-button delete"
                        onclick="deleteProduct(${product.id})"
                    >
                        Xóa
                    </button>

                </div>

            </td>

        `;


        tbody.appendChild(row);

    });


    renderProductPagination(
        filteredProducts.length,
        totalPages
    );

}


/*
 * ============================================================
 * PAGINATION
 * ============================================================
 */

function renderProductPagination(
    totalItems,
    totalPages
) {

    const buttons =
        document.getElementById(
            "pagination-buttons"
        );


    const info =
        document.getElementById(
            "pagination-info"
        );


    if (!buttons || !info) {
        return;
    }


    if (totalItems === 0) {

        info.textContent =
            "Không có sản phẩm";

    } else {

        const start =
            (
                currentProductPage - 1
            ) *
            productsPerPage +
            1;


        const end =
            Math.min(
                currentProductPage *
                productsPerPage,
                totalItems
            );


        info.textContent =
            `Hiển thị ${start}-${end} / ${totalItems} sản phẩm`;

    }


    buttons.innerHTML = "";


    const previous =
        document.createElement(
            "button"
        );

    previous.className =
        "pagination-button";

    previous.textContent =
        "‹";

    previous.disabled =
        currentProductPage === 1;

    previous.onclick =
        function () {

            if (
                currentProductPage >
                1
            ) {

                currentProductPage--;

                renderProducts();

            }

        };


    buttons.appendChild(
        previous
    );


    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        const button =
            document.createElement(
                "button"
            );


        button.className =
            "pagination-button";


        if (
            page ===
            currentProductPage
        ) {

            button.classList.add(
                "active"
            );

        }


        button.textContent =
            page;


        button.onclick =
            function () {

                currentProductPage =
                    page;

                renderProducts();

            };


        buttons.appendChild(
            button
        );

    }


    const next =
        document.createElement(
            "button"
        );


    next.className =
        "pagination-button";

    next.textContent =
        "›";

    next.disabled =
        currentProductPage ===
        totalPages;


    next.onclick =
        function () {

            if (
                currentProductPage <
                totalPages
            ) {

                currentProductPage++;

                renderProducts();

            }

        };


    buttons.appendChild(
        next
    );

}


/*
 * ============================================================
 * OPEN ADD MODAL
 * ============================================================
 */

function openAddProductModal() {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("product_manage")
    ) {
        return;
    }

    editingProductId = null;


    document.getElementById(
        "product-modal-title"
    ).textContent =
        "Thêm sản phẩm";


    document.getElementById(
        "product-form"
    ).reset();

    productImageData = null;
    updateProductImagePreview();


    document.getElementById(
        "product-code"
    ).disabled = false;


    document.getElementById(
        "product-modal"
    ).classList.add(
        "active"
    );

}


/*
 * ============================================================
 * OPEN EDIT MODAL
 * ============================================================
 */

function editProduct(id) {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("product_manage")
    ) {
        return;
    }

    const product =
        products.find(
            item =>
                item.id === id
        );


    if (!product) {
        return;
    }


    editingProductId =
        id;


    document.getElementById(
        "product-modal-title"
    ).textContent =
        "Sửa sản phẩm";


    document.getElementById(
        "product-code"
    ).value =
        product.code;


    document.getElementById(
        "product-code"
    ).disabled =
        true;


    document.getElementById(
        "product-name"
    ).value =
        product.name;


    document.getElementById(
        "product-category"
    ).value =
        product.category;


    document.getElementById(
        "product-purchase-price"
    ).value =
        product.purchasePrice;


    document.getElementById(
        "product-selling-price"
    ).value =
        product.sellingPrice;


    document.getElementById(
        "product-unit"
    ).value =
        product.unit;

    productImageData = product.imageData || null;
    updateProductImagePreview(product);


    document.getElementById(
        "product-modal"
    ).classList.add(
        "active"
    );

}


/*
 * ============================================================
 * CLOSE MODAL
 * ============================================================
 */

function closeProductModal() {

    document.getElementById(
        "product-modal"
    ).classList.remove(
        "active"
    );


    editingProductId =
        null;

}


/*
 * ============================================================
 * SAVE PRODUCT
 * ============================================================
 */

async function saveProduct(event) {

    event.preventDefault();

    if (
        typeof requirePermission === "function" &&
        !requirePermission("product_manage")
    ) {
        return;
    }


    const code =
        document.getElementById(
            "product-code"
        ).value.trim();


    const name =
        document.getElementById(
            "product-name"
        ).value.trim();


    const category =
        document.getElementById(
            "product-category"
        ).value;


    const purchasePrice =
        Number(
            document.getElementById(
                "product-purchase-price"
            ).value
        );


    const sellingPrice =
        Number(
            document.getElementById(
                "product-selling-price"
            ).value
        );


    const unit =
        document.getElementById(
            "product-unit"
        ).value.trim();


    if (
        !code ||
        !name ||
        !category ||
        !unit
    ) {

        alert(
            "Vui lòng nhập đầy đủ thông tin sản phẩm."
        );

        return;

    }


    if (
        purchasePrice < 0 ||
        sellingPrice < 0
    ) {

        alert(
            "Giá sản phẩm không được nhỏ hơn 0."
        );

        return;

    }


    if (
        sellingPrice <
        purchasePrice
    ) {

        alert(
            "Giá bán không nên thấp hơn giá nhập."
        );

        return;

    }


    if (
        editingProductId === null
    ) {

        const duplicatedCode =
            products.some(
                product =>
                    product.code
                        .toLowerCase() ===
                    code.toLowerCase()
            );


        if (duplicatedCode) {

            alert(
                "Mã sản phẩm đã tồn tại."
            );

            return;

        }


        try {
            const createdProduct = await window.salesApi.products.create({
                code,
                name,
                category,
                purchasePrice,
                sellingPrice,
                unit,
                isActive: true,
                imageData: productImageData
            });
            products.unshift(createdProduct);
            currentProductPage = 1;
        } catch (error) {
            alert(error.message || "Không thể thêm sản phẩm.");
            return;
        }
        addHistory({
            action: "Thêm",
            actionType: "add",
            object: "Sản phẩm",
            code: code,
            detail: `Thêm sản phẩm mới: ${name}`
        });


    } else {

        const product =
            products.find(
                item =>
                    item.id ===
                    editingProductId
            );


        if (!product) {
            return;
        }

        try {
            const updatedProduct = await window.salesApi.products.update(
                editingProductId,
                { code, name, category, purchasePrice, sellingPrice, unit, imageData: productImageData }
            );
            products = products.map(item =>
                item.id === editingProductId ? updatedProduct : item
            );
        } catch (error) {
            alert(error.message || "Không thể cập nhật sản phẩm.");
            return;
        }
        addHistory({
            action: "Sửa",
            actionType: "edit",
            object: "Sản phẩm",
            code: product.code,
            detail: `Cập nhật thông tin sản phẩm: ${product.name}`
        });
    }
    closeProductModal();
    loadProductCategories();
    renderProducts();
}


/*
 * ============================================================
 * TOGGLE PRODUCT STATUS
 * ============================================================
 */

async function toggleProductStatus(id) {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("product_manage")
    ) {
        return;
    }

    const product =
        products.find(
            item =>
                item.id === id
        );


    if (!product) {
        return;
    }


    if (product.isActive) {

        const confirmed =
            confirm(
                `Bạn có chắc muốn ngừng kinh doanh sản phẩm "${product.name}"?`
            );


        if (!confirmed) {
            return;
        }

    }


    try {
        const updatedProduct = await window.salesApi.products.update(
            id,
            { isActive: !product.isActive }
        );
        Object.assign(product, updatedProduct);
        products = products.map(item =>
            item.id === id ? updatedProduct : item
        );
    } catch (error) {
        alert(error.message || "Không thể cập nhật trạng thái sản phẩm.");
        return;
    }
    addHistory({
    action: product.isActive
        ? "Kích hoạt"
        : "Ngừng",
    actionType: product.isActive
        ? "activate"
        : "deactivate",
    object: "Sản phẩm",
    code: product.code,
    detail: product.isActive
        ? `Kích hoạt lại sản phẩm: ${product.name}`
        : `Ngừng kinh doanh sản phẩm: ${product.name}`
    });

    renderProducts();

}


function getProductStockStatus(product) {

    const stock = Number(product?.stock || 0);
    const minimum = Number(product?.minimum || 0);

    if (stock <= 0) {
        return { key: "out", text: "Hết hàng" };
    }
    if (stock <= minimum) {
        return { key: "low", text: "Sắp hết hàng" };
    }
    return { key: "normal", text: "Đủ hàng" };
}


function openProductDetail(id) {

    const product = products.find(item => Number(item.id) === Number(id));
    const modal = document.getElementById("product-detail-modal");
    const content = document.getElementById("product-detail-content");

    if (!product || !modal || !content) {
        return;
    }

    const stockStatus = getProductStockStatus(product);
    const purchasePrice = Number(product.purchasePrice || 0);
    const sellingPrice = Number(product.sellingPrice || 0);
    const profit = sellingPrice - purchasePrice;

    content.innerHTML = `
        <div class="product-detail-showcase">
            <div class="product-detail-image-wrap">
                <img
                    src="${escapeProductHtml(getProductImageSource(product))}"
                    alt="${escapeProductHtml(product.name)}"
                >
            </div>
            <div class="product-detail-identity">
                <div class="product-detail-badges">
                    <span class="product-detail-code">${escapeProductHtml(product.code)}</span>
                    <span class="product-detail-business ${product.isActive ? "active" : "inactive"}">
                        ${product.isActive ? "Đang kinh doanh" : "Ngừng kinh doanh"}
                    </span>
                </div>
                <h3>${escapeProductHtml(product.name)}</h3>
                <p>${escapeProductHtml(product.category || "Chưa phân loại")} · Đơn vị ${escapeProductHtml(product.unit || "—")}</p>
                <div class="product-detail-selling-price">
                    <small>Giá bán hiện tại</small>
                    <strong>${formatProductMoney(sellingPrice)}</strong>
                </div>
            </div>
        </div>

        <div class="product-detail-grid">
            <article>
                <span>Giá nhập</span>
                <strong>${formatProductMoney(purchasePrice)}</strong>
            </article>
            <article>
                <span>Chênh lệch giá</span>
                <strong class="${profit >= 0 ? "positive" : "negative"}">${formatProductMoney(profit)}</strong>
            </article>
            <article>
                <span>Tồn kho hiện tại</span>
                <strong>${Number(product.stock || 0).toLocaleString("vi-VN")} ${escapeProductHtml(product.unit || "")}</strong>
            </article>
            <article>
                <span>Tồn tối thiểu</span>
                <strong>${Number(product.minimum || 0).toLocaleString("vi-VN")} ${escapeProductHtml(product.unit || "")}</strong>
            </article>
        </div>

        <div class="product-detail-stock ${stockStatus.key}">
            <span class="product-detail-stock-dot" aria-hidden="true"></span>
            <div>
                <small>Trạng thái kho</small>
                <strong>${stockStatus.text}</strong>
            </div>
        </div>
    `;

    productDetailReturnFocus = document.activeElement;
    modal.hidden = false;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("product-detail-open");
    document.getElementById("product-detail-close")?.focus();
}


function closeProductDetail() {

    const modal = document.getElementById("product-detail-modal");
    if (!modal || !modal.classList.contains("active")) {
        return;
    }

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    modal.hidden = true;
    document.body.classList.remove("product-detail-open");
    if (productDetailReturnFocus instanceof HTMLElement) {
        productDetailReturnFocus.focus();
    }
    productDetailReturnFocus = null;
}


function setupProductDetailModal() {

    if (productDetailEventsInitialized) {
        return;
    }

    const modal = document.getElementById("product-detail-modal");
    document.getElementById("product-detail-close")?.addEventListener(
        "click",
        closeProductDetail
    );
    modal?.addEventListener("click", event => {
        if (event.target === modal) {
            closeProductDetail();
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeProductDetail();
        }
    });
    productDetailEventsInitialized = true;
}

async function loadProductCategoryOptions() {
    const select = document.getElementById("product-category");
    if (!select || !window.salesApi?.categories) return;
    const currentValue = select.value;
    try {
        const categoryItems = await window.salesApi.categories.list();
        productCategoryImageByName.clear();
        select.innerHTML = '<option value="">Chọn danh mục</option>';
        categoryItems.forEach(category => {
            if (category.imageData) {
                productCategoryImageByName.set(category.name, category.imageData);
            }
            const option = document.createElement("option");
            option.value = category.name;
            option.textContent = category.name + (category.isActive ? "" : " (Ngừng hoạt động)");
            select.appendChild(option);
        });
        if ([...select.options].some(option => option.value === currentValue)) {
            select.value = currentValue;
        }
    } catch (error) {
        console.error("Không thể tải danh mục cho biểu mẫu sản phẩm:", error);
    }
}


async function deleteProduct(id) {
    if (
        typeof requirePermission === "function" &&
        !requirePermission("product_manage")
    ) {
        return;
    }
    const product = products.find(item => item.id === id);
    if (!product) return;
    const confirmed = confirm(
        `Xóa vĩnh viễn sản phẩm "${product.name}"? Sản phẩm đã có giao dịch sẽ không thể xóa.`
    );
    if (!confirmed) return;
    try {
        await window.salesApi.products.remove(id);
        products = products.filter(item => item.id !== id);
        loadProductCategories();
        renderProducts();
        alert("Đã xóa sản phẩm.");
    } catch (error) {
        alert(error.message || "Không thể xóa sản phẩm.");
    }
}


/*
 * ============================================================
 * SEARCH / FILTER
 * ============================================================
 */

function setupProductFilters() {

    const searchInput =
        document.getElementById(
            "product-search-input"
        );


    const categoryFilter =
        document.getElementById(
            "product-category-filter"
        );


    const statusFilter =
        document.getElementById(
            "product-status-filter"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function () {

                currentProductPage = 1;

                renderProducts();

            }
        );

    }


    if (categoryFilter) {

        categoryFilter.addEventListener(
            "change",
            function () {

                currentProductPage = 1;

                renderProducts();

            }
        );

    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            function () {

                currentProductPage = 1;

                renderProducts();

            }
        );

    }

}


/*
 * ============================================================
 * INITIALIZE PRODUCT MANAGEMENT
 * ============================================================
 */

async function initProductManagement() {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("product_manage")
    ) {
        return;
    }

    setupProductImageEditor();
    setupProductDetailModal();

    await loadProductsFromAPI();

    await loadProductCategoryOptions();

    loadProductCategories();

    if (!productFiltersInitialized) {
        setupProductFilters();
        productFiltersInitialized = true;
    }

    renderProducts();

}
