/* =========================================================
   INVENTORY MANAGEMENT
   ========================================================= */

let inventoryData = [];

let inventoryEventsInitialized = false;

const inventoryItemsPerPage = 5;

let currentInventoryPage = 1;

async function loadInventoryFromAPI() {

    try {
        inventoryData = await window.salesApi.inventory.list();
        currentInventoryPage = 1;
    } catch (error) {
        inventoryData = [];
        currentInventoryPage = 1;
        console.error("Không thể tải dữ liệu tồn kho:", error);
        if (error.status === 401) return;
        alert("Không thể tải dữ liệu tồn kho từ máy chủ.");
    }
}


/* =========================================================
   GET STATUS
   ========================================================= */

function getInventoryStatus(item) {

    if (item.quantity <= 0) {
        return {
            key: "out",
            text: "Hết hàng"
        };
    }

    if (item.quantity <= item.minimum) {
        return {
            key: "low",
            text: "Sắp hết hàng"
        };
    }

    return {
        key: "normal",
        text: "Đủ hàng"
    };
}


/* =========================================================
   LOAD CATEGORY FILTER
   ========================================================= */

function loadInventoryCategories() {

    const select =
        document.getElementById(
            "inventory-category-filter"
        );

    if (!select) {
        return;
    }

    const categories = [
        ...new Set(
            inventoryData.map(
                item => item.category
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
            document.createElement("option");

        option.value = category;
        option.textContent = category;

        select.appendChild(option);

    });
}


/* =========================================================
   LOAD SUMMARY
   ========================================================= */

function loadInventorySummary(data) {

    if (
        typeof hasCurrentUserPermission === "function" &&
        !hasCurrentUserPermission("inventory_view")
    ) {
        return;
    }

    const total =
        data.length;

    const normal =
        data.filter(
            item =>
                getInventoryStatus(item).key === "normal"
        ).length;

    const low =
        data.filter(
            item =>
                getInventoryStatus(item).key === "low"
        ).length;

    const out =
        data.filter(
            item =>
                getInventoryStatus(item).key === "out"
        ).length;


    document.getElementById(
        "inventory-total-products"
    ).textContent = total;

    document.getElementById(
        "inventory-normal-products"
    ).textContent = normal;

    document.getElementById(
        "inventory-low-products"
    ).textContent = low;

    document.getElementById(
        "inventory-out-products"
    ).textContent = out;
}


/* =========================================================
   LOAD TABLE
   ========================================================= */

function loadInventoryTable() {

    if (
        typeof hasCurrentUserPermission === "function" &&
        !hasCurrentUserPermission("inventory_view")
    ) {
        return;
    }

    const searchInput =
        document.getElementById(
            "inventory-search-input"
        );

    const statusFilter =
        document.getElementById(
            "inventory-status-filter"
        );

    const categoryFilter =
        document.getElementById(
            "inventory-category-filter"
        );

    const tbody =
        document.getElementById(
            "inventory-table-body"
        );

    if (!tbody) {
        return;
    }


    const keyword =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";

    const status =
        statusFilter
            ? statusFilter.value
            : "all";

    const category =
        categoryFilter
            ? categoryFilter.value
            : "all";


    const filteredData =
        inventoryData.filter(item => {

            const itemStatus =
                getInventoryStatus(item);

            const matchesSearch =
                item.code
                    .toLowerCase()
                    .includes(keyword) ||

                item.name
                    .toLowerCase()
                    .includes(keyword);

            const matchesStatus =
                status === "all" ||
                itemStatus.key === status;

            const matchesCategory =
                category === "all" ||
                item.category === category;

            return (
                matchesSearch &&
                matchesStatus &&
                matchesCategory
            );
        });


    const totalItems = filteredData.length;

    const totalPages = Math.max(
        1,
        Math.ceil(totalItems / inventoryItemsPerPage)
    );

    currentInventoryPage = Math.min(
        Math.max(currentInventoryPage, 1),
        totalPages
    );

    const startIndex =
        (currentInventoryPage - 1) *
        inventoryItemsPerPage;

    const pageData = filteredData.slice(
        startIndex,
        startIndex + inventoryItemsPerPage
    );

    tbody.innerHTML = "";

    if (totalItems === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="inventory-empty">
                    Không tìm thấy sản phẩm tồn kho phù hợp.
                </td>
            </tr>
        `;
    }


    pageData.forEach(
        (item, index) => {

            const statusInfo =
                getInventoryStatus(item);

            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    ${startIndex + index + 1}
                </td>

                <td>
                    <strong>
                        ${item.code}
                    </strong>
                </td>

                <td>
                    ${item.name}
                </td>

                <td>
                    ${item.category}
                </td>

                <td>
                    ${item.unit}
                </td>

                <td>
                    <strong>
                        ${item.quantity}
                    </strong>
                </td>

                <td>
                    ${item.minimum}
                </td>

                <td>
                    <span
                        class="inventory-status ${statusInfo.key}"
                    >
                        ${statusInfo.text}
                    </span>
                </td>

            `;

            tbody.appendChild(row);

        }
    );


    const count =
        document.getElementById(
            "inventory-count"
        );

    if (count) {

        count.textContent =
            `${filteredData.length} sản phẩm`;

    }


    renderInventoryPagination(
        totalItems,
        totalPages
    );
}


/* =========================================================
   PAGINATION
   ========================================================= */

function renderInventoryPagination(
    totalItems,
    totalPages
) {

    const info = document.getElementById(
        "inventory-pagination-info"
    );

    const buttons = document.getElementById(
        "inventory-pagination-buttons"
    );

    if (!info || !buttons) {
        return;
    }

    if (totalItems === 0) {
        info.textContent = "Không có sản phẩm";
        buttons.innerHTML = "";
        return;
    }

    const start =
        (currentInventoryPage - 1) *
        inventoryItemsPerPage + 1;

    const end = Math.min(
        currentInventoryPage * inventoryItemsPerPage,
        totalItems
    );

    info.textContent =
        `Hiển thị ${start}-${end} / ${totalItems} sản phẩm`;

    buttons.innerHTML = "";

    const createButton = function (
        label,
        targetPage,
        options = {}
    ) {

        const button = document.createElement("button");
        button.type = "button";
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
                targetPage === currentInventoryPage
            ) {
                return;
            }

            currentInventoryPage = targetPage;
            loadInventoryTable();
        });

        return button;
    };

    buttons.appendChild(
        createButton(
            "‹",
            currentInventoryPage - 1,
            {
                disabled: currentInventoryPage === 1,
                ariaLabel: "Trang tồn kho trước"
            }
        )
    );

    for (let page = 1; page <= totalPages; page++) {
        buttons.appendChild(
            createButton(
                String(page),
                page,
                {
                    active: page === currentInventoryPage
                }
            )
        );
    }

    buttons.appendChild(
        createButton(
            "›",
            currentInventoryPage + 1,
            {
                disabled: currentInventoryPage === totalPages,
                ariaLabel: "Trang tồn kho tiếp theo"
            }
        )
    );
}


function resetInventoryPageAndLoad() {
    currentInventoryPage = 1;
    loadInventoryTable();
}


/* =========================================================
   INIT
   ========================================================= */

async function initInventoryManagement() {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("inventory_view")
    ) {
        return;
    }

    await loadInventoryFromAPI();

    loadInventoryCategories();

    loadInventorySummary(
        inventoryData
    );

    loadInventoryTable();

    if (inventoryEventsInitialized) {
        return;
    }
    inventoryEventsInitialized = true;


    const searchInput =
        document.getElementById(
            "inventory-search-input"
        );

    const statusFilter =
        document.getElementById(
            "inventory-status-filter"
        );

    const categoryFilter =
        document.getElementById(
            "inventory-category-filter"
        );

    const refreshButton =
        document.getElementById(
            "inventory-refresh-button"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            resetInventoryPageAndLoad
        );

    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            resetInventoryPageAndLoad
        );

    }


    if (categoryFilter) {

        categoryFilter.addEventListener(
            "change",
            resetInventoryPageAndLoad
        );

    }


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                await loadInventoryFromAPI();

                searchInput.value = "";

                statusFilter.value = "all";

                categoryFilter.value = "all";

                loadInventoryCategories();

                loadInventorySummary(
                    inventoryData
                );

                currentInventoryPage = 1;
                loadInventoryTable();

            }
        );

    }

}
