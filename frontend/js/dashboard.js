/* =========================================================
   DASHBOARD
   Data from REST API
   ========================================================= */

(function () {

    "use strict";

    const DEFAULT_REVENUE_PERIOD = "7";


    /* =========================================================
       DOANH THU TỪ API
       ========================================================= */

    let revenueData = [];


    /* =========================================================
       SẢN PHẨM BÁN CHẠY TỪ API
       ========================================================= */

    let topProductsData = [];


    /* =========================================================
       HÓA ĐƠN GẦN ĐÂY TỪ API
       ========================================================= */

    let recentInvoicesData = [];


    /* =========================================================
       CẢNH BÁO TỒN KHO TỪ API
       ========================================================= */

    let inventoryWarningData = [];

    let dashboardInvoices = [];
    let dashboardProductCount = 0;
    let dashboardCustomerCount = 0;
    let dashboardInitialized = false;
    let dashboardRefreshPromise = null;

    async function loadDashboardData() {

        try {
            const results =
                await Promise.allSettled([
                    window.salesApi.products.list(),
                    window.salesApi.customers.list(),
                    window.salesApi.invoices.list(),
                    window.salesApi.inventory.list()
                ]);

            const products =
                results[0].status === "fulfilled" ? results[0].value : [];
            const customers =
                results[1].status === "fulfilled" ? results[1].value : [];
            const invoices =
                results[2].status === "fulfilled" ? results[2].value : [];
            const inventory =
                results[3].status === "fulfilled" ? results[3].value : [];

            const failedRequests =
                results.filter(result => result.status === "rejected");

            if (failedRequests.length === results.length) {
                throw failedRequests[0].reason;
            }

            dashboardInvoices = invoices;
            dashboardProductCount = products.length;
            dashboardCustomerCount = customers.length;

            const revenueByDate = {};
            invoices.forEach(invoice => {
                revenueByDate[invoice.date] =
                    (revenueByDate[invoice.date] || 0) + invoice.finalAmount;
            });
            revenueData = Object.entries(revenueByDate).map(
                ([date, revenue]) => ({ date, revenue })
            );

            recentInvoicesData = invoices.slice(0, 4).map(invoice => ({
                code: invoice.code,
                customer: invoice.customerName,
                total: invoice.finalAmount,
                status: "Đã thanh toán"
            }));

            inventoryWarningData = inventory
                .filter(item => item.quantity <= item.minimum)
                .sort((a, b) => a.quantity - b.quantity)
                .map(item => ({
                    code: item.code,
                    name: item.name,
                    stock: item.quantity
                }));

            /*
             * Hiển thị KPI, doanh thu, hóa đơn gần đây và tồn kho
             * ngay khi dữ liệu danh sách đã sẵn sàng. Phần sản phẩm
             * bán chạy có thể tiếp tục tải chi tiết ở phía dưới.
             */
            renderDashboardOverview();

            const detailResults = await Promise.allSettled(
                invoices.map(invoice => window.salesApi.invoices.get(invoice.id))
            );
            const soldByProduct = new Map();
            detailResults.forEach(result => {
                if (result.status !== "fulfilled") {
                    return;
                }
                (result.value.items || []).forEach(item => {
                    const current = soldByProduct.get(item.productId) || 0;
                    soldByProduct.set(item.productId, current + item.quantity);
                });
            });
            topProductsData = products
                .map(product => ({
                    code: product.code,
                    name: product.name,
                    imageData: product.imageData,
                    quantity: soldByProduct.get(product.id) || 0
                }))
                .filter(product => product.quantity > 0)
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5);
        } catch (error) {
            console.error("Không thể tải dữ liệu dashboard:", error);
            throw error;
        }
    }


    /* =========================================================
       FORMAT MONEY
       ========================================================= */

    function formatMoney(value) {

        return Number(value || 0)
            .toLocaleString("vi-VN") + " ₫";
    }


    function escapeDashboardHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function getDashboardProductImage(product) {

        return product?.imageData ||
            "./assets/branding/sales-manager-logo.svg";
    }


    /* =========================================================
       GET ELEMENT
       ========================================================= */

    function getElement(id) {

        return document.getElementById(id);
    }


    /* =========================================================
       LỌC DOANH THU THEO THỜI GIAN
       ========================================================= */

    function getRevenueByPeriod(period) {

        if (period === "all") {

            return revenueData;
        }


        const days = Number(period);
        const now = new Date();
        const startDate = new Date(now);

        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - days + 1);

        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);


        return revenueData.filter(
            item => {

                const rawDate = String(item.date || "");
                const itemDate = new Date(
                    rawDate.includes("T")
                        ? rawDate
                        : `${rawDate}T00:00:00`
                );

                return (
                    itemDate >= startDate &&
                    itemDate <= endDate
                );
            }
        );
    }


    /* =========================================================
       TÍNH TỔNG DOANH THU
       ========================================================= */

    function calculateRevenue(data) {

        return data.reduce(
            (total, item) => {

                return total + item.revenue;

            },
            0
        );
    }


    /* =========================================================
       TẠO LABEL CHO BIỂU ĐỒ
       ========================================================= */

    function formatChartDate(date) {

        const d =
            new Date(date);

        return (
            String(d.getDate()).padStart(2, "0") +
            "/" +
            String(d.getMonth() + 1).padStart(2, "0")
        );
    }


    /* =========================================================
       RENDER BIỂU ĐỒ DOANH THU
       ========================================================= */

    function formatCompactRevenue(value) {

        const amount = Number(value || 0);
        const format = number => Number(number.toFixed(1))
            .toLocaleString("vi-VN");

        if (Math.abs(amount) >= 1_000_000_000) {
            return `${format(amount / 1_000_000_000)} tỷ`;
        }

        if (Math.abs(amount) >= 1_000_000) {
            return `${format(amount / 1_000_000)} tr`;
        }

        if (Math.abs(amount) >= 1_000) {
            return `${format(amount / 1_000)} nghìn`;
        }

        return amount.toLocaleString("vi-VN");
    }


    function createRevenueScale(maxValue, tickCount = 4) {

        if (maxValue <= 0) {
            return { max: 1, ticks: [1, 0.75, 0.5, 0.25, 0] };
        }

        const rawStep = maxValue / tickCount;
        const power = 10 ** Math.floor(Math.log10(rawStep));
        const fraction = rawStep / power;
        const niceFraction =
            fraction <= 1 ? 1 :
            fraction <= 2 ? 2 :
            fraction <= 5 ? 5 : 10;
        const step = niceFraction * power;
        const max = step * tickCount;

        return {
            max,
            ticks: Array.from(
                { length: tickCount + 1 },
                (_, index) => max - index * step
            )
        };
    }


    function renderRevenueChart(data) {

        const chart = getElement("revenue-chart");
        if (!chart) return;

        if (!data || data.length === 0) {
            chart.innerHTML = `
                <div class="dashboard-chart-empty">
                    <span>⌁</span>
                    <strong>Chưa có dữ liệu doanh thu</strong>
                    <small>Doanh thu sẽ xuất hiện khi có hóa đơn trong khoảng đã chọn.</small>
                </div>
            `;
            return;
        }

        const sortedData = [...data].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );
        const maxRevenue = Math.max(
            ...sortedData.map(item => Number(item.revenue) || 0)
        );
        const scale = createRevenueScale(maxRevenue);
        const gridLines = scale.ticks.map(
            (_, index) => `
                <span style="top: ${(index / (scale.ticks.length - 1)) * 100}%"></span>
            `
        ).join("");

        chart.innerHTML = `
            <div class="dashboard-chart-layout">
                <div class="dashboard-chart-y-axis" aria-hidden="true">
                    ${scale.ticks.map(value => `
                        <span>${formatCompactRevenue(value)}</span>
                    `).join("")}
                </div>

                <div class="dashboard-chart-scroll">
                    <div
                        class="dashboard-chart-stage"
                        style="--chart-columns: ${sortedData.length}"
                    >
                        <div class="dashboard-chart-grid" aria-hidden="true">
                            ${gridLines}
                        </div>

                        <div class="dashboard-chart-columns">
                            ${sortedData.map(item => {
                                const revenue = Number(item.revenue) || 0;
                                const height = Math.max(
                                    (revenue / scale.max) * 100,
                                    revenue > 0 ? 2 : 0
                                );
                                return `
                                    <div
                                        class="dashboard-chart-column"
                                        title="${formatChartDate(item.date)}: ${formatMoney(revenue)}"
                                    >
                                        <strong class="dashboard-chart-value">
                                            ${formatCompactRevenue(revenue)}
                                        </strong>
                                        <div class="dashboard-chart-bar-track">
                                            <span
                                                class="dashboard-chart-bar"
                                                style="height: ${height}%"
                                            ></span>
                                        </div>
                                        <span class="dashboard-chart-date">
                                            ${formatChartDate(item.date)}
                                        </span>
                                    </div>
                                `;
                            }).join("")}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }


    /* =========================================================
       UPDATE DOANH THU
       ========================================================= */

function updateRevenue(period) {

    const data =
        getRevenueByPeriod(period);


    const total =
        calculateRevenue(data);


    const totalElement =
        getElement("week-revenue");


    if (totalElement) {

        totalElement.textContent =
            formatMoney(total);
    }

    const description = getElement(
        "revenue-period-description"
    );

    if (description) {
        const descriptions = {
            "1": "Tổng quan doanh thu hôm nay",
            "7": "Tổng quan doanh thu trong 7 ngày gần nhất",
            "30": "Tổng quan doanh thu trong 30 ngày gần nhất",
            "365": "Tổng quan doanh thu trong 1 năm gần nhất",
            all: "Tổng quan toàn bộ doanh thu"
        };

        description.textContent =
            descriptions[period] || descriptions["7"];
    }


    renderRevenueChart(data);
}


    /* =========================================================
       LOAD KPI
       ========================================================= */

    function loadStatistics() {

        const dateKey = date =>
            date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0") + "-" +
            String(date.getDate()).padStart(2, "0");

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const todayKey = dateKey(today);
        const yesterdayKey = dateKey(yesterday);

        const todayData =
            revenueData.find(
                item =>
                    item.date === todayKey
            );


        const yesterdayData =
            revenueData.find(
                item =>
                    item.date === yesterdayKey
            );


        const todayRevenue =
            todayData
                ? todayData.revenue
                : 0;


        const yesterdayRevenue =
            yesterdayData
                ? yesterdayData.revenue
                : 0;


        const revenueElement =
            getElement("today-revenue");


        if (revenueElement) {

            revenueElement.textContent =
                formatMoney(todayRevenue);
        }


        const changeElement =
            getElement("revenue-change");


        if (changeElement) {

            let change = 0;


            if (yesterdayRevenue > 0) {

                change =
                    (
                        (todayRevenue - yesterdayRevenue) /
                        yesterdayRevenue
                    ) * 100;
            }


            changeElement.textContent =
                `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
        }


        const invoicesElement =
            getElement("today-invoices");


        if (invoicesElement) {

            invoicesElement.textContent =
                dashboardInvoices.filter(
                    invoice => invoice.date === todayKey
                ).length;
        }


        const productsElement =
            getElement("total-products");


        if (productsElement) {

            productsElement.textContent =
                dashboardProductCount;
        }


        const customersElement =
            getElement("total-customers");


        if (customersElement) {

            customersElement.textContent =
                dashboardCustomerCount;
        }
    }


    /* =========================================================
       LOAD TOP PRODUCTS
       ========================================================= */

    function loadTopProducts() {

        const container =
            getElement("top-products");


        if (!container) {
            return;
        }


        if (topProductsData.length === 0) {
            container.innerHTML = `
                <div class="dashboard-empty-state">
                    Chưa có dữ liệu sản phẩm bán chạy
                </div>
            `;
            return;
        }

        const highestQuantity = Math.max(
            ...topProductsData.map(product => Number(product.quantity) || 0),
            1
        );

        container.innerHTML = topProductsData.map((product, index) => {
            const quantity = Number(product.quantity) || 0;
            const progress = Math.max(3, (quantity / highestQuantity) * 100);

            return `
                <article class="top-product-item">
                    <span class="top-product-rank">${index + 1}</span>

                    <div class="top-product-main">
                        <img
                            class="sales-product-thumbnail top-product-thumbnail"
                            src="${escapeDashboardHtml(getDashboardProductImage(product))}"
                            alt="${escapeDashboardHtml(product.name)}"
                            loading="lazy"
                        >

                        <div class="top-product-content">
                            <div class="top-product-heading">
                                <strong title="${escapeDashboardHtml(product.name)}">
                                    ${escapeDashboardHtml(product.name)}
                                </strong>
                                <span>${escapeDashboardHtml(product.code)}</span>
                            </div>

                            <div class="top-product-progress" aria-hidden="true">
                                <span style="width: ${progress}%"></span>
                            </div>
                        </div>
                    </div>

                    <div class="top-product-sales">
                        <strong>${quantity.toLocaleString("vi-VN")}</strong>
                        <span>đã bán</span>
                    </div>
                </article>
            `;
        }).join("");
    }


    /* =========================================================
       LOAD RECENT INVOICES
       ========================================================= */

    function loadRecentInvoices() {

        const tbody =
            getElement("recent-invoices");


        if (!tbody) {
            return;
        }


        tbody.innerHTML = "";


        recentInvoicesData.forEach(
            invoice => {

                const row =
                    document.createElement("tr");


                row.innerHTML = `

                    <td>
                        ${invoice.code}
                    </td>

                    <td>
                        ${invoice.customer}
                    </td>

                    <td>
                        ${formatMoney(invoice.total)}
                    </td>

                    <td>
                        ${invoice.status}
                    </td>

                `;


                tbody.appendChild(row);
            }
        );

        if (recentInvoicesData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="dashboard-empty-state">
                        Chưa có hóa đơn
                    </td>
                </tr>
            `;
        }
    }


    /* =========================================================
       LOAD INVENTORY WARNING
       ========================================================= */

    function loadInventoryWarnings() {

        const container =
            getElement(
                "inventory-warning-list"
            );


        if (!container) {
            return;
        }


        container.innerHTML = "";


        inventoryWarningData.forEach(
            product => {

                const item =
                    document.createElement("div");

                item.className =
                    "inventory-warning-item";


                item.innerHTML = `

                    <div>
                        <strong>
                            ${product.name}
                        </strong>

                        <small>
                            ${product.code}
                        </small>
                    </div>

                    <span>
                        Còn ${product.stock}
                    </span>

                `;


                container.appendChild(item);
            }
        );

        if (inventoryWarningData.length === 0) {
            container.innerHTML = `
                <div class="dashboard-empty-state">
                    Không có sản phẩm dưới mức tồn kho tối thiểu
                </div>
            `;
        }
    }


    /* =========================================================
       LIÊN KẾT CÁC NÚT AI
       ========================================================= */

    function initAIActions() {

    const aiActions =
        document.querySelectorAll(".ai-action");


    if (!aiActions.length) {
        return;
    }


    // AI01 - Tư vấn sản phẩm
    if (aiActions[0]) {

        aiActions[0].addEventListener(
            "click",
            function () {

                if (
                    typeof window.showAIProductPage ===
                    "function"
                ) {

                    window.showAIProductPage();

                }

            }
        );
    }


    // AI02 - Báo cáo doanh thu
    if (aiActions[1]) {

        aiActions[1].addEventListener(
            "click",
            function () {

                if (
                    typeof window.showAIRevenuePage ===
                    "function"
                ) {

                    window.showAIRevenuePage();

                }
            }
        );
    }


    // AI03 - Hỏi đáp dữ liệu
    if (aiActions[2]) {

        aiActions[2].addEventListener(
            "click",
            function () {

                if (
                    typeof window.showAIQAPage ===
                    "function"
                ) {

                    window.showAIQAPage();

                }
            }
        );
    }
}


    function initDashboardActions() {

        const activateMenuItem = function (page) {
            const targetMenu = document.querySelector(
                `.menu-item[data-page="${page}"]`
            );

            if (!targetMenu) {
                return false;
            }

            document.querySelectorAll(".menu-item").forEach(
                item => item.classList.remove("active")
            );
            targetMenu.classList.add("active");
            return true;
        };

        const openDashboardTarget = function (target) {
            if (target === "invoice-list") {
                if (
                    typeof window.hasCurrentUserPermission ===
                        "function" &&
                    !window.hasCurrentUserPermission(
                        "invoice_search"
                    )
                ) {
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

                if (
                    typeof window.showInvoiceListPage ===
                    "function"
                ) {
                    activateMenuItem("invoices");
                    window.showInvoiceListPage();
                }
                return;
            }

            const menuItem = document.querySelector(
                `.menu-item[data-page="${target}"]`
            );

            if (menuItem) {
                menuItem.click();
            }
        };

        document.querySelectorAll(
            ".dashboard-shortcut[data-dashboard-target]"
        ).forEach(card => {
            const openCardTarget = function () {
                openDashboardTarget(
                    card.dataset.dashboardTarget
                );
            };

            card.addEventListener("click", openCardTarget);
            card.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCardTarget();
                }
            });
        });

        const viewAllInvoices =
            getElement("dashboard-view-all-invoices");

        if (viewAllInvoices) {
            viewAllInvoices.addEventListener(
                "click",
                function () {
                    openDashboardTarget("invoice-list");
                }
            );
        }
    }


    /* =========================================================
       INIT DASHBOARD
       ========================================================= */

    function renderDashboardOverview() {

        loadStatistics();
        loadRecentInvoices();
        loadInventoryWarnings();

        const periodSelect = getElement(
            "revenue-period"
        );

        updateRevenue(
            periodSelect ? periodSelect.value : DEFAULT_REVENUE_PERIOD
        );
    }


    function resetRevenuePeriod() {

        const periodSelect = getElement(
            "revenue-period"
        );

        if (periodSelect) {
            periodSelect.value = DEFAULT_REVENUE_PERIOD;
        }
    }


    function initDashboardInteractions() {

        if (dashboardInitialized) {
            return;
        }

        const periodSelect = getElement(
            "revenue-period"
        );

        if (periodSelect) {
            periodSelect.value = DEFAULT_REVENUE_PERIOD;
            periodSelect.addEventListener(
                "change",
                function () {
                    updateRevenue(this.value);
                }
            );
        }

        initAIActions();
        initDashboardActions();
        dashboardInitialized = true;
    }

    async function refreshDashboard() {

        initDashboardInteractions();

        try {
            await loadDashboardData();
        } catch (error) {
            return;
        }

        loadTopProducts();
    }


    function initDashboard() {

        if (!(window.getAuthAccessToken?.() || localStorage.getItem("sales_management_access_token"))) {
            return Promise.resolve();
        }

        if (dashboardRefreshPromise) {
            return dashboardRefreshPromise;
        }

        dashboardRefreshPromise =
            refreshDashboard().finally(function () {
                dashboardRefreshPromise = null;
            });

        return dashboardRefreshPromise;
    }


    window.addEventListener(
        "auth:login",
        function () {
            resetRevenuePeriod();
            initDashboard();
        }
    );


    document.addEventListener(
        "sales:data-changed",
        initDashboard
    );


    /* =========================================================
       EXPOSE
       ========================================================= */

    window.initDashboard =
        initDashboard;
    window.initDashboardFromAPI =
        initDashboard;

})();
