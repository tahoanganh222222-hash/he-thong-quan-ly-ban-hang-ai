/* =========================================================
   INVENTORY MANAGEMENT
   ========================================================= */

const inventoryData = [
    {
        code: "SP001",
        name: "Nước suối Aquafina 500ml",
        category: "Đồ uống",
        unit: "Chai",
        quantity: 8,
        minimum: 20
    },
    {
        code: "SP002",
        name: "Nước ngọt Coca Cola",
        category: "Đồ uống",
        unit: "Lon",
        quantity: 98,
        minimum: 20
    },
    {
        code: "SP003",
        name: "Bột giặt OMO 3kg",
        category: "Hàng gia dụng",
        unit: "Gói",
        quantity: 5,
        minimum: 15
    },
    {
        code: "SP004",
        name: "Quạt điện Senko",
        category: "Thiết bị điện",
        unit: "Cái",
        quantity: 3,
        minimum: 10
    },
    {
        code: "SP005",
        name: "Nồi cơm điện Sharp",
        category: "Thiết bị điện",
        unit: "Cái",
        quantity: 31,
        minimum: 10
    },
    {
        code: "SP006",
        name: "Giấy vệ sinh Pulppy",
        category: "Hàng gia dụng",
        unit: "Cuộn",
        quantity: 7,
        minimum: 20
    },
    {
        code: "SP007",
        name: "Mì Hảo Hảo",
        category: "Thực phẩm",
        unit: "Gói",
        quantity: 120,
        minimum: 30
    }
];


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


    tbody.innerHTML = "";


    filteredData.forEach(
        (item, index) => {

            const statusInfo =
                getInventoryStatus(item);

            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    ${index + 1}
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


    const info =
        document.getElementById(
            "inventory-pagination-info"
        );

    if (info) {

        info.textContent =
            filteredData.length > 0
                ? `Hiển thị ${filteredData.length} sản phẩm`
                : "Không có sản phẩm";

    }
}


/* =========================================================
   INIT
   ========================================================= */

function initInventoryManagement() {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("inventory_view")
    ) {
        return;
    }

    loadInventoryCategories();

    loadInventorySummary(
        inventoryData
    );

    loadInventoryTable();


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
            loadInventoryTable
        );

    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            loadInventoryTable
        );

    }


    if (categoryFilter) {

        categoryFilter.addEventListener(
            "change",
            loadInventoryTable
        );

    }


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            () => {

                searchInput.value = "";

                statusFilter.value = "all";

                categoryFilter.value = "all";

                loadInventorySummary(
                    inventoryData
                );

                loadInventoryTable();

            }
        );

    }

}