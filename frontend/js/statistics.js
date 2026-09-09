/* Thống kê doanh thu tổng hợp từ hóa đơn thật trong SQL Server. */
let revenueStatisticsData = [];
let topRevenueProducts = [];
let currentRevenueStatisticsData = [];

(function () {
    "use strict";

    let statisticsDateInitialized = false;
    let statisticsInvoices = [];
    let statisticsProductMap = new Map();
    const money = value => Number(value || 0).toLocaleString("vi-VN") + " ₫";
    const displayDate = iso => {
        const [year, month, day] = String(iso || "").slice(0, 10).split("-");
        return year && month && day ? `${day}/${month}/${year}` : "";
    };
    const escapeHTML = value => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    async function loadRealStatistics() {
        const [invoices, products] = await Promise.all([
            salesApi.invoices.list(),
            salesApi.products.list()
        ]);
        const details = await Promise.all(invoices.map(item => salesApi.invoices.get(item.id)));
        const daily = new Map();
        statisticsInvoices = details;
        statisticsProductMap = new Map(products.map(item => [item.id, item]));

        details.forEach(invoice => {
            const row = daily.get(invoice.date) || {
                isoDate: invoice.date,
                date: displayDate(invoice.date),
                invoices: 0,
                revenue: 0
            };
            row.invoices += 1;
            row.revenue += Number(invoice.finalAmount || 0);
            daily.set(invoice.date, row);

        });

        revenueStatisticsData = [...daily.values()].sort(
            (a, b) => a.isoDate.localeCompare(b.isoDate)
        );
        if (revenueStatisticsData.length) {
            const from = document.getElementById("statistics-from-date");
            const to = document.getElementById("statistics-to-date");
            const first = revenueStatisticsData[0].isoDate;
            const last = revenueStatisticsData[revenueStatisticsData.length - 1].isoDate;
            if (from && to) {
                const followedFirstDate = !statisticsDateInitialized || from.value === from.min;
                const followedLastDate = !statisticsDateInitialized || to.value === to.max;
                from.min = first;
                from.max = last;
                to.min = first;
                to.max = last;
                if (followedFirstDate) from.value = first;
                if (followedLastDate) to.value = last;
                statisticsDateInitialized = true;
            }
        }
        applyStatisticsFilter(false);
    }

    function calculateTopProducts(from, to) {
        const productSales = new Map();
        statisticsInvoices
            .filter(invoice => (!from || invoice.date >= from) && (!to || invoice.date <= to))
            .forEach(invoice => {
                const discountFactor = Number(invoice.totalAmount || 0) > 0
                    ? Number(invoice.finalAmount || 0) / Number(invoice.totalAmount)
                    : 1;
                (invoice.items || []).forEach(item => {
                    const product = statisticsProductMap.get(item.productId) || {};
                    const result = productSales.get(item.productId) || {
                        code: product.code || "",
                        name: item.productName || product.name || "",
                        sold: 0,
                        revenue: 0
                    };
                    result.sold += Number(item.quantity || 0);
                    result.revenue += Number(item.amount || 0) * discountFactor;
                    productSales.set(item.productId, result);
                });
            });
        topRevenueProducts = [...productSales.values()]
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
    }

    function calculate(data) {
        const totalRevenue = data.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
        const totalInvoices = data.reduce((sum, item) => sum + Number(item.invoices || 0), 0);
        const highestDay = data.reduce(
            (highest, item) => !highest || item.revenue > highest.revenue ? item : highest,
            null
        );
        return {
            totalRevenue,
            totalInvoices,
            averageRevenue: totalInvoices ? totalRevenue / totalInvoices : 0,
            highestDay
        };
    }

    function renderKPI() {
        const result = calculate(currentRevenueStatisticsData);
        document.getElementById("statistics-total-revenue").textContent = money(result.totalRevenue);
        document.getElementById("statistics-total-invoices").textContent =
            result.totalInvoices.toLocaleString("vi-VN");
        document.getElementById("statistics-average-revenue").textContent = money(result.averageRevenue);
        document.getElementById("statistics-highest-revenue").textContent =
            money(result.highestDay?.revenue || 0);
    }

    function renderChart() {
        const chart = document.getElementById("statistics-revenue-chart");
        if (!currentRevenueStatisticsData.length) {
            chart.innerHTML = '<div class="statistics-empty">Không có dữ liệu doanh thu trong khoảng thời gian đã chọn.</div>';
            return;
        }
        const width = 700;
        const height = 260;
        const left = 45;
        const top = 20;
        const chartWidth = width - left - 20;
        const chartHeight = height - top - 40;
        const max = Math.max(...currentRevenueStatisticsData.map(item => item.revenue), 1);
        const points = currentRevenueStatisticsData.map((item, index) => ({
            item,
            x: left + (index / Math.max(1, currentRevenueStatisticsData.length - 1)) * chartWidth,
            y: top + chartHeight - (item.revenue / max) * chartHeight
        }));
        const path = points.map((point, index) =>
            `${index ? "L" : "M"} ${point.x} ${point.y}`
        ).join(" ");
        chart.innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <line x1="${left}" y1="${top}" x2="${left}" y2="${height - 40}" stroke="#dfe4ea"/>
                <line x1="${left}" y1="${height - 40}" x2="${width - 20}" y2="${height - 40}" stroke="#dfe4ea"/>
                <path d="${path}" class="statistics-chart-line"/>
                ${points.map(point => `
                    <circle class="statistics-chart-point" cx="${point.x}" cy="${point.y}" r="4">
                        <title>${escapeHTML(point.item.date)}: ${money(point.item.revenue)}</title>
                    </circle>
                    <text class="statistics-chart-label" x="${point.x}" y="${height - 12}" text-anchor="middle">
                        ${point.item.date.substring(0, 5)}
                    </text>
                `).join("")}
            </svg>`;
    }

    function renderTopProducts() {
        const container = document.getElementById("statistics-top-products");
        if (!topRevenueProducts.length) {
            container.innerHTML = '<div class="statistics-empty">Chưa có dữ liệu sản phẩm đã bán.</div>';
            return;
        }
        container.innerHTML = topRevenueProducts.map(product => `
            <div class="statistics-product-item">
                <div class="statistics-product-info">
                    <div class="statistics-product-name">${escapeHTML(product.name)}</div>
                    <div class="statistics-product-code">${escapeHTML(product.code)} · ${product.sold.toLocaleString("vi-VN")} sản phẩm</div>
                </div>
                <div class="statistics-product-revenue">${money(product.revenue)}</div>
            </div>
        `).join("");
    }

    function renderDailyTable() {
        const body = document.getElementById("statistics-daily-table-body");
        if (!currentRevenueStatisticsData.length) {
            body.innerHTML = '<tr><td colspan="4" class="statistics-empty">Không có dữ liệu doanh thu trong khoảng thời gian đã chọn.</td></tr>';
            return;
        }
        body.innerHTML = currentRevenueStatisticsData.map(item => `
            <tr>
                <td>${item.date}</td>
                <td>${item.invoices}</td>
                <td class="money">${money(item.revenue)}</td>
                <td class="money">${money(item.invoices ? item.revenue / item.invoices : 0)}</td>
            </tr>
        `).join("");
    }

    function renderAll() {
        renderKPI();
        renderChart();
        renderTopProducts();
        renderDailyTable();
    }

    function applyStatisticsFilter(showMessage = true) {
        const from = document.getElementById("statistics-from-date")?.value;
        const to = document.getElementById("statistics-to-date")?.value;
        if (!from || !to) {
            if (showMessage) alert("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");
            currentRevenueStatisticsData = [...revenueStatisticsData];
            calculateTopProducts(null, null);
            renderAll();
            return;
        }
        if (from > to) {
            if (showMessage) alert("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
            return;
        }
        currentRevenueStatisticsData = revenueStatisticsData.filter(
            item => item.isoDate >= from && item.isoDate <= to
        );
        calculateTopProducts(from, to);
        renderAll();
    }

    async function initRevenueStatistics() {
        if (
            typeof requirePermission === "function" &&
            !requirePermission("revenue_statistics")
        ) return;
        const chart = document.getElementById("statistics-revenue-chart");
        if (chart) chart.innerHTML = '<div class="statistics-empty">Đang tải dữ liệu...</div>';
        try {
            await loadRealStatistics();
        } catch (error) {
            console.error("Không thể tải thống kê doanh thu:", error);
            revenueStatisticsData = [];
            topRevenueProducts = [];
            currentRevenueStatisticsData = [];
            renderAll();
        }

        const button = document.getElementById("statistics-filter-button");
        if (button && !button.dataset.initialized) {
            button.addEventListener("click", () => applyStatisticsFilter(true));
            button.dataset.initialized = "true";
        }
    }

    document.addEventListener("sales:data-changed", function () {
        if (document.getElementById("statistics-page")?.classList.contains("active")) {
            loadRealStatistics().catch(console.error);
        }
    });

    window.initRevenueStatistics = initRevenueStatistics;
})();
