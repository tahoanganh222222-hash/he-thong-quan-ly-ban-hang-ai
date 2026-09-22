/* =========================================================
   AI REPORT + SALES DATA Q&A
   Uses the sales data already available in the frontend.
   ========================================================= */

(function () {
    "use strict";

    let realSalesData = {
        daily: [],
        topProducts: [],
        productDaily: [],
        warnings: [],
        totalProducts: 0,
        totalCustomers: 0,
        todayRevenue: 0,
        todayInvoices: 0
    };
    let hasRealSalesData = false;
    let qaConversation = [];
    let qaRequestSequence = 0;
    let qaIsBusy = false;

    function localISODate() {
        const now = new Date();
        return [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")
        ].join("-");
    }

    async function refreshAIData() {
        const [invoiceList, products, inventory, customers] = await Promise.all([
            salesApi.invoices.list(),
            salesApi.products.list(),
            salesApi.inventory.list(),
            salesApi.customers.list()
        ]);
        const invoices = await Promise.all(
            invoiceList.map(invoice => salesApi.invoices.get(invoice.id))
        );
        const productsById = new Map(products.map(product => [product.id, product]));
        const dailyMap = new Map();
        const productMap = new Map();
        const productDailyMap = new Map();

        invoices.forEach(invoice => {
            const row = dailyMap.get(invoice.date) || {
                isoDate: invoice.date,
                date: invoice.date.split("-").reverse().join("/"),
                invoices: 0,
                revenue: 0
            };
            row.invoices += 1;
            row.revenue += Number(invoice.finalAmount || 0);
            dailyMap.set(invoice.date, row);

            const discountFactor = Number(invoice.totalAmount || 0) > 0
                ? Number(invoice.finalAmount || 0) / Number(invoice.totalAmount)
                : 1;
            (invoice.items || []).forEach(item => {
                const product = productsById.get(item.productId) || {};
                const sale = productMap.get(item.productId) || {
                    code: product.code || "",
                    name: item.productName || product.name || "Sản phẩm",
                    quantity: 0,
                    revenue: 0
                };
                sale.quantity += Number(item.quantity || 0);
                sale.revenue += Number(item.amount || 0) * discountFactor;
                productMap.set(item.productId, sale);

                const dailyProductKey = `${invoice.date}:${item.productId}`;
                const dailySale = productDailyMap.get(dailyProductKey) || {
                    isoDate: invoice.date,
                    productId: item.productId,
                    code: product.code || "",
                    name: item.productName || product.name || "Sản phẩm",
                    quantity: 0,
                    revenue: 0
                };
                dailySale.quantity += Number(item.quantity || 0);
                dailySale.revenue += Number(item.amount || 0) * discountFactor;
                productDailyMap.set(dailyProductKey, dailySale);
            });
        });

        const today = dailyMap.get(localISODate());
        realSalesData = {
            daily: [...dailyMap.values()].sort(
                (a, b) => a.isoDate.localeCompare(b.isoDate)
            ),
            topProducts: [...productMap.values()].sort(
                (a, b) => b.revenue - a.revenue
            ),
            productDaily: [...productDailyMap.values()],
            warnings: inventory
                .filter(item => Number(item.quantity || 0) <= Number(item.minimum || 0))
                .map(item => ({
                    name: item.name || "Sản phẩm",
                    quantity: Number(item.quantity || 0),
                    minimum: Number(item.minimum || 0)
                })),
            totalProducts: products.length,
            totalCustomers: customers.length,
            todayRevenue: Number(today?.revenue || 0),
            todayInvoices: Number(today?.invoices || 0)
        };
        hasRealSalesData = true;
        return realSalesData;
    }

    function getElement(id) {
        return document.getElementById(id);
    }

    function formatMoney(value) {
        return Number(value || 0).toLocaleString("vi-VN") + " ₫";
    }

    function normalizeText(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d");
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatAIText(value) {
        return escapeHtml(value)
            .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
            .replace(/`([^`\n]+)`/g, "<code>$1</code>")
            .replace(/\r?\n/g, "<br>")
            .replace(/(^|<br>)\s*[-*•]\s+/g, '$1<span class="ai-inline-bullet">•</span> ');
    }

    function getDailyRevenue() {
        return realSalesData.daily.map(item => ({ ...item }));
    }

    function getTopProducts() {
        return realSalesData.topProducts.map(item => ({ ...item }));
    }

    function getInventoryWarnings() {
        return realSalesData.warnings.map(item => ({ ...item }));
    }

    function getProductDailySales() {
        return realSalesData.productDaily.map(item => ({ ...item }));
    }

    function getSalesSnapshot() {
        const daily = getDailyRevenue();
        const topProducts = getTopProducts();
        const warnings = getInventoryWarnings();
        const productDaily = getProductDailySales();
        const totalRevenue = daily.reduce((sum, item) => sum + item.revenue, 0);
        const totalInvoices = daily.reduce((sum, item) => sum + item.invoices, 0);
        const bestDay = daily.reduce(
            (best, item) => !best || item.revenue > best.revenue ? item : best,
            null
        );

        return {
            daily,
            topProducts,
            productDaily,
            warnings,
            totalRevenue,
            totalInvoices,
            bestDay,
            todayRevenue: realSalesData.todayRevenue,
            todayInvoices: realSalesData.todayInvoices,
            totalProducts: realSalesData.totalProducts,
            totalCustomers: realSalesData.totalCustomers
        };
    }

    function canUse(permissionKey) {
        if (typeof window.requirePermission !== "function") {
            return true;
        }

        return window.requirePermission(permissionKey);
    }

    const managedPageIds = [
        "products-page",
        "categories-page",
        "customers-page",
        "sales-invoice-page",
        "purchase-page",
        "inventory-page",
        "history-page",
        "statistics-page",
        "reports-page",
        "users-page",
        "permissions-page",
        "ai-product-page",
        "ai-revenue-page",
        "ai-qa-page"
    ];

    function showAssistantPage(pageId, title, description, permissionKey) {
        if (!canUse(permissionKey)) {
            return;
        }

        const dashboard = document.querySelector(".dashboard-content");
        if (dashboard) {
            dashboard.style.display = "none";
        }

        managedPageIds.forEach(id => {
            const page = getElement(id);
            if (page) {
                page.classList.remove("active");
            }
        });

        const target = getElement(pageId);
        if (target) {
            target.classList.add("active");
        }

        const heading = document.querySelector(".topbar h1");
        const subtitle = document.querySelector(".topbar p");
        if (heading) {
            heading.textContent = title;
        }
        if (subtitle) {
            subtitle.textContent = description;
        }

        const menuPage = pageId.replace("-page", "");
        document.querySelectorAll(".menu-item").forEach(item => {
            item.classList.toggle("active", item.dataset.page === menuPage);
        });
    }

    async function showAIRevenuePage() {
        showAssistantPage(
            "ai-revenue-page",
            "AI báo cáo doanh thu",
            "Phân tích tự động tình hình bán hàng",
            "revenue_statistics"
        );
        renderRevenueEmpty();
        const status = getElement("ai-revenue-status");
        if (status) status.textContent = "Đang đồng bộ";
        try {
            await refreshAIData();
            if (status) status.textContent = "Dữ liệu thực";
        } catch (error) {
            if (status) status.textContent = "Lỗi tải dữ liệu";
            console.error("Không thể tải dữ liệu AI doanh thu:", error);
        }
    }

    async function showAIQAPage() {
        showAssistantPage(
            "ai-qa-page",
            "AI hỏi đáp dữ liệu",
            "Tra cứu nhanh số liệu bán hàng bằng tiếng Việt",
            "sales_data_qa"
        );
        if (qaConversation.length) {
            renderQAConversation(false);
        } else {
            renderQAEmpty();
        }
        const status = getElement("ai-qa-status");
        if (status && !qaConversation.length) status.textContent = "Đang đồng bộ";
        try {
            await refreshAIData();
            if (status && !qaIsBusy) {
                status.textContent = qaConversation.length
                    ? `${qaConversation.length} câu hỏi trong phiên`
                    : "Dữ liệu thực";
            }
        } catch (error) {
            if (status && !qaIsBusy && !qaConversation.length) {
                status.textContent = "Chưa đồng bộ dữ liệu";
            }
            console.error("Không thể tải dữ liệu AI hỏi đáp:", error);
        }
    }

    function renderRevenueEmpty() {
        const result = getElement("ai-revenue-results");
        const status = getElement("ai-revenue-status");
        if (status) {
            status.textContent = "Chưa tạo báo cáo";
        }
        if (result) {
            result.innerHTML = `
                <div class="ai-empty-result">
                    <div>
                        <div class="ai-empty-result-icon">📊</div>
                        <h4>Chưa có kết quả phân tích</h4>
                        <p>Chọn khoảng thời gian, nhập nội dung cần phân tích và nhấn “Tạo báo cáo AI”.</p>
                    </div>
                </div>
            `;
        }
    }

    function getRecentDaily(daily, days) {
        if (!daily.length || !Number.isFinite(days)) {
            return [...daily];
        }
        const end = new Date(daily[daily.length - 1].isoDate + "T00:00:00");
        const start = new Date(end);
        start.setDate(start.getDate() - days + 1);
        const startISO = [
            start.getFullYear(),
            String(start.getMonth() + 1).padStart(2, "0"),
            String(start.getDate()).padStart(2, "0")
        ].join("-");
        return daily.filter(item => item.isoDate >= startISO);
    }

    function shiftISODate(isoDate, dayOffset) {
        const value = new Date(`${isoDate}T00:00:00`);
        value.setDate(value.getDate() + dayOffset);
        return [
            value.getFullYear(),
            String(value.getMonth() + 1).padStart(2, "0"),
            String(value.getDate()).padStart(2, "0")
        ].join("-");
    }

    function displayISODate(isoDate) {
        return isoDate ? isoDate.split("-").reverse().join("/") : "";
    }

    function setRevenueRangeError(message = "") {
        const errorElement = getElement("ai-revenue-range-error");
        const fromDate = getElement("ai-revenue-from-date");
        const toDate = getElement("ai-revenue-to-date");
        [fromDate, toDate].forEach(input => input?.classList.toggle("is-invalid", Boolean(message)));
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.hidden = !message;
        }
    }

    function updateRevenueRangeUI() {
        const period = getElement("ai-revenue-period")?.value || "7";
        const range = getElement("ai-revenue-custom-range");
        const fromDate = getElement("ai-revenue-from-date");
        const toDate = getElement("ai-revenue-to-date");
        const isCustom = period === "custom";
        if (range) range.hidden = !isCustom;
        if (fromDate) fromDate.disabled = !isCustom;
        if (toDate) toDate.disabled = !isCustom;

        if (isCustom && fromDate && toDate && (!fromDate.value || !toDate.value)) {
            const latestDate = realSalesData.daily.at(-1)?.isoDate || localISODate();
            toDate.value = toDate.value || latestDate;
            fromDate.value = fromDate.value || shiftISODate(latestDate, -6);
        }
        setRevenueRangeError();
    }

    function updateRevenueFocusCounter() {
        const input = getElement("ai-revenue-focus");
        const counter = getElement("ai-revenue-focus-count");
        if (counter) {
            counter.textContent = `${input?.value.length || 0}/500`;
        }
    }

    function readRevenueSelection() {
        const period = getElement("ai-revenue-period")?.value || "7";
        const fromDate = getElement("ai-revenue-from-date")?.value || "";
        const toDate = getElement("ai-revenue-to-date")?.value || "";
        const focus = (getElement("ai-revenue-focus")?.value || "").trim();

        if (period === "custom" && (!fromDate || !toDate)) {
            setRevenueRangeError("Vui lòng chọn đủ ngày bắt đầu và ngày kết thúc.");
            return null;
        }
        if (period === "custom" && fromDate > toDate) {
            setRevenueRangeError("Ngày bắt đầu không được sau ngày kết thúc.");
            return null;
        }
        setRevenueRangeError();
        return {
            period,
            fromDate: period === "custom" ? fromDate : null,
            toDate: period === "custom" ? toDate : null,
            focus: focus || null
        };
    }

    function getRevenueDailyForSelection(daily, selection) {
        if (selection.period === "custom") {
            return daily.filter(item => (
                item.isoDate >= selection.fromDate && item.isoDate <= selection.toDate
            ));
        }
        const requestedDays = selection.period === "all"
            ? Number.NaN
            : Number(selection.period);
        return getRecentDaily(daily, requestedDays);
    }

    function getBestProductForPeriod(productDaily, daily) {
        const selectedDates = new Set(daily.map(item => item.isoDate));
        const totals = new Map();
        productDaily.forEach(item => {
            if (!selectedDates.has(item.isoDate)) return;
            const total = totals.get(item.productId) || {
                name: item.name,
                quantity: 0,
                revenue: 0
            };
            total.quantity += Number(item.quantity || 0);
            total.revenue += Number(item.revenue || 0);
            totals.set(item.productId, total);
        });
        return [...totals.values()].sort((a, b) => b.revenue - a.revenue)[0] || null;
    }

    function getRevenueRangeLabel(selection, daily) {
        if (selection.period === "custom") {
            return `${displayISODate(selection.fromDate)} – ${displayISODate(selection.toDate)}`;
        }
        if (selection.period === "all") return "toàn bộ dữ liệu";
        return `${daily.length} ngày dữ liệu`;
    }

    async function generateRevenueReport() {
        if (!canUse("revenue_statistics")) {
            return;
        }

        const selection = readRevenueSelection();
        const result = getElement("ai-revenue-results");
        const status = getElement("ai-revenue-status");
        if (!result || !selection) {
            if (status && !selection) status.textContent = "Kiểm tra khoảng ngày";
            return;
        }

        result.innerHTML = `
            <div class="ai-loading">
                <div>
                    <div class="ai-loading-spinner"></div>
                    <p>Đang phân tích dữ liệu bán hàng...</p>
                </div>
            </div>
        `;
        if (status) {
            status.textContent = "Đang phân tích";
        }

        try {
            await refreshAIData();
        } catch (error) {
            result.innerHTML = `
                <div class="ai-no-product">
                    <h4>Không thể tải dữ liệu bán hàng</h4>
                    <p>${escapeHtml(error.message || "Vui lòng kiểm tra kết nối backend.")}</p>
                </div>
            `;
            if (status) status.textContent = "Lỗi tải dữ liệu";
            return;
        }

        window.setTimeout(async () => {
            const snapshot = getSalesSnapshot();
            const daily = getRevenueDailyForSelection(snapshot.daily, selection);
            const totalRevenue = daily.reduce((sum, item) => sum + item.revenue, 0);
            const totalInvoices = daily.reduce((sum, item) => sum + item.invoices, 0);
            const averageInvoice = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
            const bestDay = daily.reduce(
                (best, item) => !best || item.revenue > best.revenue ? item : best,
                null
            );
            const midpoint = Math.max(1, Math.floor(daily.length / 2));
            const firstPart = daily.slice(0, midpoint);
            const lastPart = daily.slice(midpoint);
            const firstAverage = firstPart.length
                ? firstPart.reduce((sum, item) => sum + item.revenue, 0) / firstPart.length
                : 0;
            const lastAverage = lastPart.length
                ? lastPart.reduce((sum, item) => sum + item.revenue, 0) / lastPart.length
                : firstAverage;
            const change = firstAverage > 0
                ? ((lastAverage - firstAverage) / firstAverage) * 100
                : 0;
            const trendText = change >= 0
                ? `tăng ${Math.abs(change).toFixed(1)}%`
                : `giảm ${Math.abs(change).toFixed(1)}%`;
            const bestProduct = getBestProductForPeriod(snapshot.productDaily, daily);
            const rangeLabel = getRevenueRangeLabel(selection, daily);

            const trendSummary = daily.length < 2
                ? "Chưa đủ dữ liệu theo ngày để so sánh xu hướng."
                : `Doanh thu bình quân giai đoạn sau ${trendText} so với giai đoạn đầu.`;
            const productSummary = bestProduct
                ? `Sản phẩm nổi bật nhất trong phạm vi là ${bestProduct.name} với ${bestProduct.quantity.toLocaleString("vi-VN")} sản phẩm đã bán.`
                : "Chưa có sản phẩm bán ra trong phạm vi này.";

            result.innerHTML = `
                <div class="ai-summary-grid">
                    <div class="ai-summary-item">
                        <span>Doanh thu</span>
                        <strong>${formatMoney(totalRevenue)}</strong>
                    </div>
                    <div class="ai-summary-item">
                        <span>Hóa đơn</span>
                        <strong>${totalInvoices.toLocaleString("vi-VN")}</strong>
                    </div>
                    <div class="ai-summary-item">
                        <span>Trung bình/hóa đơn</span>
                        <strong>${formatMoney(averageInvoice)}</strong>
                    </div>
                </div>
                <div class="ai-analysis-block">
                    <h4>Nhận xét tự động</h4>
                    <p>
                        Phạm vi <strong>${escapeHtml(rangeLabel)}</strong> ghi nhận doanh thu
                        <strong>${formatMoney(totalRevenue)}</strong> từ
                        <strong>${totalInvoices}</strong> hóa đơn. ${escapeHtml(trendSummary)}
                    </p>
                    <p>
                        Ngày có doanh thu cao nhất là
                        <strong>${escapeHtml(bestDay?.date || "Chưa có dữ liệu")}</strong>
                        với <strong>${formatMoney(bestDay?.revenue || 0)}</strong>.
                    </p>
                </div>
                <div class="ai-analysis-block">
                    <h4>Dữ liệu sản phẩm</h4>
                    <p>${escapeHtml(productSummary)}</p>
                </div>
            `;
            if (status) status.textContent = "Đang hỏi Gemini";
            try {
                const aiResponse = await window.salesApi.ai.revenueAnalysis(selection);
                result.insertAdjacentHTML("beforeend", `
                    <div class="ai-analysis-block">
                        <h4>${selection.focus ? "Gemini trả lời yêu cầu" : "Phân tích từ Gemini"}</h4>
                        ${selection.focus ? `<p class="ai-analysis-request"><strong>Yêu cầu:</strong> ${escapeHtml(selection.focus)}</p>` : ""}
                        <p>${formatAIText(aiResponse.answer)}</p>
                    </div>
                `);
                if (status) status.textContent = `Gemini • ${rangeLabel}`;
            } catch (error) {
                if (error.status === 401) return;
                result.insertAdjacentHTML("beforeend", `
                    <div class="ai-analysis-block">
                        <h4>Gemini chưa phản hồi</h4>
                        <p>${escapeHtml(error.message || "Đang dùng kết quả phân tích nội bộ.")}</p>
                    </div>
                `);
                if (status) status.textContent = `${rangeLabel} • nội bộ`;
            }
        }, 350);
    }

    function renderQAEmpty() {
        const result = getElement("ai-qa-results");
        const status = getElement("ai-qa-status");
        if (status) {
            status.textContent = "Sẵn sàng";
        }
        if (result) {
            result.innerHTML = `
                <div class="ai-empty-result">
                    <div>
                        <div class="ai-empty-result-icon">💬</div>
                        <h4>Hãy đặt câu hỏi về dữ liệu bán hàng</h4>
                        <p>Bạn có thể dùng một câu hỏi gợi ý ở bên trái.</p>
                    </div>
                </div>
            `;
        }
    }

    function setQABusy(busy) {
        qaIsBusy = busy;
        const button = getElement("ai-qa-submit-button");
        if (button) {
            button.disabled = busy;
            button.classList.toggle("is-loading", busy);
            button.innerHTML = busy
                ? '<span class="ai-button-spinner" aria-hidden="true"></span> Đang phân tích...'
                : '<span class="ai-button-icon">✦</span> Hỏi Gemini';
        }
        document.querySelectorAll("[data-ai-question]").forEach(item => {
            item.disabled = busy;
        });
    }

    function updateQuestionInput() {
        const input = getElement("ai-data-question");
        const counter = getElement("ai-qa-character-count");
        if (!input) return;
        input.style.height = "auto";
        input.style.height = `${Math.min(Math.max(input.scrollHeight, 112), 190)}px`;
        if (counter) counter.textContent = `${input.value.length}/500`;
        input.classList.remove("is-invalid");
    }

    function renderQAConversation(scrollToLatest = true) {
        const result = getElement("ai-qa-results");
        if (!result) return;
        if (!qaConversation.length) {
            renderQAEmpty();
            return;
        }

        result.innerHTML = `
            <div class="ai-chat-thread" role="log" aria-live="polite">
                ${qaConversation.map((entry, index) => `
                    <article class="ai-chat-exchange${index === qaConversation.length - 1 ? " latest" : ""}">
                        <div class="ai-chat-row question">
                            <span class="ai-chat-avatar user" aria-hidden="true">B</span>
                            <div class="ai-question-card">
                                <span>Bạn hỏi</span>
                                <p>${escapeHtml(entry.question)}</p>
                            </div>
                        </div>
                        <div class="ai-chat-row answer">
                            <span class="ai-chat-avatar assistant" aria-hidden="true">✦</span>
                            <div class="ai-answer-card${entry.error ? " error" : ""}">
                                <span>${escapeHtml(entry.source || "Gemini đang phân tích")}</span>
                                ${entry.pending ? `
                                    <div class="ai-typing" aria-label="AI đang soạn câu trả lời">
                                        <i></i><i></i><i></i>
                                    </div>
                                ` : `<p>${formatAIText(entry.answer)}</p>`}
                            </div>
                        </div>
                    </article>
                `).join("")}
            </div>
        `;

        if (scrollToLatest) {
            requestAnimationFrame(() => {
                result.querySelector(".ai-chat-exchange.latest")?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest"
                });
            });
        }
    }

    function buildDataAnswer(question, snapshot) {
        const normalized = normalizeText(question);

        if (normalized.includes("ban chay") || normalized.includes("tot nhat")) {
            const product = snapshot.topProducts[0];
            if (!product) {
                return "Chưa có dữ liệu sản phẩm bán chạy.";
            }
            const detail = product.revenue > 0
                ? `, doanh thu ${formatMoney(product.revenue)}`
                : product.quantity > 0
                    ? `, số lượng bán ${product.quantity}`
                    : "";
            return `Sản phẩm nổi bật nhất là ${product.name}${detail}.`;
        }

        if (
            normalized.includes("ton kho") ||
            normalized.includes("sap het") ||
            normalized.includes("het hang") ||
            normalized.includes("nhap hang")
        ) {
            if (snapshot.warnings.length === 0) {
                return "Hiện không có sản phẩm nào dưới mức tồn kho tối thiểu.";
            }
            const items = snapshot.warnings
                .map(item => `${item.name}: còn ${item.quantity}, tối thiểu ${item.minimum}`)
                .join("; ");
            return `Có ${snapshot.warnings.length} sản phẩm cần chú ý tồn kho: ${items}.`;
        }

        if (normalized.includes("hoa don")) {
            if (normalized.includes("hom nay")) {
                return `Hôm nay có ${snapshot.todayInvoices.toLocaleString("vi-VN")} hóa đơn.`;
            }
            return `Trong ${snapshot.daily.length} ngày dữ liệu có ${snapshot.totalInvoices.toLocaleString("vi-VN")} hóa đơn, giá trị trung bình ${formatMoney(snapshot.totalInvoices ? snapshot.totalRevenue / snapshot.totalInvoices : 0)} mỗi hóa đơn.`;
        }

        if (normalized.includes("doanh thu")) {
            if (normalized.includes("hom nay")) {
                return `Doanh thu hôm nay là ${formatMoney(snapshot.todayRevenue)}.`;
            }
            const asksSevenDays = /(^|\D)7(\D|$)/.test(normalized);
            const daily = asksSevenDays
                ? getRecentDaily(snapshot.daily, 7)
                : snapshot.daily;
            const revenue = daily.reduce((sum, item) => sum + item.revenue, 0);
            const invoices = daily.reduce((sum, item) => sum + item.invoices, 0);
            const bestDay = daily.reduce(
                (best, item) => !best || item.revenue > best.revenue ? item : best,
                null
            );
            return `${asksSevenDays ? "Doanh thu 7 ngày gần nhất" : "Tổng doanh thu"} là ${formatMoney(revenue)} từ ${invoices} hóa đơn. Ngày cao nhất là ${bestDay?.date || "chưa xác định"} với ${formatMoney(bestDay?.revenue || 0)}.`;
        }

        if (normalized.includes("khach hang")) {
            return snapshot.totalCustomers > 0
                ? `Hệ thống đang ghi nhận ${snapshot.totalCustomers.toLocaleString("vi-VN")} khách hàng.`
                : "Mô-đun khách hàng đã sẵn sàng, nhưng dữ liệu tổng khách hàng chưa được đồng bộ vào báo cáo.";
        }

        if (normalized.includes("san pham")) {
            return snapshot.totalProducts > 0
                ? `Hệ thống đang quản lý ${snapshot.totalProducts.toLocaleString("vi-VN")} sản phẩm.`
                : `Báo cáo hiện có dữ liệu xếp hạng của ${snapshot.topProducts.length} sản phẩm nổi bật.`;
        }

        return "Mình chưa xác định được chỉ số cần tra cứu. Hãy hỏi về doanh thu, hóa đơn, khách hàng, sản phẩm bán chạy hoặc cảnh báo tồn kho.";
    }

    async function askSalesData() {
        if (!canUse("sales_data_qa")) {
            return;
        }

        if (qaIsBusy) {
            return;
        }

        const input = getElement("ai-data-question");
        const status = getElement("ai-qa-status");
        if (!input) {
            return;
        }

        const question = input.value.trim();
        if (!question) {
            input.classList.add("is-invalid");
            if (status) status.textContent = "Hãy nhập câu hỏi";
            input.focus();
            return;
        }

        const requestId = ++qaRequestSequence;
        const entry = {
            id: requestId,
            question,
            answer: "",
            source: "Gemini đang phân tích",
            pending: true,
            error: false
        };
        qaConversation.push(entry);
        input.value = "";
        updateQuestionInput();
        setQABusy(true);
        if (status) status.textContent = "Đang đọc dữ liệu";
        renderQAConversation();

        let answer = "";
        let answerSource = "Trả lời từ Gemini";
        let answerError = false;
        try {
            const aiResponse = await window.salesApi.ai.salesQA(question);
            answer = aiResponse.answer || "";
            if (!answer.trim()) {
                throw new Error("Gemini chưa trả về nội dung.");
            }
        } catch (error) {
            if (error.status === 401) {
                if (requestId === qaRequestSequence) {
                    qaConversation = qaConversation.filter(item => item.id !== requestId);
                    setQABusy(false);
                    renderQAConversation(false);
                }
                return;
            }
            if (status) status.textContent = "Đang dùng dữ liệu dự phòng";
            try {
                if (!hasRealSalesData) {
                    await refreshAIData();
                }
                answer = buildDataAnswer(question, getSalesSnapshot());
                answerSource = "Trả lời từ dữ liệu nội bộ";
            } catch (fallbackError) {
                answer = fallbackError.message || error.message || "Không thể xử lý câu hỏi lúc này.";
                answerSource = "Không thể kết nối dữ liệu";
                answerError = true;
            }
        }

        if (requestId !== qaRequestSequence) {
            return;
        }

        entry.answer = answer;
        entry.source = answerSource;
        entry.pending = false;
        entry.error = answerError;
        renderQAConversation();
        setQABusy(false);
        if (status) {
            status.textContent = answerError
                ? "Có lỗi kết nối"
                : `${qaConversation.length} câu hỏi trong phiên`;
        }
        input.focus();
    }

    function resetRevenueReport() {
        const period = getElement("ai-revenue-period");
        const fromDate = getElement("ai-revenue-from-date");
        const toDate = getElement("ai-revenue-to-date");
        const focus = getElement("ai-revenue-focus");
        if (period) {
            period.value = "7";
        }
        if (fromDate) fromDate.value = "";
        if (toDate) toDate.value = "";
        if (focus) focus.value = "";
        updateRevenueRangeUI();
        updateRevenueFocusCounter();
        renderRevenueEmpty();
    }

    function resetSalesQA() {
        qaRequestSequence += 1;
        qaConversation = [];
        setQABusy(false);
        const input = getElement("ai-data-question");
        if (input) {
            input.value = "";
            updateQuestionInput();
            input.focus();
        }
        renderQAEmpty();
    }

    function setupAssistantEvents() {
        const revenueButton = getElement("ai-revenue-generate-button");
        const revenueReset = getElement("ai-revenue-reset-button");
        const revenuePeriod = getElement("ai-revenue-period");
        const revenueFromDate = getElement("ai-revenue-from-date");
        const revenueToDate = getElement("ai-revenue-to-date");
        const revenueFocus = getElement("ai-revenue-focus");
        const qaButton = getElement("ai-qa-submit-button");
        const qaReset = getElement("ai-qa-reset-button");
        const questionInput = getElement("ai-data-question");

        if (revenueButton) {
            revenueButton.addEventListener("click", generateRevenueReport);
        }
        if (revenueReset) {
            revenueReset.addEventListener("click", resetRevenueReport);
        }
        if (revenuePeriod) {
            revenuePeriod.addEventListener("change", updateRevenueRangeUI);
        }
        [revenueFromDate, revenueToDate].forEach(input => {
            input?.addEventListener("change", () => setRevenueRangeError());
        });
        if (revenueFocus) {
            revenueFocus.addEventListener("input", updateRevenueFocusCounter);
            revenueFocus.addEventListener("keydown", event => {
                if (event.key === "Enter" && event.ctrlKey && !event.isComposing) {
                    event.preventDefault();
                    generateRevenueReport();
                }
            });
        }
        if (qaButton) {
            qaButton.addEventListener("click", askSalesData);
        }
        if (qaReset) {
            qaReset.addEventListener("click", resetSalesQA);
        }
        if (questionInput) {
            questionInput.addEventListener("input", updateQuestionInput);
            questionInput.addEventListener("keydown", event => {
                if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.isComposing
                ) {
                    event.preventDefault();
                    askSalesData();
                }
            });
            updateQuestionInput();
        }

        updateRevenueRangeUI();
        updateRevenueFocusCounter();

        document.querySelectorAll("[data-ai-question]").forEach(button => {
            button.addEventListener("click", () => {
                if (questionInput) {
                    questionInput.value = button.dataset.aiQuestion || "";
                    updateQuestionInput();
                }
                askSalesData();
            });
        });

        document.querySelectorAll(".menu-item[data-page]").forEach(item => {
            item.addEventListener("click", () => {
                const page = item.dataset.page;
                const revenuePage = getElement("ai-revenue-page");
                const qaPage = getElement("ai-qa-page");

                if (page !== "ai-revenue" && revenuePage) {
                    revenuePage.classList.remove("active");
                }
                if (page !== "ai-qa" && qaPage) {
                    qaPage.classList.remove("active");
                }

            });
        });

        renderRevenueEmpty();
        renderQAEmpty();
    }

    window.showAIRevenuePage = showAIRevenuePage;
    window.showAIQAPage = showAIQAPage;
    window.generateAIRevenueReport = generateRevenueReport;
    window.askSalesData = askSalesData;
    window.refreshAIData = refreshAIData;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupAssistantEvents);
    } else {
        setupAssistantEvents();
    }
})();
