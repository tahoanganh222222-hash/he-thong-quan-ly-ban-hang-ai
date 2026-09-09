/* Báo cáo tổng hợp từ dữ liệu thật trong SQL Server. */
(function () {
    "use strict";

    let sourceData = { invoices: [], products: [], inventory: [] };
    let currentReport = { revenue: [], products: [], inventory: [], invoices: [] };
    let dateRangeInitialized = false;

    const money = value => Number(value || 0).toLocaleString("vi-VN") + " ₫";
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
                    code: product.code || "",
                    name: item.productName || product.name || "",
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
        document.getElementById("report-total-revenue").textContent = money(totalRevenue);
        document.getElementById("report-total-invoices").textContent =
            currentReport.invoices.length.toLocaleString("vi-VN");
        document.getElementById("report-products-sold").textContent =
            productsSold.toLocaleString("vi-VN");
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
                <td>${escapeHTML(item.name)}</td>
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
                    <td>${escapeHTML(item.name)}</td>
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
            const printWindow = window.open("", "_blank");
            if (!printWindow) {
                alert("Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.");
                return;
            }
            printWindow.document.open();
            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 300);
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
