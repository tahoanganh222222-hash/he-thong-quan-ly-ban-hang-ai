/* =========================================================
   INVENTORY MANAGEMENT
   ========================================================= */

let inventoryData = [];

let inventoryEventsInitialized = false;

const inventoryItemsPerPage = 6;

let currentInventoryPage = 1;

let inventoryMovements = [];

let inventoryEditingId = null;

let activeInventoryTrendProductId = null;

function escapeInventoryHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getInventoryProductImage(item) {
    return item?.imageData || "./assets/branding/sales-manager-logo.svg";
}

function inventoryDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "").slice(0, 10);
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function getInventoryLastSevenDays() {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() - (6 - index));
        return {
            key: inventoryDateKey(date),
            label: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
        };
    });
}

async function loadInventoryMovements() {
    inventoryMovements = [];
    try {
        const [purchaseResult, invoiceListResult] = await Promise.allSettled([
            window.salesApi.purchases.items(),
            window.salesApi.invoices.list()
        ]);
        if (purchaseResult.status === "fulfilled") {
            purchaseResult.value.forEach(row => inventoryMovements.push({
                date: inventoryDateKey(row.purchaseDate || row.createdAt),
                productId: Number(row.productId),
                delta: Number(row.quantity || 0)
            }));
        }
        if (invoiceListResult.status === "fulfilled") {
            const detailResults = await Promise.allSettled(
                invoiceListResult.value.map(invoice => window.salesApi.invoices.get(invoice.id))
            );
            detailResults.forEach(result => {
                if (result.status !== "fulfilled") return;
                const invoice = result.value;
                (invoice.items || []).forEach(item => inventoryMovements.push({
                    date: inventoryDateKey(invoice.date || invoice.createdAt),
                    productId: Number(item.productId),
                    delta: -Number(item.quantity || 0)
                }));
            });
        }
    } catch (error) {
        console.warn("Không thể tải biến động tồn kho:", error);
    }
}

async function loadInventoryFromAPI() {

    try {
        inventoryData = await window.salesApi.inventory.list();
        await loadInventoryMovements();
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

    const percent = value => value > 0 && total ? `${(value / total * 100).toFixed(1)}%` : "0%";
    const normalPercent = document.getElementById("inventory-normal-percent");
    const lowPercent = document.getElementById("inventory-low-percent");
    const outPercent = document.getElementById("inventory-out-percent");
    if (normalPercent) normalPercent.textContent = percent(normal);
    if (lowPercent) lowPercent.textContent = percent(low);
    if (outPercent) outPercent.textContent = percent(out);

    renderInventoryStatusChart({ total, normal, low, out });
    renderInventoryTrend();
}

function renderInventoryStatusChart(summary) {
    const donut = document.getElementById("inventory-status-donut");
    const totalElement = document.getElementById("inventory-donut-total");
    const legend = document.getElementById("inventory-status-legend");
    if (!donut || !legend) return;
    const total = summary.total || 0;
    const rows = [
        { label: "Đủ hàng", value: summary.normal, color: "#25bf7b" },
        { label: "Sắp hết hàng", value: summary.low, color: "#f4b400" },
        { label: "Hết hàng", value: summary.out, color: "#ff3d55" }
    ];
    let cursor = 0;
    const stops = rows.map(row => {
        const start = cursor;
        cursor += total ? row.value / total * 100 : 0;
        return `${row.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    donut.style.background = total ? `conic-gradient(${stops.join(",")})` : "#e2e8f0";
    if (totalElement) totalElement.textContent = total.toLocaleString("vi-VN");
    legend.innerHTML = rows.map(row => {
        const valuePercent = total ? (row.value / total * 100).toFixed(1) : "0.0";
        return `<div><i style="background:${row.color}"></i><span>${row.label}</span><strong>${row.value} (${valuePercent}%)</strong></div>`;
    }).join("");
}

function buildInventoryTrend(productId = null, metric = "stock") {
    const days = getInventoryLastSevenDays();
    const selected = productId === null
        ? inventoryData
        : inventoryData.filter(item => Number(item.productId || item.id) === Number(productId) || Number(item.id) === Number(productId));
    const currentQuantity = selected.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const allowedIds = new Set(selected.map(item => Number(item.productId || item.id)));
    const movements = inventoryMovements.filter(item =>
        days.some(day => day.key === item.date) && (productId === null || allowedIds.has(Number(item.productId)))
    );
    if (metric === "import" || metric === "export") {
        return days.map(day => ({
            ...day,
            value: movements
                .filter(item => item.date === day.key && (metric === "import" ? item.delta > 0 : item.delta < 0))
                .reduce((sum, item) => sum + Math.abs(item.delta), 0)
        }));
    }
    const movementTotal = movements.reduce((sum, item) => sum + item.delta, 0);
    let running = Math.max(0, currentQuantity - movementTotal);
    return days.map(day => {
        running = Math.max(0, running + movements
            .filter(item => item.date === day.key)
            .reduce((sum, item) => sum + item.delta, 0));
        return { ...day, value: running };
    });
}

function renderInventoryTrend(productId = activeInventoryTrendProductId, metric = null) {
    const chart = document.getElementById("inventory-trend-chart");
    const title = document.getElementById("inventory-trend-title");
    const metricSelect = document.getElementById("inventory-trend-metric");
    if (!chart) return;
    const selectedMetric = metric || metricSelect?.value || "stock";
    activeInventoryTrendProductId = productId;
    if (metricSelect) metricSelect.value = selectedMetric;
    const data = buildInventoryTrend(productId, selectedMetric);
    const selected = productId === null ? null : inventoryData.find(item => Number(item.id) === Number(productId) || Number(item.productId) === Number(productId));
    if (title) {
        const metricTitle = selectedMetric === "import"
            ? "Lượng nhập kho"
            : (selectedMetric === "export" ? "Lượng xuất kho" : "Biến động tồn kho");
        title.innerHTML = selected && selectedMetric === "stock"
            ? `Biến động: ${escapeInventoryHTML(selected.name)} <small>(7 ngày qua)</small>`
            : `${metricTitle} <small>(7 ngày qua)</small>`;
    }
    const width = 720;
    const height = 160;
    const left = 58;
    const right = 14;
    const top = 16;
    const bottom = 30;
    const maxValue = Math.max(...data.map(item => item.value), 1);
    const roughStep = maxValue * 1.12 / 4;
    const stepPower = 10 ** Math.floor(Math.log10(Math.max(roughStep, 1)));
    const chartStep = Math.max(1, Math.ceil(roughStep / stepPower) * stepPower);
    const chartMax = chartStep * 4;
    const compactValue = value => {
        if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}tr`;
        if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
        return Math.round(value).toLocaleString("vi-VN");
    };
    const x = index => left + index * ((width - left - right) / Math.max(data.length - 1, 1));
    const y = value => top + (chartMax - value) / chartMax * (height - top - bottom);
    const linePoints = data.map((item, index) => `${x(index)},${y(item.value)}`).join(" ");
    const areaPoints = `${left},${height - bottom} ${linePoints} ${x(data.length - 1)},${height - bottom}`;
    const ticks = [1, .75, .5, .25, 0].map(ratio => ({ value: Math.round(chartMax * ratio), y: y(chartMax * ratio) }));
    chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Biến động tồn kho 7 ngày">
        <defs><linearGradient id="inventory-area-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3181f5" stop-opacity=".27"/><stop offset="100%" stop-color="#3181f5" stop-opacity=".025"/></linearGradient></defs>
        ${ticks.map(tick => `<line class="inventory-chart-grid" x1="${left}" y1="${tick.y}" x2="${width - right}" y2="${tick.y}"/><text class="inventory-chart-label" x="1" y="${tick.y + 3}">${compactValue(tick.value)}</text>`).join("")}
        <polygon class="inventory-chart-area" points="${areaPoints}"/><polyline class="inventory-chart-line" points="${linePoints}"/>
        ${data.map((item, index) => `<circle class="inventory-chart-point" cx="${x(index)}" cy="${y(item.value)}" r="4"><title>${item.label}: ${item.value}</title></circle><text class="inventory-chart-label" x="${x(index)}" y="${height - 8}" text-anchor="middle">${item.label}</text>`).join("")}
    </svg>`;
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
                <td colspan="9" class="inventory-empty">
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
                        ${escapeInventoryHTML(item.code)}
                    </strong>
                </td>

                <td>
                    <div class="sales-product-cell inventory-product-cell">
                        <img
                            class="sales-product-thumbnail inventory-product-thumbnail"
                            src="${escapeInventoryHTML(getInventoryProductImage(item))}"
                            alt="${escapeInventoryHTML(item.name)}"
                            loading="lazy"
                        >
                        <span>${escapeInventoryHTML(item.name)}</span>
                    </div>
                </td>

                <td>
                    ${escapeInventoryHTML(item.category)}
                </td>

                <td>
                    ${escapeInventoryHTML(item.unit)}
                </td>

                <td>
                    <strong class="inventory-quantity ${statusInfo.key}">
                        ${Number(item.quantity || 0).toLocaleString("vi-VN")}
                    </strong>
                </td>

                <td>
                    ${Number(item.minimum || 0).toLocaleString("vi-VN")}
                </td>

                <td>
                    <span
                        class="inventory-status ${statusInfo.key}"
                    >
                        ${statusInfo.text}
                    </span>
                </td>

                <td>
                    <div class="inventory-row-actions">
                        <button type="button" class="inventory-row-action trend" data-inventory-action="trend" data-inventory-id="${item.id}" title="Xem biến động">⌁</button>
                        <button type="button" class="inventory-row-action edit" data-inventory-action="edit" data-inventory-id="${item.id}" title="Điều chỉnh tồn kho">✎</button>
                        <button type="button" class="inventory-row-action open" data-inventory-action="category" data-inventory-id="${item.id}" title="Lọc cùng danh mục">•••</button>
                    </div>
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

function closeInventoryAdjustment() {
    const modal = document.getElementById("inventory-adjust-modal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    inventoryEditingId = null;
    document.body.style.removeProperty("overflow");
}

function openInventoryAdjustment(id) {
    if (typeof requirePermission === "function" && !requirePermission("purchase_track")) return;
    const item = inventoryData.find(row => Number(row.id) === Number(id));
    const modal = document.getElementById("inventory-adjust-modal");
    if (!item || !modal) return;
    inventoryEditingId = item.id;
    const title = document.getElementById("inventory-adjust-title");
    const product = document.getElementById("inventory-adjust-product");
    const quantity = document.getElementById("inventory-adjust-quantity");
    const minimum = document.getElementById("inventory-adjust-minimum");
    if (title) title.textContent = item.name || "Cập nhật sản phẩm";
    if (product) product.innerHTML = `
        <img src="${escapeInventoryHTML(getInventoryProductImage(item))}" alt="">
        <div><strong>${escapeInventoryHTML(item.name)}</strong><small>${escapeInventoryHTML(item.code)} · ${escapeInventoryHTML(item.category)}</small></div>`;
    if (quantity) quantity.value = Number(item.quantity || 0);
    if (minimum) minimum.value = Number(item.minimum || 0);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => quantity?.focus(), 0);
}

async function saveInventoryAdjustment(event) {
    event.preventDefault();
    if (inventoryEditingId === null) return;
    const quantity = Number(document.getElementById("inventory-adjust-quantity")?.value);
    const minimum = Number(document.getElementById("inventory-adjust-minimum")?.value);
    if (!Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(minimum) || minimum < 0) {
        alert("Số lượng và mức tồn tối thiểu phải là số nguyên không âm.");
        return;
    }
    const submit = event.currentTarget.querySelector('[type="submit"]');
    if (submit) {
        submit.disabled = true;
        submit.textContent = "Đang lưu...";
    }
    try {
        await window.salesApi.inventory.update(inventoryEditingId, { quantity, minimum });
        await loadInventoryFromAPI();
        loadInventoryCategories();
        loadInventorySummary(inventoryData);
        loadInventoryTable();
        closeInventoryAdjustment();
    } catch (error) {
        alert(error.message || "Không thể cập nhật tồn kho.");
    } finally {
        if (submit) {
            submit.disabled = false;
            submit.textContent = "✓ Lưu thay đổi";
        }
    }
}

function handleInventoryTableAction(event) {
    const button = event.target.closest("[data-inventory-action]");
    if (!button) return;
    const item = inventoryData.find(row => Number(row.id) === Number(button.dataset.inventoryId));
    if (!item) return;
    if (button.dataset.inventoryAction === "trend") {
        renderInventoryTrend(item.id, "stock");
        document.querySelector(".inventory-trend-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (button.dataset.inventoryAction === "edit") {
        openInventoryAdjustment(item.id);
    } else if (button.dataset.inventoryAction === "category") {
        const category = document.getElementById("inventory-category-filter");
        if (category) {
            category.value = item.category;
            category.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }
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
                refreshButton.disabled = true;
                refreshButton.textContent = "↻ Đang tải...";
                try {
                    await loadInventoryFromAPI();
                    if (searchInput) searchInput.value = "";
                    if (statusFilter) statusFilter.value = "all";
                    if (categoryFilter) categoryFilter.value = "all";
                    loadInventoryCategories();
                    loadInventorySummary(inventoryData);
                    currentInventoryPage = 1;
                    loadInventoryTable();
                } finally {
                    refreshButton.disabled = false;
                    refreshButton.textContent = "↻ Làm mới";
                }

            }
        );

    }

    document.getElementById("inventory-table-body")?.addEventListener("click", handleInventoryTableAction);
    document.getElementById("inventory-trend-metric")?.addEventListener("change", event => {
        activeInventoryTrendProductId = null;
        renderInventoryTrend(null, event.target.value);
    });
    document.getElementById("inventory-adjust-form")?.addEventListener("submit", saveInventoryAdjustment);
    document.getElementById("inventory-adjust-close")?.addEventListener("click", closeInventoryAdjustment);
    document.getElementById("inventory-adjust-cancel")?.addEventListener("click", closeInventoryAdjustment);
    document.getElementById("inventory-adjust-modal")?.addEventListener("click", event => {
        if (event.target === event.currentTarget) closeInventoryAdjustment();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeInventoryAdjustment();
    });

}
