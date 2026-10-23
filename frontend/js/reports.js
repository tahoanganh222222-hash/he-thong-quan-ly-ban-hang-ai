/* Báo cáo tổng hợp từ dữ liệu thật trong SQL Server. */
(function () {
    "use strict";

    let sourceData = { invoices: [], products: [], inventory: [] };
    let currentReport = { revenue: [], products: [], inventory: [], invoices: [] };
    let dateRangeInitialized = false;

    const money = value => Number(value || 0).toLocaleString("vi-VN") + " ₫";
    const compactMoney = value => {
        const amount = Number(value || 0);
        const format = number => Number(number.toFixed(1)).toLocaleString("vi-VN");
        if (Math.abs(amount) >= 1_000_000_000) return `${format(amount / 1_000_000_000)} tỷ`;
        if (Math.abs(amount) >= 1_000_000) return `${format(amount / 1_000_000)}tr`;
        if (Math.abs(amount) >= 1_000) return `${format(amount / 1_000)}k`;
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

    async function loadReportSource() {
        const [invoices, products, inventory] = await Promise.all([
            salesApi.invoices.list(),
            salesApi.products.list(),
            salesApi.inventory.list()
        ]);
        const detailedInvoices = await Promise.all(
            invoices.map(invoice => salesApi.invoices.get(invoice.id))
        );
        sourceData = { invoices: detailedInvoices, products, inventory };
    }

    function initializeDateRange() {
        if (!sourceData.invoices.length) return;
        const dates = sourceData.invoices.map(item => item.date).filter(Boolean).sort();
        const from = document.getElementById("reports-from-date");
        const to = document.getElementById("reports-to-date");
        if (from && to) {
            const followedFirstDate = !dateRangeInitialized || from.value === from.min;
            const followedLastDate = !dateRangeInitialized || to.value === to.max;
            from.min = dates[0];
            from.max = dates[dates.length - 1];
            to.min = dates[0];
            to.max = dates[dates.length - 1];
            if (followedFirstDate) from.value = dates[0];
            if (followedLastDate) to.value = dates[dates.length - 1];
            dateRangeInitialized = true;
        }
    }

    function buildReport(fromDate, toDate) {
        const invoices = sourceData.invoices.filter(
            invoice => invoice.date >= fromDate && invoice.date <= toDate
        );
        const revenueByDate = new Map();
        const productsById = new Map(sourceData.products.map(item => [item.id, item]));
        const soldByProduct = new Map();

        invoices.forEach(invoice => {
            const daily = revenueByDate.get(invoice.date) || {
                isoDate: invoice.date,
                date: displayDate(invoice.date),
                invoices: 0,
                revenue: 0
            };
            daily.invoices += 1;
            daily.revenue += Number(invoice.finalAmount || 0);
            revenueByDate.set(invoice.date, daily);

            const discountFactor = Number(invoice.totalAmount || 0) > 0
                ? Number(invoice.finalAmount || 0) / Number(invoice.totalAmount)
                : 1;
            (invoice.items || []).forEach(item => {
                const product = productsById.get(item.productId) || {};
                const sold = soldByProduct.get(item.productId) || {
                    productId: item.productId,
                    code: product.code || "",
                    name: item.productName || product.name || "",
                    category: product.category || "Khác",
                    imageData: item.productImageData || product.imageData || "",
                    sold: 0,
                    revenue: 0
                };
                sold.sold += Number(item.quantity || 0);
                sold.revenue += Number(item.amount || 0) * discountFactor;
                soldByProduct.set(item.productId, sold);
            });
        });

        currentReport = {
            invoices,
            revenue: [...revenueByDate.values()].sort((a, b) => a.isoDate.localeCompare(b.isoDate)),
            products: [...soldByProduct.values()].sort((a, b) => b.sold - a.sold),
            inventory: sourceData.inventory
        };
    }

    function renderSummary() {
        const totalRevenue = currentReport.invoices.reduce(
            (sum, item) => sum + Number(item.finalAmount || 0), 0
        );
        const productsSold = currentReport.products.reduce(
            (sum, item) => sum + Number(item.sold || 0), 0
        );
        const productMap = new Map(sourceData.products.map(item => [item.id, item]));
        const inventoryValue = currentReport.inventory.reduce((sum, item) => {
            const product = productMap.get(item.productId) || {};
            return sum + Number(item.quantity || 0) * Number(product.purchasePrice || 0);
        }, 0);
        document.getElementById("report-total-revenue").textContent = money(totalRevenue);
        document.getElementById("report-total-invoices").textContent =
            currentReport.invoices.length.toLocaleString("vi-VN");
        document.getElementById("report-products-sold").textContent =
            productsSold.toLocaleString("vi-VN");
        const inventoryValueElement = document.getElementById("report-inventory-value");
        if (inventoryValueElement) inventoryValueElement.textContent = money(inventoryValue);
    }

    function renderRevenueChart() {
        const container = document.getElementById("report-revenue-chart");
        if (!container) return;
        const data = currentReport.revenue;
        if (!data.length) {
            container.innerHTML = '<div class="reports-chart-empty">Không có dữ liệu doanh thu trong kỳ đã chọn.</div>';
            return;
        }

        const width = 720;
        const height = 220;
        const left = 54;
        const right = 14;
        const top = 16;
        const bottom = 34;
        const chartWidth = width - left - right;
        const chartHeight = height - top - bottom;
        const maximum = Math.max(...data.map(item => Number(item.revenue || 0)), 1);
        const scaleMax = Math.ceil(maximum / 4) * 4 || 1;
        const points = data.map((item, index) => ({
            item,
            x: data.length === 1 ? left + chartWidth / 2 : left + index * chartWidth / (data.length - 1),
            y: top + chartHeight - Number(item.revenue || 0) / scaleMax * chartHeight
        }));
        const line = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
        const baseline = top + chartHeight;
        const area = `${line} L${points.at(-1).x},${baseline} L${points[0].x},${baseline} Z`;
        const labelStep = Math.max(1, Math.ceil(data.length / 7));

        container.innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Doanh thu theo ngày">
                <defs>
                    <linearGradient id="reportRevenueArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#4f70f4" stop-opacity=".28"></stop>
                        <stop offset="100%" stop-color="#4f70f4" stop-opacity=".03"></stop>
                    </linearGradient>
                </defs>
                ${[0, 1, 2, 3, 4].map(index => {
                    const y = top + index * chartHeight / 4;
                    const value = scaleMax - index * scaleMax / 4;
                    return `<line class="reports-chart-grid-line" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line>
                        <text class="reports-chart-y-label" x="${left - 9}" y="${y + 4}" text-anchor="end">${compactMoney(value)}</text>`;
                }).join("")}
                <path class="reports-chart-area" d="${area}"></path>
                <path class="reports-chart-line" d="${line}"></path>
                ${points.map((point, index) => `
                    <g>
                        <circle class="reports-chart-point" cx="${point.x}" cy="${point.y}" r="4"><title>${escapeHTML(point.item.date)} · ${money(point.item.revenue)}</title></circle>
                        ${index % labelStep === 0 || index === points.length - 1 ? `<text class="reports-chart-x-label" x="${point.x}" y="${height - 9}" text-anchor="middle">${escapeHTML(point.item.date.slice(0, 5))}</text>` : ""}
                    </g>
                `).join("")}
            </svg>`;
    }

    function renderCategoryChart() {
        const donut = document.getElementById("report-category-donut");
        const legend = document.getElementById("report-category-legend");
        const totalElement = document.getElementById("report-category-total");
        if (!donut || !legend || !totalElement) return;

        const grouped = new Map();
        currentReport.products.forEach(item => {
            const category = item.category || "Khác";
            grouped.set(category, (grouped.get(category) || 0) + Number(item.revenue || 0));
        });
        const entries = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((sum, item) => sum + item[1], 0);
        const colors = ["#4f91f4", "#31c49a", "#f7b73f", "#9366e9", "#94a3b8", "#38bdf8"];
        let cursor = 0;
        const stops = entries.map(([, value], index) => {
            const start = cursor;
            cursor += total ? value / total * 100 : 0;
            return `${colors[index % colors.length]} ${start}% ${cursor}%`;
        });
        donut.style.background = total ? `conic-gradient(${stops.join(",")})` : "#e2e8f0";
        totalElement.textContent = compactMoney(total);
        legend.innerHTML = entries.length ? entries.slice(0, 6).map(([name, value], index) => `
            <div><i style="background:${colors[index % colors.length]}"></i><span>${escapeHTML(name)}</span><strong>${total ? (value / total * 100).toFixed(1) : 0}%</strong></div>
        `).join("") : '<div class="reports-chart-empty">Chưa có dữ liệu danh mục.</div>';
    }

    function renderTopProductsChart() {
        const container = document.getElementById("report-top-products");
        if (!container) return;
        const products = currentReport.products
            .slice()
            .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
            .slice(0, 5);
        if (!products.length) {
            container.innerHTML = '<div class="reports-chart-empty">Chưa có sản phẩm được bán trong kỳ.</div>';
            return;
        }
        const maximum = Math.max(...products.map(item => Number(item.revenue || 0)), 1);
        const colors = ["#4f76f0", "#3ec49a", "#f4b53f", "#9464e8", "#64bdeb"];
        container.innerHTML = products.map((item, index) => `
            <div class="reports-top-product-row">
                <span title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</span>
                <i><b style="width:${Number(item.revenue || 0) / maximum * 100}%;background:${colors[index]}"></b></i>
                <strong>${money(item.revenue)}</strong>
            </div>
        `).join("");
    }

    function renderReportAnalytics() {
        renderRevenueChart();
        renderCategoryChart();
        renderTopProductsChart();
    }

    function renderRevenue() {
        const body = document.getElementById("report-revenue-table-body");
        if (!currentReport.revenue.length) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center">Không có dữ liệu trong khoảng thời gian này.</td></tr>';
            return;
        }
        body.innerHTML = currentReport.revenue.map(item => `
            <tr>
                <td>${item.date}</td>
                <td>${item.invoices}</td>
                <td class="money">${money(item.revenue)}</td>
                <td class="money">${money(item.invoices ? item.revenue / item.invoices : 0)}</td>
            </tr>
        `).join("");
    }

    function renderProducts() {
        const body = document.getElementById("report-product-table-body");
        if (!currentReport.products.length) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center">Chưa có sản phẩm được bán trong khoảng thời gian này.</td></tr>';
            return;
        }
        body.innerHTML = currentReport.products.map(item => `
            <tr>
                <td>${escapeHTML(item.code)}</td>
                <td>
                    <div class="sales-product-cell report-product-cell">
                        <img
                            class="sales-product-thumbnail report-product-thumbnail"
                            src="${escapeHTML(item.imageData || "./assets/branding/sales-manager-logo.svg")}"
                            alt="${escapeHTML(item.name)}"
                            loading="lazy"
                        >
                        <span>${escapeHTML(item.name)}</span>
                    </div>
                </td>
                <td>${item.sold.toLocaleString("vi-VN")}</td>
                <td class="money">${money(item.revenue)}</td>
            </tr>
        `).join("");
    }

    function renderInventory() {
        const body = document.getElementById("report-inventory-table-body");
        if (!currentReport.inventory.length) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center">Chưa có dữ liệu tồn kho.</td></tr>';
            return;
        }
        body.innerHTML = currentReport.inventory.map(item => {
            const low = Number(item.quantity) <= Number(item.minimum);
            return `
                <tr>
                    <td>${escapeHTML(item.code)}</td>
                    <td>
                        <div class="sales-product-cell report-product-cell">
                            <img
                                class="sales-product-thumbnail report-product-thumbnail"
                                src="${escapeHTML(item.imageData || "./assets/branding/sales-manager-logo.svg")}"
                                alt="${escapeHTML(item.name)}"
                                loading="lazy"
                            >
                            <span>${escapeHTML(item.name)}</span>
                        </div>
                    </td>
                    <td>${Number(item.quantity).toLocaleString("vi-VN")}</td>
                    <td>${Number(item.minimum).toLocaleString("vi-VN")}</td>
                    <td><span class="${low ? "report-warning" : "report-normal"}">
                        ${low ? "Sắp hết hàng" : "Bình thường"}
                    </span></td>
                </tr>
            `;
        }).join("");
    }

    function updateReportSections(type) {
        const card = id => document.getElementById(id)?.closest(".reports-card");
        const cards = {
            revenue: card("report-revenue-table-body"),
            product: card("report-product-table-body"),
            inventory: card("report-inventory-table-body")
        };
        Object.entries(cards).forEach(([key, element]) => {
            if (element) element.style.display = type === "all" || type === key ? "" : "none";
        });
    }

    function applyReportFilter(showMessage = false) {
        const fromDate = document.getElementById("reports-from-date")?.value;
        const toDate = document.getElementById("reports-to-date")?.value;
        if (!fromDate || !toDate) {
            if (showMessage) alert("Vui lòng chọn đầy đủ Từ ngày và Đến ngày.");
            return false;
        }
        if (fromDate > toDate) {
            if (showMessage) alert("Từ ngày không được lớn hơn Đến ngày.");
            return false;
        }
        buildReport(fromDate, toDate);
        renderSummary();
        renderRevenue();
        renderProducts();
        renderInventory();
        renderReportAnalytics();
        updateReportSections(document.getElementById("reports-type")?.value || "all");
        return true;
    }

    function reportTablesHTML(type) {
        const tableStyle = 'border-collapse:collapse;width:100%;margin:14px 0 24px';
        const cellStyle = 'border:1px solid #bbb;padding:7px;text-align:left';
        const makeTable = (title, headers, rows) => `
            <h2>${title}</h2><table style="${tableStyle}">
            <thead><tr>${headers.map(value => `<th style="${cellStyle}">${value}</th>`).join("")}</tr></thead>
            <tbody>${rows.map(row => `<tr>${row.map(value => `<td style="${cellStyle}">${escapeHTML(value)}</td>`).join("")}</tr>`).join("")}</tbody>
            </table>`;
        let html = "";
        if (type === "all" || type === "revenue") {
            html += makeTable("Doanh thu", ["Ngày", "Số hóa đơn", "Doanh thu", "Trung bình / hóa đơn"],
                currentReport.revenue.map(item => [
                    item.date, item.invoices, money(item.revenue),
                    money(item.invoices ? item.revenue / item.invoices : 0)
                ]));
        }
        if (type === "all" || type === "product") {
            html += makeTable("Sản phẩm bán chạy", ["Mã", "Tên sản phẩm", "Số lượng bán", "Doanh thu"],
                currentReport.products.map(item => [item.code, item.name, item.sold, money(item.revenue)]));
        }
        if (type === "all" || type === "inventory") {
            html += makeTable("Tồn kho", ["Mã", "Tên sản phẩm", "Tồn kho", "Tồn tối thiểu", "Trạng thái"],
                currentReport.inventory.map(item => [
                    item.code, item.name, item.quantity, item.minimum,
                    Number(item.quantity) <= Number(item.minimum) ? "Sắp hết hàng" : "Bình thường"
                ]));
        }
        return html;
    }

    function buildExportDocument() {
        const fromDate = document.getElementById("reports-from-date").value;
        const toDate = document.getElementById("reports-to-date").value;
        const type = document.getElementById("reports-type").value;
        const totalRevenue = currentReport.invoices.reduce(
            (sum, item) => sum + Number(item.finalAmount || 0), 0
        );
        return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
            <title>Báo cáo kinh doanh</title></head><body style="font-family:Arial,sans-serif;color:#222">
            <h1>BÁO CÁO KINH DOANH</h1>
            <p>Thời gian: ${displayDate(fromDate)} - ${displayDate(toDate)}</p>
            <p>Tổng doanh thu: <strong>${money(totalRevenue)}</strong> ·
               Tổng hóa đơn: <strong>${currentReport.invoices.length}</strong></p>
            ${reportTablesHTML(type)}
            </body></html>`;
    }

    function downloadExcel(content) {
        const blob = new Blob(["\ufeff", content], {
            type: "application/vnd.ms-excel;charset=utf-8"
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `bao-cao-${new Date().toISOString().slice(0, 10)}.xls`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    function downloadBlob(blob, fileName) {
        const link = document.createElement("a");
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }

    function fitCanvasText(context, value, maxWidth) {
        const text = String(value ?? "");
        if (context.measureText(text).width <= maxWidth) return text;
        let result = text;
        while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) {
            result = result.slice(0, -1);
        }
        return `${result}…`;
    }

    function getPdfSections(type) {
        const sections = [];
        if (type === "all" || type === "revenue") {
            sections.push({
                title: "Báo cáo doanh thu",
                headers: ["Ngày", "Số hóa đơn", "Doanh thu", "Trung bình / hóa đơn"],
                widths: [0.18, 0.18, 0.31, 0.33],
                align: ["left", "center", "right", "right"],
                rows: currentReport.revenue.map(item => [
                    item.date,
                    Number(item.invoices || 0).toLocaleString("vi-VN"),
                    money(item.revenue),
                    money(item.invoices ? item.revenue / item.invoices : 0)
                ])
            });
        }
        if (type === "all" || type === "product") {
            sections.push({
                title: "Báo cáo sản phẩm bán chạy",
                headers: ["Mã", "Tên sản phẩm", "Số lượng bán", "Doanh thu"],
                widths: [0.14, 0.42, 0.18, 0.26],
                align: ["left", "left", "center", "right"],
                rows: currentReport.products.map(item => [
                    item.code || "—",
                    item.name || "Sản phẩm",
                    Number(item.sold || 0).toLocaleString("vi-VN"),
                    money(item.revenue)
                ])
            });
        }
        if (type === "all" || type === "inventory") {
            sections.push({
                title: "Báo cáo tồn kho",
                headers: ["Mã", "Tên sản phẩm", "Tồn kho", "Tồn tối thiểu", "Trạng thái"],
                widths: [0.13, 0.35, 0.16, 0.18, 0.18],
                align: ["left", "left", "center", "center", "left"],
                rows: currentReport.inventory.map(item => [
                    item.code || "—",
                    item.name || "Sản phẩm",
                    Number(item.quantity || 0).toLocaleString("vi-VN"),
                    Number(item.minimum || 0).toLocaleString("vi-VN"),
                    Number(item.quantity) <= Number(item.minimum) ? "Sắp hết hàng" : "Bình thường"
                ])
            });
        }
        return sections;
    }

    function buildPdfCanvases() {
        const pageWidth = 1240;
        const pageHeight = 1754;
        const margin = 72;
        const contentWidth = pageWidth - margin * 2;
        const rowHeight = 44;
        const headerHeight = 48;
        const bottomLimit = pageHeight - 92;
        const fromDate = document.getElementById("reports-from-date").value;
        const toDate = document.getElementById("reports-to-date").value;
        const type = document.getElementById("reports-type").value;
        const totalRevenue = currentReport.invoices.reduce(
            (sum, item) => sum + Number(item.finalAmount || 0), 0
        );
        const pages = [];
        let canvas;
        let context;
        let cursorY;

        function createPage() {
            canvas = document.createElement("canvas");
            canvas.width = pageWidth;
            canvas.height = pageHeight;
            context = canvas.getContext("2d");
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, pageWidth, pageHeight);

            context.fillStyle = "#3157f5";
            context.fillRect(margin, 54, 10, 78);
            context.fillStyle = "#12213d";
            context.font = "700 38px Arial, sans-serif";
            context.textBaseline = "middle";
            context.fillText("BÁO CÁO KINH DOANH", margin + 30, 79);
            context.fillStyle = "#6b7b93";
            context.font = "20px Arial, sans-serif";
            context.fillText(`Thời gian: ${displayDate(fromDate)} - ${displayDate(toDate)}`, margin + 30, 116);
            context.strokeStyle = "#d9e2ef";
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(margin, 154);
            context.lineTo(pageWidth - margin, 154);
            context.stroke();
            cursorY = 186;
            pages.push(canvas);
        }

        function drawSummary() {
            const gap = 18;
            const cardWidth = (contentWidth - gap) / 2;
            const cards = [
                ["Tổng doanh thu", money(totalRevenue)],
                ["Tổng số hóa đơn", currentReport.invoices.length.toLocaleString("vi-VN")]
            ];
            cards.forEach((card, index) => {
                const x = margin + index * (cardWidth + gap);
                context.fillStyle = index ? "#effaf6" : "#f0f3ff";
                context.strokeStyle = index ? "#bfe8d8" : "#cad4ff";
                context.lineWidth = 1.5;
                context.beginPath();
                context.roundRect(x, cursorY, cardWidth, 112, 16);
                context.fill();
                context.stroke();
                context.fillStyle = "#6b7b93";
                context.font = "18px Arial, sans-serif";
                context.fillText(card[0], x + 24, cursorY + 32);
                context.fillStyle = "#10214a";
                context.font = "700 29px Arial, sans-serif";
                context.fillText(card[1], x + 24, cursorY + 75);
            });
            cursorY += 142;
        }

        function drawSectionTitle(title, continued = false) {
            context.fillStyle = "#14213a";
            context.font = "700 25px Arial, sans-serif";
            context.fillText(continued ? `${title} (tiếp)` : title, margin, cursorY + 22);
            cursorY += 50;
        }

        function drawTableHeader(section) {
            let x = margin;
            context.fillStyle = "#edf2f8";
            context.fillRect(margin, cursorY, contentWidth, headerHeight);
            context.strokeStyle = "#bdc9da";
            context.lineWidth = 1.2;
            section.headers.forEach((header, index) => {
                const width = contentWidth * section.widths[index];
                context.strokeRect(x, cursorY, width, headerHeight);
                context.fillStyle = "#43526a";
                context.font = "700 16px Arial, sans-serif";
                context.textAlign = section.align[index] === "right" ? "right" : section.align[index] === "center" ? "center" : "left";
                const textX = context.textAlign === "right" ? x + width - 14 : context.textAlign === "center" ? x + width / 2 : x + 14;
                context.fillText(fitCanvasText(context, header, width - 28), textX, cursorY + headerHeight / 2);
                x += width;
            });
            context.textAlign = "left";
            cursorY += headerHeight;
        }

        function drawRow(section, row, rowIndex) {
            let x = margin;
            context.fillStyle = rowIndex % 2 ? "#f9fbfe" : "#ffffff";
            context.fillRect(margin, cursorY, contentWidth, rowHeight);
            section.headers.forEach((_, index) => {
                const width = contentWidth * section.widths[index];
                context.strokeStyle = "#cbd5e1";
                context.strokeRect(x, cursorY, width, rowHeight);
                context.fillStyle = "#33445f";
                context.font = index === 0 ? "700 16px Arial, sans-serif" : "16px Arial, sans-serif";
                context.textAlign = section.align[index] === "right" ? "right" : section.align[index] === "center" ? "center" : "left";
                const textX = context.textAlign === "right" ? x + width - 14 : context.textAlign === "center" ? x + width / 2 : x + 14;
                context.fillText(fitCanvasText(context, row[index], width - 28), textX, cursorY + rowHeight / 2);
                x += width;
            });
            context.textAlign = "left";
            cursorY += rowHeight;
        }

        createPage();
        drawSummary();

        getPdfSections(type).forEach(section => {
            if (cursorY + 50 + headerHeight + rowHeight > bottomLimit) createPage();
            drawSectionTitle(section.title);
            drawTableHeader(section);
            const rows = section.rows.length ? section.rows : [["Không có dữ liệu", ...section.headers.slice(1).map(() => "")]];
            rows.forEach((row, rowIndex) => {
                if (cursorY + rowHeight > bottomLimit) {
                    createPage();
                    drawSectionTitle(section.title, true);
                    drawTableHeader(section);
                }
                drawRow(section, row, rowIndex);
            });
            cursorY += 32;
        });

        pages.forEach((page, index) => {
            const pageContext = page.getContext("2d");
            pageContext.fillStyle = "#74839a";
            pageContext.font = "16px Arial, sans-serif";
            pageContext.textAlign = "center";
            pageContext.fillText(`Trang ${index + 1} / ${pages.length}`, pageWidth / 2, pageHeight - 45);
            pageContext.textAlign = "left";
        });
        return pages;
    }

    function concatenateBytes(chunks) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        chunks.forEach(chunk => {
            result.set(chunk, offset);
            offset += chunk.length;
        });
        return result;
    }

    function createPdfBlob(canvases) {
        const encoder = new TextEncoder();
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const objectCount = 2 + canvases.length * 3;
        const offsets = new Array(objectCount + 1).fill(0);
        const chunks = [];
        let byteLength = 0;
        const append = value => {
            const bytes = typeof value === "string" ? encoder.encode(value) : value;
            chunks.push(bytes);
            byteLength += bytes.length;
        };
        const appendObject = (number, parts) => {
            offsets[number] = byteLength;
            append(`${number} 0 obj\n`);
            parts.forEach(append);
            append("\nendobj\n");
        };

        append("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
        appendObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
        const pageReferences = canvases.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
        appendObject(2, [`<< /Type /Pages /Count ${canvases.length} /Kids [${pageReferences}] >>`]);

        canvases.forEach((canvasItem, index) => {
            const pageObject = 3 + index * 3;
            const contentObject = pageObject + 1;
            const imageObject = pageObject + 2;
            const imageName = `Im${index + 1}`;
            const content = encoder.encode(`q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/${imageName} Do\nQ`);
            const base64 = canvasItem.toDataURL("image/jpeg", 0.92).split(",")[1];
            const binary = atob(base64);
            const imageBytes = new Uint8Array(binary.length);
            for (let byteIndex = 0; byteIndex < binary.length; byteIndex += 1) {
                imageBytes[byteIndex] = binary.charCodeAt(byteIndex);
            }

            appendObject(pageObject, [
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] `,
                `/Resources << /XObject << /${imageName} ${imageObject} 0 R >> >> `,
                `/Contents ${contentObject} 0 R >>`
            ]);
            appendObject(contentObject, [
                `<< /Length ${content.length} >>\nstream\n`,
                content,
                "\nendstream"
            ]);
            appendObject(imageObject, [
                `<< /Type /XObject /Subtype /Image /Width ${canvasItem.width} /Height ${canvasItem.height} `,
                `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
                imageBytes,
                "\nendstream"
            ]);
        });

        const xrefOffset = byteLength;
        append(`xref\n0 ${objectCount + 1}\n`);
        append("0000000000 65535 f \n");
        for (let index = 1; index <= objectCount; index += 1) {
            append(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
        }
        append(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
        return new Blob([concatenateBytes(chunks)], { type: "application/pdf" });
    }

    function downloadPdf() {
        const canvases = buildPdfCanvases();
        const blob = createPdfBlob(canvases);
        downloadBlob(blob, `bao-cao-${new Date().toISOString().slice(0, 10)}.pdf`);
    }

    async function logReportExport(format) {
        const fromDate = document.getElementById("reports-from-date").value;
        const toDate = document.getElementById("reports-to-date").value;
        const type = document.getElementById("reports-type").value;
        try {
            await salesApi.history.create({
                action: "Xuất",
                actionType: "export",
                object: "Báo cáo",
                code: `${type.toUpperCase()}-${new Date().toISOString().slice(0, 10)}`,
                detail: `Xuất báo cáo ${type} dạng ${format.toUpperCase()} từ ${fromDate} đến ${toDate}`
            });
        } catch (error) {
            console.error("Không thể ghi lịch sử xuất báo cáo:", error);
        }
    }

    async function exportReport(format = "excel") {
        if (
            typeof requirePermission === "function" &&
            !requirePermission("report_export")
        ) return;
        if (!applyReportFilter(false)) {
            alert("Vui lòng chọn khoảng ngày hợp lệ trước khi xuất báo cáo.");
            return;
        }
        const content = buildExportDocument();
        if (format === "pdf") {
            try {
                downloadPdf();
            } catch (error) {
                console.error("Không thể tạo tệp PDF:", error);
                alert("Không thể tạo tệp PDF. Vui lòng thử lại.");
                return;
            }
        } else {
            downloadExcel(content);
        }
        await logReportExport(format);
    }

    function closeExportMenu() {
        const button = document.getElementById("report-export-button");
        const menu = document.getElementById("report-export-menu");
        if (!button || !menu) return;
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
    }

    function setupExportMenu() {
        const button = document.getElementById("report-export-button");
        const menu = document.getElementById("report-export-menu");
        if (!button || !menu || button.dataset.initialized) return;

        button.addEventListener("click", function (event) {
            event.stopPropagation();
            const willOpen = menu.hidden;
            menu.hidden = !willOpen;
            button.setAttribute("aria-expanded", String(willOpen));
            if (willOpen) {
                menu.querySelector("button")?.focus();
            }
        });

        menu.addEventListener("click", function (event) {
            const choice = event.target.closest("[data-report-format]");
            if (!choice) return;
            const format = choice.dataset.reportFormat;
            closeExportMenu();
            exportReport(format);
        });

        document.addEventListener("click", function (event) {
            if (!event.target.closest(".report-export-wrap")) {
                closeExportMenu();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeExportMenu();
                button.focus();
            }
        });

        button.dataset.initialized = "true";
    }

    async function initReports() {
        if (
            typeof requirePermission === "function" &&
            !requirePermission("report_export")
        ) return;

        const body = document.getElementById("report-revenue-table-body");
        if (body) body.innerHTML = '<tr><td colspan="4" style="text-align:center">Đang tải dữ liệu...</td></tr>';
        try {
            await loadReportSource();
            initializeDateRange();
            applyReportFilter(false);
        } catch (error) {
            console.error("Không thể tải báo cáo:", error);
            if (body) body.innerHTML = `<tr><td colspan="4" style="text-align:center">${escapeHTML(error.message || "Không thể tải báo cáo")}</td></tr>`;
        }

        const filter = document.getElementById("reports-filter-button");
        const type = document.getElementById("reports-type");
        if (filter && !filter.dataset.initialized) {
            filter.addEventListener("click", () => applyReportFilter(true));
            filter.dataset.initialized = "true";
        }
        if (type && !type.dataset.initialized) {
            type.addEventListener("change", () => updateReportSections(type.value));
            type.dataset.initialized = "true";
        }
        setupExportMenu();
    }

    document.addEventListener("sales:data-changed", function () {
        if (document.getElementById("reports-page")?.classList.contains("active")) {
            loadReportSource().then(() => {
                initializeDateRange();
                applyReportFilter(false);
            }).catch(console.error);
        }
    });

    window.initReports = initReports;
    window.exportReport = exportReport;
})();
