/* =========================================================
   REPORTS - PART 12
   =========================================================
   Báo cáo độc lập với index.html
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       REPORT DATA
       ===================================================== */

    const reportData = {

        revenue: [

            {
                date: "01/09/2026",
                invoices: 18,
                revenue: 3250000
            },

            {
                date: "02/09/2026",
                invoices: 24,
                revenue: 4680000
            },

            {
                date: "03/09/2026",
                invoices: 21,
                revenue: 3750000
            },

            {
                date: "04/09/2026",
                invoices: 27,
                revenue: 5120000
            },

            {
                date: "05/09/2026",
                invoices: 31,
                revenue: 6240000
            },

            {
                date: "06/09/2026",
                invoices: 29,
                revenue: 5830000
            },

            {
                date: "07/09/2026",
                invoices: 35,
                revenue: 7150000
            }

        ],


        products: [

            {
                code: "SP004",
                name: "Nước giặt OMO 3.6kg",
                sold: 70,
                revenue: 8750000
            },

            {
                code: "SP005",
                name: "Quạt điện Senko",
                sold: 12,
                revenue: 6240000
            },

            {
                code: "SP006",
                name: "Máy sấy tóc Philips",
                sold: 14,
                revenue: 4900000
            },

            {
                code: "SP002",
                name: "Nước ngọt Coca Cola 330ml",
                sold: 385,
                revenue: 3850000
            },

            {
                code: "SP001",
                name: "Nước suối Aquafina 500ml",
                sold: 520,
                revenue: 3120000
            }

        ],


        inventory: [

            {
                code: "SP005",
                name: "Quạt điện Senko",
                quantity: 12,
                minQuantity: 15
            },

            {
                code: "SP006",
                name: "Máy sấy tóc Philips",
                quantity: 8,
                minQuantity: 10
            },

            {
                code: "SP004",
                name: "Nước giặt OMO 3.6kg",
                quantity: 30,
                minQuantity: 10
            },

            {
                code: "SP001",
                name: "Nước suối Aquafina 500ml",
                quantity: 120,
                minQuantity: 30
            }

        ]

    };


    /* =====================================================
       FORMAT MONEY
       ===================================================== */

    function formatReportMoney(value) {

        return Number(value || 0).toLocaleString("vi-VN") + " ₫";

    }


    /* =====================================================
       DATE
       ===================================================== */

    function parseInputDate(value) {

        if (!value) {
            return null;
        }

        const parts = value.split("-");

        if (parts.length !== 3) {
            return null;
        }

        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);

        const date = new Date(
            year,
            month - 1,
            day
        );

        date.setHours(0, 0, 0, 0);

        return date;

    }


    function parseDataDate(value) {

        if (!value) {
            return null;
        }

        const parts = value.split("/");

        if (parts.length !== 3) {
            return null;
        }

        const day = Number(parts[0]);
        const month = Number(parts[1]);
        const year = Number(parts[2]);

        const date = new Date(
            year,
            month - 1,
            day
        );

        date.setHours(0, 0, 0, 0);

        return date;

    }


    /* =====================================================
       FILTER REVENUE
       ===================================================== */

    function filterRevenue(
        fromDate,
        toDate
    ) {

        return reportData.revenue.filter(
            function (item) {

                const itemDate =
                    parseDataDate(item.date);

                if (!itemDate) {
                    return false;
                }

                return (
                    itemDate >= fromDate &&
                    itemDate <= toDate
                );

            }
        );

    }


    /* =====================================================
       SUMMARY
       ===================================================== */

    function renderReportSummary(
        revenueData,
        productData
    ) {

        const totalRevenue =
            revenueData.reduce(
                function (sum, item) {

                    return (
                        sum +
                        Number(item.revenue || 0)
                    );

                },
                0
            );


        const totalInvoices =
            revenueData.reduce(
                function (sum, item) {

                    return (
                        sum +
                        Number(item.invoices || 0)
                    );

                },
                0
            );


        const totalProductsSold =
            productData.reduce(
                function (sum, item) {

                    return (
                        sum +
                        Number(item.sold || 0)
                    );

                },
                0
            );


        const revenueElement =
            document.getElementById(
                "report-total-revenue"
            );


        const invoiceElement =
            document.getElementById(
                "report-total-invoices"
            );


        const productElement =
            document.getElementById(
                "report-products-sold"
            );


        if (revenueElement) {

            revenueElement.textContent =
                formatReportMoney(
                    totalRevenue
                );

        }


        if (invoiceElement) {

            invoiceElement.textContent =
                totalInvoices.toLocaleString(
                    "vi-VN"
                );

        }


        if (productElement) {

            productElement.textContent =
                totalProductsSold.toLocaleString(
                    "vi-VN"
                );

        }

    }


    /* =====================================================
       REVENUE REPORT
       ===================================================== */

    function renderRevenueReport(
        revenueData
    ) {

        const tableBody =
            document.getElementById(
                "report-revenue-table-body"
            );


        if (!tableBody) {
            return;
        }


        /*
         * Không có dữ liệu
         */

        if (!revenueData.length) {

            tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="4"
                        style="text-align: center;"
                    >
                        Không có dữ liệu trong khoảng thời gian này.
                    </td>
                </tr>
            `;

            return;

        }


        tableBody.innerHTML =
            revenueData.map(
                function (item) {

                    const average =
                        item.invoices > 0
                            ? item.revenue /
                              item.invoices
                            : 0;


                    return `
                        <tr>

                            <td>
                                ${item.date}
                            </td>

                            <td>
                                ${item.invoices}
                            </td>

                            <td class="money">
                                ${formatReportMoney(
                                    item.revenue
                                )}
                            </td>

                            <td class="money">
                                ${formatReportMoney(
                                    average
                                )}
                            </td>

                        </tr>
                    `;

                }
            ).join("");

    }


    /* =====================================================
       PRODUCT REPORT
       ===================================================== */

    function renderProductReport(
        productData
    ) {

        const tableBody =
            document.getElementById(
                "report-product-table-body"
            );


        if (!tableBody) {
            return;
        }


        tableBody.innerHTML =
            productData.map(
                function (item) {

                    return `
                        <tr>

                            <td>
                                ${item.code}
                            </td>

                            <td>
                                ${item.name}
                            </td>

                            <td>
                                ${Number(
                                    item.sold || 0
                                ).toLocaleString(
                                    "vi-VN"
                                )}
                            </td>

                            <td class="money">
                                ${formatReportMoney(
                                    item.revenue
                                )}
                            </td>

                        </tr>
                    `;

                }
            ).join("");

    }


    /* =====================================================
       INVENTORY REPORT
       ===================================================== */

    function renderInventoryReport() {

        const tableBody =
            document.getElementById(
                "report-inventory-table-body"
            );


        if (!tableBody) {
            return;
        }


        tableBody.innerHTML =
            reportData.inventory.map(
                function (item) {

                    const quantity =
                        Number(
                            item.quantity || 0
                        );


                    const minQuantity =
                        Number(
                            item.minQuantity || 0
                        );


                    const lowStock =
                        quantity <= minQuantity;


                    return `
                        <tr>

                            <td>
                                ${item.code}
                            </td>

                            <td>
                                ${item.name}
                            </td>

                            <td>
                                ${quantity.toLocaleString(
                                    "vi-VN"
                                )}
                            </td>

                            <td>
                                ${minQuantity.toLocaleString(
                                    "vi-VN"
                                )}
                            </td>

                            <td>

                                ${
                                    lowStock

                                        ? `
                                            <span
                                                class="report-warning"
                                            >
                                                Sắp hết hàng
                                            </span>
                                        `

                                        : `
                                            <span
                                                class="report-normal"
                                            >
                                                Bình thường
                                            </span>
                                        `
                                }

                            </td>

                        </tr>
                    `;

                }
            ).join("");

    }


    /* =====================================================
       REPORT TYPE
       ===================================================== */

    function setupReportType() {

        const typeSelect =
            document.getElementById(
                "reports-type"
            );


        if (!typeSelect) {
            return;
        }


        /*
         * Dùng onchange thay vì addEventListener
         * để không bị đăng ký nhiều lần.
         */

        typeSelect.onchange =
            function () {

                updateReportSections(
                    typeSelect.value
                );

            };

    }


    function updateReportSections(type) {

        const revenueTable =
            document.getElementById(
                "report-revenue-table-body"
            );


        const productTable =
            document.getElementById(
                "report-product-table-body"
            );


        const inventoryTable =
            document.getElementById(
                "report-inventory-table-body"
            );


        const revenueCard =
            revenueTable
                ? revenueTable.closest(
                    ".reports-card"
                )
                : null;


        const productCard =
            productTable
                ? productTable.closest(
                    ".reports-card"
                )
                : null;


        const inventoryCard =
            inventoryTable
                ? inventoryTable.closest(
                    ".reports-card"
                )
                : null;


        /*
         * Hiển thị tất cả
         */

        if (revenueCard) {
            revenueCard.style.display = "";
        }

        if (productCard) {
            productCard.style.display = "";
        }

        if (inventoryCard) {
            inventoryCard.style.display = "";
        }


        /*
         * Lọc theo loại báo cáo
         */

        if (type === "revenue") {

            if (productCard) {
                productCard.style.display = "none";
            }

            if (inventoryCard) {
                inventoryCard.style.display = "none";
            }

        }


        if (type === "product") {

            if (revenueCard) {
                revenueCard.style.display = "none";
            }

            if (inventoryCard) {
                inventoryCard.style.display = "none";
            }

        }


        if (type === "inventory") {

            if (revenueCard) {
                revenueCard.style.display = "none";
            }

            if (productCard) {
                productCard.style.display = "none";
            }

        }

    }


    /* =====================================================
       FILTER
       ===================================================== */

    function setupReportFilter() {

        const filterButton =
            document.getElementById(
                "reports-filter-button"
            );


        if (!filterButton) {
            return;
        }


        /*
         * QUAN TRỌNG:
         *
         * Không dùng:
         *
         * addEventListener()
         *
         * vì initReports() có thể được gọi
         * nhiều lần bởi index.html.
         *
         * onclick luôn chỉ giữ 1 handler.
         */

        filterButton.onclick =
            function () {

                const fromInput =
                    document.getElementById(
                        "reports-from-date"
                    );


                const toInput =
                    document.getElementById(
                        "reports-to-date"
                    );


                if (!fromInput || !toInput) {

                    alert(
                        "Không tìm thấy khoảng thời gian báo cáo."
                    );

                    return;

                }


                const fromDate =
                    parseInputDate(
                        fromInput.value
                    );


                const toDate =
                    parseInputDate(
                        toInput.value
                    );


                /*
                 * Kiểm tra ngày
                 */

                if (!fromDate || !toDate) {

                    alert(
                        "Vui lòng chọn đầy đủ Từ ngày và Đến ngày."
                    );

                    return;

                }


                /*
                 * Từ ngày > Đến ngày
                 */

                if (fromDate > toDate) {

                    alert(
                        "Từ ngày không được lớn hơn Đến ngày."
                    );

                    return;

                }


                /*
                 * Lọc doanh thu
                 */

                const filteredRevenue =
                    filterRevenue(
                        fromDate,
                        toDate
                    );


                /*
                 * Products hiện chưa có ngày
                 * nên vẫn dùng dữ liệu prototype.
                 */

                const filteredProducts =
                    reportData.products;


                /*
                 * Render lại
                 */

                renderReportSummary(
                    filteredRevenue,
                    filteredProducts
                );


                renderRevenueReport(
                    filteredRevenue
                );


                renderProductReport(
                    filteredProducts
                );


                renderInventoryReport();


                /*
                 * Áp dụng loại báo cáo
                 */

                const typeSelect =
                    document.getElementById(
                        "reports-type"
                    );


                if (typeSelect) {

                    updateReportSections(
                        typeSelect.value
                    );

                }


                /*
                 * Chỉ alert đúng 1 lần.
                 */

                alert(
                    "Đã cập nhật báo cáo theo khoảng thời gian."
                );

            };

    }


    /* =====================================================
       EXPORT
       ===================================================== */

    function exportReport() {

        if (
            typeof requirePermission === "function" &&
            !requirePermission("report_export")
        ) {
            return;
        }

        alert(
            "Chức năng xuất báo cáo sẽ được tích hợp sau khi kết nối backend."
        );

    }


    /* =====================================================
       INITIAL RENDER
       ===================================================== */

    function renderInitialReports() {

        renderReportSummary(
            reportData.revenue,
            reportData.products
        );


        renderRevenueReport(
            reportData.revenue
        );


        renderProductReport(
            reportData.products
        );


        renderInventoryReport();

    }


    /* =====================================================
       INIT
       ===================================================== */

    function initReports() {

        if (
            typeof requirePermission === "function" &&
            !requirePermission("report_export")
        ) {
            return;
        }

        /*
         * Render dữ liệu ban đầu
         */

        renderInitialReports();


        /*
         * Thiết lập nút lọc
         */

        setupReportFilter();


        /*
         * Thiết lập loại báo cáo
         */

        setupReportType();


        /*
         * Đặt trạng thái ban đầu
         */

        const typeSelect =
            document.getElementById(
                "reports-type"
            );


        if (typeSelect) {

            updateReportSections(
                typeSelect.value
            );

        }

    }


    /* =====================================================
       EXPORT RA GLOBAL
       ===================================================== */

    /*
     * index.html có thể tiếp tục gọi:
     *
     * initReports()
     *
     * mà không cần sửa.
     */

    window.initReports =
        initReports;


    /*
     * HTML đang dùng:
     *
     * onclick="exportReport()"
     *
     * nên phải expose hàm này.
     */

    window.exportReport =
        exportReport;


})();