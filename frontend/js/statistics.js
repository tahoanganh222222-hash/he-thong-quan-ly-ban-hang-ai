/* Revenue statistics rendered from the existing SQL Server-backed sales API. */
let revenueStatisticsData = [];
let topRevenueProducts = [];
let currentRevenueStatisticsData = [];

(function () {
    "use strict";

    let statisticsDateInitialized = false;
    let statisticsInvoices = [];
    let statisticsProductMap = new Map();
    let currentContributions = [];
    let currentFilters = { from: "", to: "", categoryId: "" };
    let resizeTimer = 0;

    const money = value => Math.round(Number(value || 0)).toLocaleString("vi-VN") + " ₫";
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
    const isoDate = date => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };
    const dateFromISO = value => {
        const [year, month, day] = String(value || "").split("-").map(Number);
        return new Date(year, (month || 1) - 1, day || 1);
    };
    const addDays = (value, days) => {
        const date = dateFromISO(value);
        date.setDate(date.getDate() + days);
        return isoDate(date);
    };
    const escapeHTML = value => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    function invoiceContribution(invoice, filters) {
        if (filters.from && invoice.date < filters.from) return null;
        if (filters.to && invoice.date > filters.to) return null;

        const allItems = Array.isArray(invoice.items) ? invoice.items : [];
        const selectedItems = filters.categoryId
            ? allItems.filter(item => String(statisticsProductMap.get(item.productId)?.categoryId || "") === filters.categoryId)
            : allItems;
        if (filters.categoryId && !selectedItems.length) return null;

        const totalAmount = Number(invoice.totalAmount || 0);
        const discountFactor = totalAmount > 0
            ? Number(invoice.finalAmount || 0) / totalAmount
            : 1;
        const revenue = filters.categoryId
            ? selectedItems.reduce((sum, item) => sum + Number(item.amount || 0) * discountFactor, 0)
            : Number(invoice.finalAmount || 0);

        return { invoice, items: selectedItems, revenue, discountFactor };
    }

    function collectContributions(filters) {
        return statisticsInvoices
            .map(invoice => invoiceContribution(invoice, filters))
            .filter(Boolean);
    }

    function aggregateDaily(contributions) {
        const daily = new Map();
        contributions.forEach(entry => {
            const invoice = entry.invoice;
            const row = daily.get(invoice.date) || {
                isoDate: invoice.date,
                date: displayDate(invoice.date),
                invoices: 0,
                revenue: 0,
                invoiceIds: []
            };
            row.invoices += 1;
            row.revenue += Number(entry.revenue || 0);
            row.invoiceIds.push(invoice.id);
            daily.set(invoice.date, row);
        });
        return [...daily.values()].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
    }

    function populateCategoryFilter() {
        const select = document.getElementById("statistics-category");
        if (!select) return;
        const selected = select.value;
        const categories = new Map();
        statisticsProductMap.forEach(product => {
            if (product.categoryId && product.category) {
                categories.set(String(product.categoryId), product.category);
            }
        });
        select.innerHTML = '<option value="">Tất cả danh mục</option>' +
            [...categories.entries()]
                .sort((a, b) => a[1].localeCompare(b[1], "vi"))
                .map(([id, name]) => `<option value="${escapeHTML(id)}">${escapeHTML(name)}</option>`)
                .join("");
        if ([...select.options].some(option => option.value === selected)) select.value = selected;
    }

    function setActivePeriod(value) {
        document.querySelectorAll("[data-statistics-period]").forEach(button => {
            button.classList.toggle("active", button.dataset.statisticsPeriod === String(value));
        });
    }

    function setQuickPeriod(period, shouldApply = true) {
        const fromInput = document.getElementById("statistics-from-date");
        const toInput = document.getElementById("statistics-to-date");
        if (!fromInput || !toInput) return;
        const latestDataDate = revenueStatisticsData.at(-1)?.isoDate || isoDate(new Date());
        const end = period === "today" ? isoDate(new Date()) : latestDataDate;
        const days = period === "today" ? 1 : Number(period || 30);
        let start = addDays(end, -(days - 1));
        if (fromInput.min && start < fromInput.min && period !== "today") start = fromInput.min;
        fromInput.value = start;
        toInput.value = end;
        setActivePeriod(period);
        if (shouldApply) applyStatisticsFilter(false);
    }

    async function loadRealStatistics() {
        const [invoiceSummaries, products] = await Promise.all([
            salesApi.invoices.list(),
            salesApi.products.list()
        ]);
        const details = await Promise.all(invoiceSummaries.map(item => salesApi.invoices.get(item.id)));
        statisticsInvoices = details;
        statisticsProductMap = new Map(products.map(item => [item.id, item]));
        revenueStatisticsData = aggregateDaily(collectContributions({ from: "", to: "", categoryId: "" }));

        populateCategoryFilter();

        const from = document.getElementById("statistics-from-date");
        const to = document.getElementById("statistics-to-date");
        if (from && to && revenueStatisticsData.length) {
            const first = revenueStatisticsData[0].isoDate;
            const last = revenueStatisticsData.at(-1).isoDate;
            from.min = first;
            from.max = last;
            to.min = first;
            to.max = last;
            if (!statisticsDateInitialized) {
                from.value = addDays(last, -29) < first ? first : addDays(last, -29);
                to.value = last;
                setActivePeriod("30");
                statisticsDateInitialized = true;
            }
        }
        applyStatisticsFilter(false);
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

    function previousPeriodResult() {
        if (!currentFilters.from || !currentFilters.to) return calculate([]);
        const start = dateFromISO(currentFilters.from);
        const end = dateFromISO(currentFilters.to);
        const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
        const previousTo = addDays(currentFilters.from, -1);
        const previousFrom = addDays(previousTo, -(days - 1));
        const previous = collectContributions({
            ...currentFilters,
            from: previousFrom,
            to: previousTo
        });
        return calculate(aggregateDaily(previous));
    }

    function renderChange(id, current, previous) {
        const element = document.getElementById(id);
        if (!element) return;
        element.classList.remove("negative", "neutral");
        if (!previous && !current) {
            element.textContent = "—";
            element.classList.add("neutral");
            return;
        }
        const percentage = previous
            ? ((current - previous) / Math.abs(previous)) * 100
            : 100;
        const rounded = Math.abs(percentage).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
        element.textContent = `${percentage >= 0 ? "↑" : "↓"} ${rounded}%`;
        if (percentage < 0) element.classList.add("negative");
    }

    function renderSpark(id, values) {
        const element = document.getElementById(id);
        if (!element) return;
        const list = values.slice(-5);
        while (list.length < 5) list.unshift(0);
        const maximum = Math.max(...list, 1);
        element.innerHTML = list.map(value =>
            `<i style="height:${Math.max(8, Number(value || 0) / maximum * 44)}px"></i>`
        ).join("");
    }

    function renderKPI() {
        const result = calculate(currentRevenueStatisticsData);
        const previous = previousPeriodResult();
        document.getElementById("statistics-total-revenue").textContent = money(result.totalRevenue);
        document.getElementById("statistics-total-invoices").textContent = result.totalInvoices.toLocaleString("vi-VN");
        document.getElementById("statistics-average-revenue").textContent = money(result.averageRevenue);
        document.getElementById("statistics-highest-revenue").textContent = money(result.highestDay?.revenue || 0);
        const highestNote = document.getElementById("statistics-highest-revenue-note");
        if (highestNote) {
            highestNote.textContent = result.highestDay ? result.highestDay.date : "Chưa có dữ liệu";
            highestNote.classList.toggle("neutral", !result.highestDay);
        }
        renderChange("statistics-revenue-change", result.totalRevenue, previous.totalRevenue);
        renderChange("statistics-invoice-change", result.totalInvoices, previous.totalInvoices);
        renderChange("statistics-average-change", result.averageRevenue, previous.averageRevenue);
        renderSpark("statistics-revenue-spark", currentRevenueStatisticsData.map(item => item.revenue));
        renderSpark("statistics-invoice-spark", currentRevenueStatisticsData.map(item => item.invoices));
        renderSpark("statistics-average-spark", currentRevenueStatisticsData.map(item => item.invoices ? item.revenue / item.invoices : 0));
        renderSpark("statistics-highest-spark", currentRevenueStatisticsData.map(item => item.revenue));
    }

    function createChartScale(maxValue, tickCount = 4) {
        if (maxValue <= 0) return { max: 1, ticks: [1, .75, .5, .25, 0] };
        const rawStep = maxValue / tickCount;
        const power = 10 ** Math.floor(Math.log10(rawStep));
        const fraction = rawStep / power;
        const niceFraction = fraction <= 1 ? 1 : fraction <= 1.5 ? 1.5 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
        const step = niceFraction * power;
        const max = step * tickCount;
        return { max, ticks: Array.from({ length: tickCount + 1 }, (_, index) => max - index * step) };
    }

    function renderChart() {
        const chart = document.getElementById("statistics-revenue-chart");
        if (!chart) return;
        if (!currentRevenueStatisticsData.length) {
            chart.innerHTML = '<div class="statistics-empty">Không có dữ liệu doanh thu trong khoảng thời gian đã chọn.</div>';
            return;
        }

        const data = currentRevenueStatisticsData;
        const width = Math.max(620, Math.round(chart.clientWidth || 760));
        const height = 224;
        const left = 50;
        const right = 42;
        const top = 28;
        const bottom = 37;
        const chartWidth = width - left - right;
        const chartHeight = height - top - bottom;
        const revenueScale = createChartScale(Math.max(...data.map(item => Number(item.revenue || 0)), 1));
        const invoiceMax = Math.max(...data.map(item => Number(item.invoices || 0)), 1);
        const slot = chartWidth / data.length;
        const barWidth = Math.max(7, Math.min(28, slot * .58));
        const points = data.map((item, index) => ({
            item,
            x: left + slot * index + slot / 2,
            revenueY: top + chartHeight - Number(item.revenue || 0) / revenueScale.max * chartHeight,
            invoiceY: top + chartHeight - Number(item.invoices || 0) / invoiceMax * chartHeight
        }));
        const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.invoiceY}`).join(" ");
        const labelStep = Math.max(1, Math.ceil(data.length / Math.max(6, Math.floor(chartWidth / 58))));

        chart.innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Biểu đồ doanh thu và số hóa đơn theo ngày">
                <defs>
                    <linearGradient id="statisticsRevenueBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#8588f8" stop-opacity=".86"></stop>
                        <stop offset="100%" stop-color="#b8c5ff" stop-opacity=".55"></stop>
                    </linearGradient>
                </defs>
                <text class="statistics-chart-axis-title" x="${left}" y="10">Doanh thu</text>
                <text class="statistics-chart-axis-title" x="${width - right}" y="10" text-anchor="end">Hóa đơn</text>
                ${revenueScale.ticks.map((value, index) => {
                    const y = top + index * chartHeight / (revenueScale.ticks.length - 1);
                    const invoiceValue = invoiceMax - index * invoiceMax / (revenueScale.ticks.length - 1);
                    const invoiceLabel = Number(invoiceValue.toFixed(1)).toLocaleString("vi-VN");
                    return `<line class="statistics-chart-grid-line" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line>
                        <text class="statistics-chart-y-label" x="${left - 7}" y="${y + 3}" text-anchor="end">${compactMoney(value)}</text>
                        <text class="statistics-chart-y-label" x="${width - right + 7}" y="${y + 3}">${invoiceLabel}</text>`;
                }).join("")}
                ${points.map((point, index) => {
                    const barHeight = top + chartHeight - point.revenueY;
                    return `<rect class="statistics-chart-bar" x="${point.x - barWidth / 2}" y="${point.revenueY}" width="${barWidth}" height="${Math.max(1, barHeight)}" rx="5"></rect>
                        ${(index % labelStep === 0 || index === points.length - 1) ? `<text class="statistics-chart-x-label" x="${point.x}" y="${height - 17}" text-anchor="middle">${point.item.date.slice(0, 5)}</text>` : ""}`;
                }).join("")}
                <path class="statistics-chart-line" d="${line}"></path>
                ${points.map((point, index) => `<circle class="statistics-chart-point" cx="${point.x}" cy="${point.invoiceY}" r="4"></circle>
                    <rect class="statistics-chart-hit" data-chart-index="${index}" x="${left + slot * index}" y="${top}" width="${slot}" height="${chartHeight}"></rect>`).join("")}
            </svg>
            <div class="statistics-chart-tooltip" id="statistics-chart-tooltip"></div>
        `;

        const tooltip = document.getElementById("statistics-chart-tooltip");
        chart.querySelectorAll("[data-chart-index]").forEach(hit => {
            const show = event => {
                const item = data[Number(hit.dataset.chartIndex)];
                if (!item || !tooltip) return;
                tooltip.innerHTML = `<strong>${escapeHTML(item.date)}</strong><span><i></i>Doanh thu: ${money(item.revenue)}</span><br><span class="line"><i></i>Số hóa đơn: ${item.invoices}</span>`;
                const rect = chart.getBoundingClientRect();
                const x = Math.min(Math.max(5, event.clientX - rect.left + 12), Math.max(5, rect.width - 160));
                const y = Math.min(Math.max(5, event.clientY - rect.top - 25), Math.max(5, rect.height - 72));
                tooltip.style.left = `${x}px`;
                tooltip.style.top = `${y}px`;
                tooltip.classList.add("active");
            };
            hit.addEventListener("mouseenter", show);
            hit.addEventListener("mousemove", show);
            hit.addEventListener("mouseleave", () => tooltip?.classList.remove("active"));
        });
    }

    function calculateTopProducts(contributions) {
        const productSales = new Map();
        contributions.forEach(entry => {
            entry.items.forEach(item => {
                const product = statisticsProductMap.get(item.productId) || {};
                const result = productSales.get(item.productId) || {
                    code: product.code || item.productCode || "",
                    name: item.productName || product.name || "Sản phẩm",
                    imageData: item.productImageData || product.imageData || "",
                    sold: 0,
                    revenue: 0
                };
                result.sold += Number(item.quantity || 0);
                result.revenue += Number(item.amount || 0) * entry.discountFactor;
                productSales.set(item.productId, result);
            });
        });
        topRevenueProducts = [...productSales.values()]
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
    }

    function renderTopProducts() {
        const container = document.getElementById("statistics-top-products");
        if (!container) return;
        if (!topRevenueProducts.length) {
            container.innerHTML = '<div class="statistics-empty">Chưa có dữ liệu sản phẩm đã bán trong kỳ.</div>';
            return;
        }
        const highestRevenue = Math.max(...topRevenueProducts.map(product => Number(product.revenue || 0)), 1);
        container.innerHTML = topRevenueProducts.map((product, index) => `
            <div class="statistics-product-item">
                <span class="statistics-product-rank">${index + 1}</span>
                <img class="statistics-product-thumbnail" src="${escapeHTML(product.imageData || "./assets/branding/sales-manager-logo.svg")}" alt="${escapeHTML(product.name)}" loading="lazy">
                <div class="statistics-product-info">
                    <div class="statistics-product-name" title="${escapeHTML(product.name)}">${escapeHTML(product.name)}</div>
                    <div class="statistics-product-code">${product.sold.toLocaleString("vi-VN")} đã bán</div>
                    <div class="statistics-product-progress"><span style="width:${Number(product.revenue || 0) / highestRevenue * 100}%"></span></div>
                </div>
                <div class="statistics-product-revenue">${money(product.revenue)}</div>
            </div>
        `).join("");
    }

    function renderDailyTable() {
        const body = document.getElementById("statistics-daily-table-body");
        if (!body) return;
        if (!currentRevenueStatisticsData.length) {
            body.innerHTML = '<tr><td colspan="6" class="statistics-empty">Không có dữ liệu doanh thu trong khoảng thời gian đã chọn.</td></tr>';
            return;
        }
        body.innerHTML = [...currentRevenueStatisticsData].reverse().map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.date}</td>
                <td>${item.invoices.toLocaleString("vi-VN")}</td>
                <td class="money">${money(item.revenue)}</td>
                <td class="money">${money(item.invoices ? item.revenue / item.invoices : 0)}</td>
                <td><button type="button" class="statistics-detail-button" data-statistics-date="${escapeHTML(item.isoDate)}">Xem chi tiết <span>›</span></button></td>
            </tr>
        `).join("");
    }

    function updatePeriodLabels() {
        const from = displayDate(currentFilters.from);
        const to = displayDate(currentFilters.to);
        const label = from && to ? `${from} – ${to}` : "Toàn bộ dữ liệu";
        const topPeriod = document.getElementById("statistics-top-period");
        const tablePeriod = document.getElementById("statistics-table-period");
        if (topPeriod) topPeriod.textContent = label;
        if (tablePeriod) tablePeriod.textContent = `Dữ liệu thực tế · ${label}`;
    }

    function renderAll() {
        renderKPI();
        renderChart();
        renderTopProducts();
        renderDailyTable();
        updatePeriodLabels();
    }

    function readFilters() {
        return {
            from: document.getElementById("statistics-from-date")?.value || "",
            to: document.getElementById("statistics-to-date")?.value || "",
            categoryId: document.getElementById("statistics-category")?.value || ""
        };
    }

    function applyStatisticsFilter(showMessage = true) {
        const filters = readFilters();
        if (!filters.from || !filters.to) {
            if (showMessage) alert("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");
            return;
        }
        if (filters.from > filters.to) {
            if (showMessage) alert("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
            return;
        }
        currentFilters = filters;
        currentContributions = collectContributions(filters);
        currentRevenueStatisticsData = aggregateDaily(currentContributions);
        calculateTopProducts(currentContributions);
        renderAll();
    }

    function paymentLabel(value) {
        const labels = { cash: "Tiền mặt", transfer: "Chuyển khoản", card: "Thẻ", other: "Khác" };
        return labels[value] || value || "Chưa xác định";
    }

    function openDailyDetail(date) {
        const modal = document.getElementById("statistics-detail-modal");
        const title = document.getElementById("statistics-detail-title");
        const body = document.getElementById("statistics-detail-body");
        if (!modal || !body) return;
        const rows = currentContributions.filter(entry => entry.invoice.date === date);
        const total = rows.reduce((sum, entry) => sum + Number(entry.revenue || 0), 0);
        if (title) title.textContent = `Hóa đơn ngày ${displayDate(date)}`;
        body.innerHTML = `
            <div class="statistics-detail-summary">
                <span>Số hóa đơn<strong>${rows.length.toLocaleString("vi-VN")}</strong></span>
                <span>Doanh thu theo bộ lọc<strong>${money(total)}</strong></span>
            </div>
            <table class="statistics-detail-table">
                <thead><tr><th>Mã hóa đơn</th><th>Khách hàng</th><th>Thanh toán</th><th>Doanh thu</th></tr></thead>
                <tbody>${rows.map(entry => `<tr>
                    <td><strong>${escapeHTML(entry.invoice.code || entry.invoice.invoiceCode || "")}</strong></td>
                    <td>${escapeHTML(entry.invoice.customerName || "Khách lẻ")}</td>
                    <td>${escapeHTML(paymentLabel(entry.invoice.paymentMethod))}</td>
                    <td>${money(entry.revenue)}</td>
                </tr>`).join("")}</tbody>
            </table>
        `;
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("statistics-detail-open");
    }

    function closeDailyDetail() {
        const modal = document.getElementById("statistics-detail-modal");
        if (!modal) return;
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("statistics-detail-open");
    }

    function setupInteractions() {
        const button = document.getElementById("statistics-filter-button");
        if (button && !button.dataset.initialized) {
            button.addEventListener("click", () => applyStatisticsFilter(true));
            button.dataset.initialized = "true";
        }

        document.querySelectorAll("[data-statistics-period]").forEach(periodButton => {
            if (periodButton.dataset.initialized) return;
            periodButton.addEventListener("click", () => setQuickPeriod(periodButton.dataset.statisticsPeriod));
            periodButton.dataset.initialized = "true";
        });

        ["statistics-from-date", "statistics-to-date"].forEach(id => {
            const input = document.getElementById(id);
            if (!input || input.dataset.initialized) return;
            input.addEventListener("change", () => {
                setActivePeriod("");
                applyStatisticsFilter(false);
            });
            input.dataset.initialized = "true";
        });

        ["statistics-category"].forEach(id => {
            const select = document.getElementById(id);
            if (!select || select.dataset.initialized) return;
            select.addEventListener("change", () => applyStatisticsFilter(false));
            select.dataset.initialized = "true";
        });

        const tableBody = document.getElementById("statistics-daily-table-body");
        if (tableBody && !tableBody.dataset.initialized) {
            tableBody.addEventListener("click", event => {
                const detailButton = event.target.closest("[data-statistics-date]");
                if (detailButton) openDailyDetail(detailButton.dataset.statisticsDate);
            });
            tableBody.dataset.initialized = "true";
        }

        const modal = document.getElementById("statistics-detail-modal");
        const closeButton = document.getElementById("statistics-detail-close");
        if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
        if (closeButton && !closeButton.dataset.initialized) {
            closeButton.addEventListener("click", closeDailyDetail);
            closeButton.dataset.initialized = "true";
        }
        if (modal && !modal.dataset.initialized) {
            modal.addEventListener("click", event => {
                if (event.target === modal) closeDailyDetail();
            });
            modal.dataset.initialized = "true";
        }

        if (!document.body.dataset.statisticsEscapeInitialized) {
            document.addEventListener("keydown", event => {
                if (event.key === "Escape") closeDailyDetail();
            });
            document.body.dataset.statisticsEscapeInitialized = "true";
        }
    }

    async function initRevenueStatistics() {
        if (typeof requirePermission === "function" && !requirePermission("revenue_statistics")) return;
        setupInteractions();
        const chart = document.getElementById("statistics-revenue-chart");
        if (chart) chart.innerHTML = '<div class="statistics-empty">Đang tải dữ liệu thật...</div>';
        try {
            await loadRealStatistics();
        } catch (error) {
            console.error("Không thể tải thống kê doanh thu:", error);
            revenueStatisticsData = [];
            topRevenueProducts = [];
            currentRevenueStatisticsData = [];
            currentContributions = [];
            renderAll();
        }
    }

    window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            if (document.getElementById("statistics-page")?.classList.contains("active")) renderChart();
        }, 180);
    });

    document.addEventListener("sales:data-changed", function () {
        if (document.getElementById("statistics-page")?.classList.contains("active")) {
            loadRealStatistics().catch(console.error);
        }
    });

    window.initRevenueStatistics = initRevenueStatistics;
})();
