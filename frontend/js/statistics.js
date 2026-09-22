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
    const compactMoney = value => {
        const amount = Number(value || 0);
        const format = number => Number(number.toFixed(1)).toLocaleString("vi-VN");
        if (Math.abs(amount) >= 1_000_000_000) return `${format(amount / 1_000_000_000)} tỷ`;
        if (Math.abs(amount) >= 1_000_000) return `${format(amount / 1_000_000)} tr`;
        if (Math.abs(amount) >= 1_000) return `${format(amount / 1_000)} nghìn`;
        return amount.toLocaleString("vi-VN");
    };
    const displayDate = iso => {
        const [year, month, day] = String(iso || "").slice(0, 10).split("-");
        return year && month && day ? `${day}/${month}/${year}` : "";
    };
    const escapeHTML = value => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    function createChartScale(maxValue, tickCount = 4) {
        if (maxValue <= 0) {
            return { max: 1, ticks: [1, 0.75, 0.5, 0.25, 0] };
        }
        const rawStep = maxValue / tickCount;
        const power = 10 ** Math.floor(Math.log10(rawStep));
        const fraction = rawStep / power;
        const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
        const step = niceFraction * power;
        const max = step * tickCount;
        return {
            max,
            ticks: Array.from({ length: tickCount + 1 }, (_, index) => max - index * step)
        };
    }

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
                        imageData: item.productImageData || product.imageData || "",
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
        const highestNote = document.getElementById("statistics-highest-revenue-note");
        if (highestNote) {
            highestNote.textContent = result.highestDay
                ? `${result.highestDay.date} · ${result.highestDay.invoices} hóa đơn`
                : "Chưa có dữ liệu trong kỳ";
        }
    }

    function renderChart() {
        const chart = document.getElementById("statistics-revenue-chart");
        if (!currentRevenueStatisticsData.length) {
            chart.innerHTML = '<div class="statistics-empty">Không có dữ liệu doanh thu trong khoảng thời gian đã chọn.</div>';
            return;
        }
        const width = Math.max(720, currentRevenueStatisticsData.length * 90);
        const height = 340;
        const left = 78;
        const right = 48;
        const top = 58;
        const bottom = 54;
        const chartWidth = width - left - right;
        const chartHeight = height - top - bottom;
        const maxRevenue = Math.max(
            ...currentRevenueStatisticsData.map(item => Number(item.revenue) || 0),
            1
        );
        const scale = createChartScale(maxRevenue);
        const points = currentRevenueStatisticsData.map((item, index) => ({
            item,
            x: currentRevenueStatisticsData.length === 1
                ? left + chartWidth / 2
                : left + (index / (currentRevenueStatisticsData.length - 1)) * chartWidth,
            y: top + chartHeight - (Number(item.revenue || 0) / scale.max) * chartHeight
        }));
        const path = points.map((point, index) =>
            `${index ? "L" : "M"} ${point.x} ${point.y}`
        ).join(" ");
        const baseY = top + chartHeight;
        const areaPath = `${path} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;
        const total = currentRevenueStatisticsData.reduce(
            (sum, item) => sum + Number(item.revenue || 0),
            0
        );
        const firstRevenue = Number(currentRevenueStatisticsData[0]?.revenue || 0);
        const lastRevenue = Number(currentRevenueStatisticsData.at(-1)?.revenue || 0);
        const growth = firstRevenue > 0
            ? ((lastRevenue - firstRevenue) / firstRevenue) * 100
            : lastRevenue > 0 ? 100 : 0;
        const trendClass = growth > 0 ? "positive" : growth < 0 ? "negative" : "neutral";
        const formattedGrowth = Math.abs(growth).toLocaleString("vi-VN", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });
        const trendText = growth > 0
            ? `Tăng ${formattedGrowth}%`
            : growth < 0
                ? `Giảm ${formattedGrowth}%`
                : "Không đổi";

        chart.innerHTML = `
            <div class="statistics-chart-insights">
                <span class="statistics-insight ${trendClass}">
                    <small>Xu hướng đầu kỳ → cuối kỳ</small>
                    <strong>${trendText}</strong>
                </span>
                <span class="statistics-insight">
                    <small>Bình quân mỗi ngày có doanh thu</small>
                    <strong>${money(total / currentRevenueStatisticsData.length)}</strong>
                </span>
                <span class="statistics-insight">
                    <small>Số ngày phát sinh doanh thu</small>
                    <strong>${currentRevenueStatisticsData.length} ngày</strong>
                </span>
            </div>

            <div class="statistics-chart-scroll">
                <svg
                    viewBox="0 0 ${width} ${height}"
                    preserveAspectRatio="xMinYMin meet"
                    style="min-width: ${width}px"
                    role="img"
                    aria-label="Biểu đồ doanh thu theo ngày"
                >
                    <defs>
                        <linearGradient id="statisticsRevenueArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.28"/>
                            <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.02"/>
                        </linearGradient>
                    </defs>

                    <text class="statistics-chart-axis-title" x="${left}" y="22">Doanh thu</text>
                    <text class="statistics-chart-axis-title" x="${width - right}" y="${height - 8}" text-anchor="end">Ngày</text>

                    ${scale.ticks.map((value, index) => {
                        const y = top + (index / (scale.ticks.length - 1)) * chartHeight;
                        return `
                            <line class="statistics-chart-grid-line" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/>
                            <text class="statistics-chart-y-label" x="${left - 12}" y="${y + 4}" text-anchor="end">
                                ${compactMoney(value)}
                            </text>
                        `;
                    }).join("")}

                    <path d="${areaPath}" class="statistics-chart-area"/>
                    <path d="${path}" class="statistics-chart-line"/>

                    ${points.map(point => `
                        <g class="statistics-chart-data-point">
                            <text
                                class="statistics-chart-value"
                                x="${point.x}"
                                y="${Math.max(38, point.y - 13)}"
                                text-anchor="middle"
                            >${compactMoney(point.item.revenue)}</text>
                            <circle class="statistics-chart-point" cx="${point.x}" cy="${point.y}" r="5"/>
                            <circle class="statistics-chart-hit-area" cx="${point.x}" cy="${point.y}" r="18">
                                <title>${escapeHTML(point.item.date)} · ${point.item.invoices} hóa đơn · ${money(point.item.revenue)}</title>
                            </circle>
                            <text class="statistics-chart-label" x="${point.x}" y="${height - 28}" text-anchor="middle">
                                ${point.item.date.substring(0, 5)}
                            </text>
                        </g>
                    `).join("")}
                </svg>
            </div>
        `;
    }

    function renderTopProducts() {
        const container = document.getElementById("statistics-top-products");
        if (!topRevenueProducts.length) {
            container.innerHTML = '<div class="statistics-empty">Chưa có dữ liệu sản phẩm đã bán.</div>';
            return;
        }
        const highestRevenue = Math.max(
            ...topRevenueProducts.map(product => Number(product.revenue) || 0),
            1
        );
        container.innerHTML = topRevenueProducts.map((product, index) => `
            <div class="statistics-product-item">
                <span class="statistics-product-rank">${index + 1}</span>
                <img
                    class="sales-product-thumbnail statistics-product-thumbnail"
                    src="${escapeHTML(product.imageData || "./assets/branding/sales-manager-logo.svg")}"
                    alt="${escapeHTML(product.name)}"
                    loading="lazy"
                >
                <div class="statistics-product-info">
                    <div class="statistics-product-name">${escapeHTML(product.name)}</div>
                    <div class="statistics-product-code">${escapeHTML(product.code)} · ${product.sold.toLocaleString("vi-VN")} sản phẩm</div>
                    <div class="statistics-product-progress">
                        <span style="width: ${(Number(product.revenue || 0) / highestRevenue) * 100}%"></span>
                    </div>
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
