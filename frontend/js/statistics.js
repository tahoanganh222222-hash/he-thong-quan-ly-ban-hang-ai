/* ================================
   REVENUE STATISTICS
   ================================ */


/* ================================
   DATA
   ================================ */

const revenueStatisticsData = [
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
];


/* ================================
   TOP PRODUCTS
   ================================ */

const topRevenueProducts = [
    {
        code: "SP004",
        name: "Nước giặt OMO 3.6kg",
        revenue: 8750000
    },
    {
        code: "SP005",
        name: "Quạt điện Senko",
        revenue: 6240000
    },
    {
        code: "SP006",
        name: "Máy sấy tóc Philips",
        revenue: 4900000
    },
    {
        code: "SP002",
        name: "Nước ngọt Coca Cola 330ml",
        revenue: 3850000
    },
    {
        code: "SP001",
        name: "Nước suối Aquafina 500ml",
        revenue: 3120000
    }
];


/* ================================
   CURRENT FILTERED DATA
   ================================ */

let currentRevenueStatisticsData = [...revenueStatisticsData];


/* ================================
   FORMAT
   ================================ */

function formatStatisticsMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " ₫";
}


/* ================================
   DATE CONVERSION
   ================================ */

/*
 * Chuyển:
 * 01/09/2026
 *
 * thành:
 * 2026-09-01
 *
 * để so sánh với input type="date"
 */

function convertStatisticsDate(dateString) {
    const parts = dateString.split("/");

    if (parts.length !== 3) {
        return "";
    }

    const day = parts[0];
    const month = parts[1];
    const year = parts[2];

    return `${year}-${month}-${day}`;
}


/* ================================
   CALCULATE
   ================================ */

function calculateRevenueStatistics(data = currentRevenueStatisticsData) {

    if (!data || data.length === 0) {
        return {
            totalRevenue: 0,
            totalInvoices: 0,
            averageRevenue: 0,
            highestDay: null
        };
    }

    const totalRevenue =
        data.reduce(
            (sum, item) => sum + Number(item.revenue || 0),
            0
        );

    const totalInvoices =
        data.reduce(
            (sum, item) => sum + Number(item.invoices || 0),
            0
        );

    const averageRevenue =
        totalInvoices > 0
            ? totalRevenue / totalInvoices
            : 0;

    const highestDay =
        data.reduce(
            (highest, item) =>
                item.revenue > highest.revenue
                    ? item
                    : highest,
            data[0]
        );

    return {
        totalRevenue,
        totalInvoices,
        averageRevenue,
        highestDay
    };
}


/* ================================
   KPI
   ================================ */

function renderRevenueStatisticsKPI(
    data = currentRevenueStatisticsData
) {

    const result =
        calculateRevenueStatistics(data);


    const totalRevenue =
        document.getElementById(
            "statistics-total-revenue"
        );

    const totalInvoices =
        document.getElementById(
            "statistics-total-invoices"
        );

    const averageRevenue =
        document.getElementById(
            "statistics-average-revenue"
        );

    const highestRevenue =
        document.getElementById(
            "statistics-highest-revenue"
        );


    if (totalRevenue) {

        totalRevenue.textContent =
            formatStatisticsMoney(
                result.totalRevenue
            );
    }


    if (totalInvoices) {

        totalInvoices.textContent =
            result.totalInvoices.toLocaleString(
                "vi-VN"
            );
    }


    if (averageRevenue) {

        averageRevenue.textContent =
            formatStatisticsMoney(
                result.averageRevenue
            );
    }


    if (highestRevenue) {

        highestRevenue.textContent =
            result.highestDay
                ? formatStatisticsMoney(
                    result.highestDay.revenue
                )
                : "0 ₫";
    }
}


/* ================================
   CHART
   ================================ */

function renderRevenueChart(
    data = currentRevenueStatisticsData
) {

    const chart =
        document.getElementById(
            "statistics-revenue-chart"
        );


    if (!chart) {
        return;
    }


    /*
     * Không có dữ liệu
     */

    if (!data || data.length === 0) {

        chart.innerHTML = `
            <div class="statistics-empty">
                Không có dữ liệu doanh thu trong khoảng thời gian đã chọn.
            </div>
        `;

        return;
    }


    const width = 700;
    const height = 260;

    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;


    const chartWidth =
        width -
        paddingLeft -
        paddingRight;

    const chartHeight =
        height -
        paddingTop -
        paddingBottom;


    const maxRevenue =
        Math.max(
            ...data.map(
                item => Number(item.revenue || 0)
            )
        );


    /*
     * Tránh chia cho 0
     */

    const safeMaxRevenue =
        maxRevenue > 0
            ? maxRevenue
            : 1;


    const points =
        data.map(
            (item, index) => {

                const x =
                    paddingLeft +
                    (
                        index /
                        Math.max(
                            1,
                            data.length - 1
                        )
                    ) *
                    chartWidth;


                const y =
                    paddingTop +
                    chartHeight -
                    (
                        Number(item.revenue || 0) /
                        safeMaxRevenue
                    ) *
                    chartHeight;


                return {
                    x,
                    y,
                    item
                };
            }
        );


    /*
     * Tạo đường biểu đồ
     */

    const path =
        points.map(
            (point, index) =>
                `${index === 0 ? "M" : "L"} ${
                    point.x
                } ${
                    point.y
                }`
        ).join(" ");


    /*
     * Tạo điểm + ngày
     */

    const pointsHtml =
        points.map(
            point => `
                <circle
                    class="statistics-chart-point"
                    cx="${point.x}"
                    cy="${point.y}"
                    r="4"
                />

                <text
                    class="statistics-chart-label"
                    x="${point.x}"
                    y="${height - 12}"
                    text-anchor="middle"
                >
                    ${point.item.date.substring(0, 5)}
                </text>
            `
        ).join("");


    /*
     * Render SVG
     */

    chart.innerHTML = `
        <svg
            viewBox="0 0 ${width} ${height}"
            preserveAspectRatio="none"
        >

            <line
                x1="${paddingLeft}"
                y1="${paddingTop}"
                x2="${paddingLeft}"
                y2="${height - paddingBottom}"
                stroke="#dfe4ea"
            />

            <line
                x1="${paddingLeft}"
                y1="${height - paddingBottom}"
                x2="${width - paddingRight}"
                y2="${height - paddingBottom}"
                stroke="#dfe4ea"
            />

            <path
                d="${path}"
                class="statistics-chart-line"
            />

            ${pointsHtml}

        </svg>
    `;
}


/* ================================
   TOP PRODUCTS
   ================================ */

function renderTopRevenueProducts() {

    const container =
        document.getElementById(
            "statistics-top-products"
        );


    if (!container) {
        return;
    }


    if (
        !topRevenueProducts ||
        topRevenueProducts.length === 0
    ) {

        container.innerHTML = `
            <div class="statistics-empty">
                Chưa có dữ liệu sản phẩm.
            </div>
        `;

        return;
    }


    container.innerHTML =
        topRevenueProducts.map(
            product => `
                <div
                    class="statistics-product-item"
                >

                    <div
                        class="statistics-product-info"
                    >

                        <div
                            class="statistics-product-name"
                        >
                            ${product.name}
                        </div>

                        <div
                            class="statistics-product-code"
                        >
                            ${product.code}
                        </div>

                    </div>

                    <div
                        class="statistics-product-revenue"
                    >
                        ${formatStatisticsMoney(
                            product.revenue
                        )}
                    </div>

                </div>
            `
        ).join("");
}


/* ================================
   DAILY TABLE
   ================================ */

function renderRevenueDailyTable(
    data = currentRevenueStatisticsData
) {

    const tableBody =
        document.getElementById(
            "statistics-daily-table-body"
        );


    if (!tableBody) {
        return;
    }


    /*
     * Không có dữ liệu
     */

    if (!data || data.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="statistics-empty"
                >
                    Không có dữ liệu doanh thu trong khoảng thời gian đã chọn.
                </td>
            </tr>
        `;

        return;
    }


    tableBody.innerHTML =
        data.map(
            item => {

                const invoices =
                    Number(item.invoices || 0);

                const revenue =
                    Number(item.revenue || 0);

                const average =
                    invoices > 0
                        ? revenue / invoices
                        : 0;


                return `
                    <tr>

                        <td>
                            ${item.date}
                        </td>

                        <td>
                            ${invoices}
                        </td>

                        <td class="money">
                            ${formatStatisticsMoney(
                                revenue
                            )}
                        </td>

                        <td class="money">
                            ${formatStatisticsMoney(
                                average
                            )}
                        </td>

                    </tr>
                `;
            }
        ).join("");
}


/* ================================
   RENDER ALL
   ================================ */

function renderAllRevenueStatistics() {

    renderRevenueStatisticsKPI(
        currentRevenueStatisticsData
    );

    renderRevenueChart(
        currentRevenueStatisticsData
    );

    renderTopRevenueProducts();

    renderRevenueDailyTable(
        currentRevenueStatisticsData
    );
}


/* ================================
   FILTER
   ================================ */

function setupStatisticsFilter() {

    const filterButton =
        document.getElementById(
            "statistics-filter-button"
        );


    if (!filterButton) {
        return;
    }


    /*
     * Tránh addEventListener nhiều lần
     * nếu người dùng chuyển trang thống kê
     * nhiều lần.
     */

    if (
        filterButton.dataset.statisticsInitialized === "true"
    ) {
        return;
    }


    filterButton.dataset.statisticsInitialized = "true";


    filterButton.addEventListener(
        "click",
        function () {

            const fromDateInput =
                document.getElementById(
                    "statistics-from-date"
                );

            const toDateInput =
                document.getElementById(
                    "statistics-to-date"
                );


            if (!fromDateInput || !toDateInput) {
                return;
            }


            const fromDate =
                fromDateInput.value;

            const toDate =
                toDateInput.value;


            /*
             * Kiểm tra ngày
             */

            if (!fromDate || !toDate) {

                alert(
                    "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc."
                );

                return;
            }


            /*
             * Ngày bắt đầu > ngày kết thúc
             */

            if (fromDate > toDate) {

                alert(
                    "Ngày bắt đầu không được lớn hơn ngày kết thúc."
                );

                return;
            }


            /*
             * Lọc dữ liệu
             */

            currentRevenueStatisticsData =
                revenueStatisticsData.filter(
                    item => {

                        const itemDate =
                            convertStatisticsDate(
                                item.date
                            );


                        return (
                            itemDate >= fromDate &&
                            itemDate <= toDate
                        );
                    }
                );


            /*
             * Render lại toàn bộ thống kê
             */

            renderAllRevenueStatistics();

        }
    );
}


/* ================================
   INIT
   ================================ */

function initRevenueStatistics() {

    if (
        typeof requirePermission === "function" &&
        !requirePermission("revenue_statistics")
    ) {
        return;
    }

    /*
     * Khi mở trang lần đầu,
     * hiển thị toàn bộ dữ liệu.
     */

    currentRevenueStatisticsData =
        [...revenueStatisticsData];


    renderAllRevenueStatistics();

    setupStatisticsFilter();
}