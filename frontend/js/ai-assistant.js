/* =========================================================
   AI REPORT + SALES DATA Q&A
   Uses the sales data already available in the frontend.
   ========================================================= */

(function () {
    "use strict";

    let realSalesData = {
        daily: [],
        topProducts: [],
        warnings: [],
        totalProducts: 0,
        totalCustomers: 0,
        todayRevenue: 0,
        todayInvoices: 0
    };

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

    function getDailyRevenue() {
        return realSalesData.daily.map(item => ({ ...item }));
    }

    function getTopProducts() {
        return realSalesData.topProducts.map(item => ({ ...item }));
    }

    function getInventoryWarnings() {
        return realSalesData.warnings.map(item => ({ ...item }));
    }

    function getSalesSnapshot() {
        const daily = getDailyRevenue();
        const topProducts = getTopProducts();
        const warnings = getInventoryWarnings();
        const totalRevenue = daily.reduce((sum, item) => sum + item.revenue, 0);
        const totalInvoices = daily.reduce((sum, item) => sum + item.invoices, 0);
        const bestDay = daily.reduce(
            (best, item) => !best || item.revenue > best.revenue ? item : best,
            null
        );

        return {
            daily,
            topProducts,
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
        renderQAEmpty();
        const status = getElement("ai-qa-status");
        if (status) status.textContent = "Đang đồng bộ";
        try {
            await refreshAIData();
            if (status) status.textContent = "Dữ liệu thực";
        } catch (error) {
            if (status) status.textContent = "Lỗi tải dữ liệu";
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
                        <p>Chọn khoảng thời gian và nhấn “Tạo báo cáo AI”.</p>
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

    async function generateRevenueReport() {
        if (!canUse("revenue_statistics")) {
            return;
        }

        const result = getElement("ai-revenue-results");
        const status = getElement("ai-revenue-status");
        if (!result) {
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

        window.setTimeout(() => {
            const snapshot = getSalesSnapshot();
            const period = getElement("ai-revenue-period")?.value || "7";
            const requestedDays = period === "all" ? Number.NaN : Number(period);
            const daily = getRecentDaily(snapshot.daily, requestedDays);
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
            const bestProduct = snapshot.topProducts[0];

            const recommendations = [];
            recommendations.push(
                change >= 0
                    ? "Doanh thu đang có xu hướng tích cực; nên duy trì nhóm sản phẩm bán tốt và chương trình bán hàng hiện tại."
                    : "Doanh thu đang giảm; nên kiểm tra nguyên nhân theo ngày, nhân viên bán hàng và nhóm sản phẩm."
            );
            if (bestProduct) {
                recommendations.push(
                    `Ưu tiên bảo đảm tồn kho cho ${bestProduct.name}, hiện là sản phẩm nổi bật nhất.`
                );
            }
            if (snapshot.warnings.length > 0) {
                recommendations.push(
                    `Có ${snapshot.warnings.length} sản phẩm dưới mức tồn kho an toàn; cần lập kế hoạch nhập hàng.`
                );
            }

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
                        Dữ liệu ${daily.length} ngày ghi nhận doanh thu
                        <strong>${formatMoney(totalRevenue)}</strong> từ
                        <strong>${totalInvoices}</strong> hóa đơn. Doanh thu bình quân
                        giai đoạn sau ${trendText} so với giai đoạn đầu.
                    </p>
                    <p>
                        Ngày có doanh thu cao nhất là
                        <strong>${escapeHtml(bestDay?.date || "Chưa có dữ liệu")}</strong>
                        với <strong>${formatMoney(bestDay?.revenue || 0)}</strong>.
                    </p>
                </div>
                <div class="ai-analysis-block">
                    <h4>Đề xuất</h4>
                    <ul>${recommendations.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
                </div>
            `;
            if (status) {
                status.textContent = `${daily.length} ngày dữ liệu`;
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

        const input = getElement("ai-data-question");
        const result = getElement("ai-qa-results");
        const status = getElement("ai-qa-status");
        if (!input || !result) {
            return;
        }

        const question = input.value.trim();
        if (!question) {
            alert("Vui lòng nhập câu hỏi cần tra cứu.");
            input.focus();
            return;
        }

        if (status) {
            status.textContent = "Đang đồng bộ";
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

        const answer = buildDataAnswer(question, getSalesSnapshot());
        result.innerHTML = `
            <div class="ai-question-card">
                <span>Câu hỏi</span>
                <p>${escapeHtml(question)}</p>
            </div>
            <div class="ai-answer-card">
                <span>Trả lời từ dữ liệu hệ thống</span>
                <p>${escapeHtml(answer)}</p>
            </div>
        `;
        if (status) {
            status.textContent = "Đã trả lời";
        }
    }

    function resetRevenueReport() {
        const period = getElement("ai-revenue-period");
        if (period) {
            period.value = "7";
        }
        renderRevenueEmpty();
    }

    function resetSalesQA() {
        const input = getElement("ai-data-question");
        if (input) {
            input.value = "";
        }
        renderQAEmpty();
    }

    function setupAssistantEvents() {
        const revenueButton = getElement("ai-revenue-generate-button");
        const revenueReset = getElement("ai-revenue-reset-button");
        const qaButton = getElement("ai-qa-submit-button");
        const qaReset = getElement("ai-qa-reset-button");
        const questionInput = getElement("ai-data-question");

        if (revenueButton) {
            revenueButton.addEventListener("click", generateRevenueReport);
        }
        if (revenueReset) {
            revenueReset.addEventListener("click", resetRevenueReport);
        }
        if (qaButton) {
            qaButton.addEventListener("click", askSalesData);
        }
        if (qaReset) {
            qaReset.addEventListener("click", resetSalesQA);
        }
        if (questionInput) {
            questionInput.addEventListener("keydown", event => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    askSalesData();
                }
            });
        }

        document.querySelectorAll("[data-ai-question]").forEach(button => {
            button.addEventListener("click", () => {
                if (questionInput) {
                    questionInput.value = button.dataset.aiQuestion || "";
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
