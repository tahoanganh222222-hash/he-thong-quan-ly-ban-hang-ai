/* =========================================================
   DASHBOARD
   Data from REST API
   ========================================================= */

(function () {

    "use strict";


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


        const days =
            Number(period);


        const now = new Date();


        const startDate =
            new Date(now);


        startDate.setDate(
            startDate.getDate() - days + 1
        );


        return revenueData.filter(
            item => {

                const itemDate =
                    new Date(item.date);

                return (
                    itemDate >= startDate &&
                    itemDate <= now
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

function renderRevenueChart(data) {

    const chart =
        document.getElementById("revenue-chart");


    if (!chart) {
        return;
    }


    chart.innerHTML = "";


    if (!data || data.length === 0) {

        chart.innerHTML = `
            <div
                style="
                    width: 100%;
                    height: 240px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                "
            >
                Không có dữ liệu doanh thu
            </div>
        `;

        return;
    }


    /* Sắp xếp dữ liệu theo ngày */

    const sortedData =
        [...data].sort(
            (a, b) =>
                new Date(a.date) -
                new Date(b.date)
        );


    const maxRevenue =
        Math.max(
            ...sortedData.map(
                item => Number(item.revenue) || 0
            )
        );


    /* Container biểu đồ */

    chart.style.display = "flex";
    chart.style.alignItems = "flex-end";
    chart.style.height = "260px";
    chart.style.width = "100%";
    chart.style.boxSizing = "border-box";
    chart.style.overflowX = "auto";
    chart.style.overflowY = "hidden";
    chart.style.gap = "10px";
    chart.style.padding = "20px 10px 10px";


    sortedData.forEach(item => {

        const revenue =
            Number(item.revenue) || 0;


        const barItem =
            document.createElement("div");


        barItem.className =
            "revenue-bar-item";


        barItem.style.flex = "1 0 32px";
        barItem.style.minWidth = "32px";
        barItem.style.height = "100%";
        barItem.style.display = "flex";
        barItem.style.flexDirection = "column";
        barItem.style.justifyContent = "flex-end";
        barItem.style.alignItems = "center";


        const wrapper =
            document.createElement("div");


        wrapper.className =
            "revenue-bar-wrapper";


        wrapper.style.width = "100%";
        wrapper.style.height = "calc(100% - 30px)";
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "flex-end";
        wrapper.style.justifyContent = "center";


        const bar =
            document.createElement("div");


        bar.className =
            "revenue-bar";


        const height =
            maxRevenue > 0
                ? (revenue / maxRevenue) * 100
                : 3;


        bar.style.width = "70%";
        bar.style.height = `${Math.max(height, 3)}%`;
        bar.style.minHeight = "3px";
        bar.style.borderRadius = "5px 5px 0 0";
        bar.style.backgroundColor =
            "var(--primary-color, #2563eb)";
        bar.style.transition =
            "height 0.3s ease";


        bar.title =
            formatMoney(revenue);


        const label =
            document.createElement("span");


        label.className =
            "revenue-bar-label";


        label.textContent =
            formatChartDate(item.date);


        label.style.marginTop = "8px";
        label.style.fontSize = "12px";
        label.style.whiteSpace = "nowrap";


        wrapper.appendChild(bar);

        barItem.appendChild(wrapper);

        barItem.appendChild(label);

        chart.appendChild(barItem);

    });
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


        container.innerHTML = "";


        topProductsData.forEach(
            product => {

                const item =
                    document.createElement("div");

                item.className =
                    "product-list-item";


                item.innerHTML = `

                    <div>
                        <strong>
                            ${product.name}
                        </strong>

                        <small>
                            ${product.code}
                        </small>
                    </div>

                    <strong>
                        ${product.quantity}
                    </strong>

                `;


                container.appendChild(item);
            }
        );

        if (topProductsData.length === 0) {
            container.innerHTML = `
                <div class="dashboard-empty-state">
                    Chưa có dữ liệu sản phẩm bán chạy
                </div>
            `;
        }
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

        const viewAllInvoices =
            getElement("dashboard-view-all-invoices");

        if (viewAllInvoices) {
            viewAllInvoices.addEventListener(
                "click",
                function () {
                    const invoiceMenu =
                        document.querySelector(
                            '.menu-item[data-page="invoices"]'
                        );

                    if (invoiceMenu) {
                        invoiceMenu.click();
                    }
                }
            );
        }
    }


    /* =========================================================
       INIT DASHBOARD
       ========================================================= */

    async function refreshDashboard() {

        try {
            await loadDashboardData();
        } catch (error) {
            return;
        }

        loadStatistics();

        loadTopProducts();

        loadRecentInvoices();

        loadInventoryWarnings();


        const periodSelect =
            getElement(
                "revenue-period"
            );


        const defaultPeriod =
            periodSelect
                ? periodSelect.value
                : "7";


        updateRevenue(
            defaultPeriod
        );


        if (periodSelect && !dashboardInitialized) {

            periodSelect.addEventListener(
                "change",
                function () {

                    updateRevenue(
                        this.value
                    );
                }
            );
        }


        if (!dashboardInitialized) {
            initAIActions();
            initDashboardActions();
            dashboardInitialized = true;
        }
    }


    function initDashboard() {

        if (!localStorage.getItem("sales_management_access_token")) {
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
        initDashboard
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
