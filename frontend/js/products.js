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
                    ${product.code}
                </span>
            </td>

            <td>
                <span class="product-name">
                    ${product.name}
                </span>
            </td>

            <td>
                <span class="product-category">
                    ${product.category}
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
                    ${product.unit}
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
                        class="product-action-button delete"
                        onclick="toggleProductStatus(${product.id})"
                    >
                        ${
                            product.isActive
                                ? "Ngừng"
                                : "Kích hoạt"
                        }
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
                isActive: true
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
                { code, name, category, purchasePrice, sellingPrice, unit }
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

    await loadProductsFromAPI();

    loadProductCategories();

    if (!productFiltersInitialized) {
        setupProductFilters();
        productFiltersInitialized = true;
    }

    renderProducts();

}
