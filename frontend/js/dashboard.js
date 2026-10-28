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
    let topProductsIncomplete = false;
    let topProductsUnavailable = false;


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

            recentInvoicesData = [...invoices]
                .sort((a, b) => {
                    const firstDate = new Date(a.createdAt || a.date || 0);
                    const secondDate = new Date(b.createdAt || b.date || 0);
                    return secondDate - firstDate;
                })
                .slice(0, 4)
                .map(invoice => ({
                    id: invoice.id,
                    code: invoice.code,
                    customer: invoice.customerName || "Khách lẻ",
                    total: invoice.finalAmount,
                    status: invoice.status,
                    createdAt: invoice.createdAt || invoice.date
                }));

            inventoryWarningData = inventory
                .filter(item => item.quantity <= item.minimum)
                .sort((a, b) => a.quantity - b.quantity)
                .map(item => ({
                    code: item.code,
                    name: item.name,
                    stock: item.quantity,
                    minimum: item.minimum,
                    unit: item.unit,
                    imageData: item.imageData
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
            topProductsUnavailable = false;
            topProductsIncomplete = results[0].status === "rejected" ||
                results[2].status === "rejected" ||
                detailResults.some(result => result.status === "rejected");
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
                    unit: product.unit || "",
                    imageData: product.imageData,
                    quantity: soldByProduct.get(product.id) || 0
                }))
                .filter(product => product.quantity > 0)
                .sort((a, b) => b.quantity - a.quantity ||
                    String(a.code).localeCompare(String(b.code), "vi"));
        } catch (error) {
            topProductsData = [];
            topProductsUnavailable = true;
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


    function formatDashboardInvoiceTime(value) {

        if (!value) {
            return "---";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return escapeDashboardHtml(value);
        }

        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const hasTime = String(value).includes("T");

        if (!hasTime) {
            return `${day}/${month}/${year}`;
        }

        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }


    function getDashboardInvoiceStatus(status) {

        if (status === "pending") {
            return "Chờ thanh toán";
        }

        if (status === "cancelled") {
            return "Đã hủy";
        }

        return "Đã thanh toán";
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
                `${change >= 0 ? "↑" : "↓"} ${Math.abs(change).toFixed(1)}%`;
            changeElement.classList.toggle(
                "is-down",
                change < 0
            );
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

        container.innerHTML = topProductsData.slice(0, 5).map((product, index) => {
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


    function ensureTopProductsDialog() {
        let dialog = getElement("dashboard-top-products-dialog");
        if (dialog) return dialog;

        dialog = document.createElement("dialog");
        dialog.id = "dashboard-top-products-dialog";
        dialog.className = "dashboard-ranking-dialog";
        dialog.setAttribute("aria-labelledby", "dashboard-ranking-title");
        dialog.setAttribute("aria-describedby", "dashboard-ranking-description");
        dialog.innerHTML = `
            <header class="dashboard-ranking-header">
                <div>
                    <h2 id="dashboard-ranking-title">Sản phẩm bán chạy</h2>
                    <p id="dashboard-ranking-description">Xếp hạng theo tổng số lượng đã bán · Toàn bộ thời gian</p>
                </div>
                <button type="button" class="dashboard-ranking-close" aria-label="Đóng danh sách sản phẩm bán chạy">×</button>
            </header>
            <div class="dashboard-ranking-toolbar">
                <label for="dashboard-ranking-search">Tìm sản phẩm</label>
                <input type="search" id="dashboard-ranking-search" placeholder="Nhập tên hoặc mã sản phẩm" autocomplete="off">
                <p id="dashboard-ranking-count" role="status"></p>
            </div>
            <p id="dashboard-ranking-notice" class="dashboard-ranking-notice" role="status" hidden></p>
            <div class="dashboard-ranking-scroll" tabindex="0" role="region" aria-label="Bảng xếp hạng sản phẩm bán chạy">
                <table class="dashboard-ranking-table">
                    <thead><tr><th scope="col">Hạng</th><th scope="col">Sản phẩm</th><th scope="col">Đơn vị</th><th scope="col">Đã bán</th></tr></thead>
                    <tbody id="dashboard-ranking-body"></tbody>
                </table>
            </div>`;
        dialog.querySelector(".dashboard-ranking-close").addEventListener("click", () => dialog.close());
        dialog.querySelector("input").addEventListener("input", renderTopProductsRanking);
        dialog.addEventListener("keydown", event => {
            if (event.key === "Escape") event.stopPropagation();
        });
        document.body.appendChild(dialog);
        return dialog;
    }

    function renderTopProductsRanking() {
        const dialog = getElement("dashboard-top-products-dialog");
        if (!dialog?.open) return;
        const normalize = value => String(value || "").normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi");
        const query = normalize(getElement("dashboard-ranking-search").value.trim());
        const ranked = topProductsData.map((product, index) => ({ ...product, rank: index + 1 }))
            .filter(product => normalize(`${product.name} ${product.code}`).includes(query));
        getElement("dashboard-ranking-count").textContent = query
            ? `${ranked.length} / ${topProductsData.length} sản phẩm đã có lượt bán`
            : `${topProductsData.length} sản phẩm đã có lượt bán`;
        const notice = getElement("dashboard-ranking-notice");
        notice.hidden = !topProductsIncomplete && !topProductsUnavailable;
        notice.textContent = topProductsUnavailable
            ? "Không thể tải dữ liệu. Đóng và mở lại danh sách để thử lại."
            : "Một phần dữ liệu chưa tải được; số lượng và thứ hạng có thể chưa đầy đủ. Đóng và mở lại để thử lại.";
        getElement("dashboard-ranking-body").innerHTML = ranked.length
            ? ranked.map(product => `<tr>
                <td class="dashboard-ranking-rank">${product.rank}</td>
                <td><div class="dashboard-ranking-product">
                    <img src="${escapeDashboardHtml(getDashboardProductImage(product))}" alt="" loading="lazy">
                    <div><strong>${escapeDashboardHtml(product.name)}</strong><span>${escapeDashboardHtml(product.code)}</span></div>
                </div></td>
                <td>${escapeDashboardHtml(product.unit || "—")}</td>
                <td class="dashboard-ranking-quantity">${Number(product.quantity).toLocaleString("vi-VN")}</td>
            </tr>`).join("")
            : `<tr><td colspan="4" class="dashboard-ranking-empty">${topProductsUnavailable
                ? "Dữ liệu chưa sẵn sàng" : query ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào được bán"}</td></tr>`;
    }

    async function openTopProductsRanking() {
        if (typeof window.requirePermission === "function" && !window.requirePermission("top_products")) return;
        const dialog = ensureTopProductsDialog();
        getElement("dashboard-ranking-search").value = "";
        getElement("dashboard-ranking-count").textContent = "Đang tải bảng xếp hạng…";
        getElement("dashboard-ranking-notice").hidden = true;
        getElement("dashboard-ranking-body").innerHTML = '<tr><td colspan="4" class="dashboard-ranking-empty">Đang tải dữ liệu…</td></tr>';
        if (!dialog.open) dialog.showModal();
        getElement("dashboard-ranking-search").focus();
        await initDashboard();
        renderTopProductsRanking();
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


                const invoiceCode =
                    escapeDashboardHtml(invoice.code || "---");
                const customerName =
                    escapeDashboardHtml(invoice.customer || "Khách lẻ");
                const statusText =
                    escapeDashboardHtml(getDashboardInvoiceStatus(invoice.status));

                row.innerHTML = `

                    <td class="dashboard-invoice-code">
                        ${invoiceCode}
                    </td>

                    <td>
                        ${customerName}
                    </td>

                    <td class="dashboard-invoice-amount">
                        ${formatMoney(invoice.total)}
                    </td>

                    <td>
                        <span class="dashboard-paid-badge">
                            <i aria-hidden="true"></i>
                            ${statusText}
                        </span>
                    </td>

                    <td class="dashboard-invoice-time">
                        ${formatDashboardInvoiceTime(invoice.createdAt)}
                    </td>

                    <td class="dashboard-invoice-action-cell">
                        <button
                            type="button"
                            class="dashboard-invoice-view"
                            data-dashboard-invoice-id="${Number(invoice.id)}"
                            aria-label="Xem hóa đơn ${invoiceCode}"
                            title="Xem chi tiết"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z"></path>
                                <circle cx="12" cy="12" r="2.6"></circle>
                            </svg>
                        </button>
                    </td>

                `;


                tbody.appendChild(row);
            }
        );

        if (recentInvoicesData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="dashboard-empty-state">
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

                const productName =
                    escapeDashboardHtml(product.name || "Sản phẩm");
                const productCode =
                    escapeDashboardHtml(product.code || "---");
                const productUnit =
                    escapeDashboardHtml(product.unit || "sản phẩm");
                const productImage =
                    escapeDashboardHtml(getDashboardProductImage(product));
                const isOutOfStock = Number(product.stock || 0) <= 0;

                item.innerHTML = `
                    <div class="inventory-warning-media">
                        <img
                            src="${productImage}"
                            alt="Ảnh ${productName}"
                            loading="lazy"
                        >
                    </div>
                    <div class="inventory-warning-content">
                        <div class="inventory-warning-title-row">
                            <strong title="${productName}">${productName}</strong>
                            <small>${productCode}</small>
                        </div>
                        <div class="inventory-warning-meta">
                            <span class="inventory-warning-stock ${isOutOfStock ? "is-out" : "is-low"}">
                                <i aria-hidden="true"></i>
                                Còn <b>${Number(product.stock || 0).toLocaleString("vi-VN")}</b> ${productUnit}
                            </span>
                            <span class="inventory-warning-minimum">
                                Tối thiểu ${Number(product.minimum || 0).toLocaleString("vi-VN")}
                            </span>
                        </div>
                    </div>
                `;

                const image = item.querySelector("img");
                image?.addEventListener("error", () => {
                    image.src = "./assets/branding/sales-manager-logo.svg";
                }, { once: true });


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

        const viewAllProducts =
            getElement("dashboard-view-all-products");

        if (viewAllProducts) {
            viewAllProducts.addEventListener(
                "click",
                openTopProductsRanking
            );
        }

        const recentInvoices = getElement("recent-invoices");

        if (recentInvoices) {
            recentInvoices.addEventListener(
                "click",
                function (event) {
                    const button = event.target.closest(
                        ".dashboard-invoice-view"
                    );

                    if (!button) {
                        return;
                    }

                    const invoiceId = Number(
                        button.dataset.dashboardInvoiceId
                    );

                    if (
                        invoiceId &&
                        typeof window.viewInvoiceSearchDetail === "function"
                    ) {
                        window.viewInvoiceSearchDetail(invoiceId);
                        return;
                    }

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
        renderTopProductsRanking();
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
