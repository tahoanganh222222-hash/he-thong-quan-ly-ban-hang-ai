// // /* ============================================================
// //    HISTORY MANAGEMENT
// //    ============================================================ */

// // const historyData = [
// //     {
// //         time: "03/09/2026 08:45",
// //         user: "Quản trị viên",
// //         action: "Thêm",
// //         actionType: "add",
// //         object: "Sản phẩm",
// //         code: "SP008",
// //         detail: "Thêm sản phẩm mới: Bánh Oreo"
// //     },
// //     {
// //         time: "03/09/2026 08:40",
// //         user: "Quản trị viên",
// //         action: "Cập nhật",
// //         actionType: "update",
// //         object: "Sản phẩm",
// //         code: "SP003",
// //         detail: "Cập nhật giá sản phẩm"
// //     },
// //     {
// //         time: "03/09/2026 08:35",
// //         user: "Nhân viên bán hàng",
// //         action: "Tạo",
// //         actionType: "create",
// //         object: "Hóa đơn",
// //         code: "HD001",
// //         detail: "Tạo hóa đơn bán hàng"
// //     },
// //     {
// //         time: "03/09/2026 08:30",
// //         user: "Nhân viên kho",
// //         action: "Nhập",
// //         actionType: "import",
// //         object: "Phiếu nhập",
// //         code: "PN001",
// //         detail: "Nhập thêm 50 sản phẩm"
// //     },
// //     {
// //         time: "02/09/2026 17:20",
// //         user: "Quản trị viên",
// //         action: "Xóa",
// //         actionType: "delete",
// //         object: "Danh mục",
// //         code: "DM004",
// //         detail: "Xóa danh mục sản phẩm"
// //     },
// //     {
// //         time: "02/09/2026 16:10",
// //         user: "Nhân viên bán hàng",
// //         action: "Tạo",
// //         actionType: "create",
// //         object: "Hóa đơn",
// //         code: "HD002",
// //         detail: "Tạo hóa đơn bán hàng"
// //     }
// // ];


// // /* ============================================================
// //    RENDER HISTORY
// //    ============================================================ */

// function loadHistoryTable() {

//     /* 
//         Kiểm tra quyền xem lịch sử.
//         Nếu tài khoản hiện tại không có quyền
//         history_view thì không cho hiển thị dữ liệu.
//     */
//     if (
//         typeof hasCurrentUserPermission === "function" &&
//         !hasCurrentUserPermission("history_view")
//     ) {
//         return;
//     }

//     const tbody =
//         document.getElementById("history-table-body");

//     if (!tbody) {
//         return;
//     }

//     const searchInput =
//         document.getElementById("history-search-input");

//     const actionFilter =
//         document.getElementById("history-action-filter");

//     const objectFilter =
//         document.getElementById("history-object-filter");


//     const search =
//         searchInput
//             ? searchInput.value.toLowerCase().trim()
//             : "";

//     const action =
//         actionFilter
//             ? actionFilter.value
//             : "all";

//     const object =
//         objectFilter
//             ? objectFilter.value
//             : "all";


//     const filteredData =
//         historyData.filter(item => {

//             const matchSearch =
//                 !search ||
//                 item.user.toLowerCase().includes(search) ||
//                 item.action.toLowerCase().includes(search) ||
//                 item.object.toLowerCase().includes(search) ||
//                 item.code.toLowerCase().includes(search) ||
//                 item.detail.toLowerCase().includes(search);

//             const matchAction =
//                 action === "all" ||
//                 item.actionType === action;

//             const matchObject =
//                 object === "all" ||
//                 item.object === object;

//             return matchSearch &&
//                    matchAction &&
//                    matchObject;
//         });


//     tbody.innerHTML = "";


//     if (filteredData.length === 0) {

//         tbody.innerHTML = `
//             <tr>
//                 <td colspan="7">
//                     <div class="history-empty">
//                         Không tìm thấy lịch sử hoạt động
//                     </div>
//                 </td>
//             </tr>
//         `;

//         updateHistoryCount(0);
//         return;
//     }


//     filteredData.forEach((item, index) => {

//         const row =
//             document.createElement("tr");

//         row.innerHTML = `
//             <td>${index + 1}</td>

//             <td class="history-time">
//                 ${item.time}
//             </td>

//             <td class="history-user">
//                 ${item.user}
//             </td>

//             <td>
//                 <span class="history-action ${item.actionType}">
//                     ${item.action}
//                 </span>
//             </td>

//             <td>
//                 ${item.object}
//             </td>

//             <td>
//                 ${item.code}
//             </td>

//             <td>
//                 ${item.detail}
//             </td>
//         `;

//         tbody.appendChild(row);
//     });


//     updateHistoryCount(filteredData.length);
// }


// // /* ============================================================
// //    COUNT
// //    ============================================================ */

// function updateHistoryCount(count) {

//     const element =
//         document.getElementById("history-count");

//     if (!element) {
//         return;
//     }

//     element.textContent =
//         `Hiển thị ${count} hoạt động`;
// }


// // /* ============================================================
// //    INIT
// //    ============================================================ */

// function initHistoryManagement() {

//     /*
//         Kiểm tra quyền ngay khi khởi tạo trang.
//         Không có quyền thì không khởi tạo các thao tác
//         tìm kiếm, lọc và làm mới lịch sử.
//     */
//     if (
//         typeof requirePermission === "function" &&
//         !requirePermission("history_view")
//     ) {
//         return;
//     }


//     const searchInput =
//         document.getElementById("history-search-input");

//     const actionFilter =
//         document.getElementById("history-action-filter");

//     const objectFilter =
//         document.getElementById("history-object-filter");

//     const refreshButton =
//         document.getElementById("history-refresh-button");


//     if (searchInput && !searchInput.dataset.initialized) {

//         searchInput.addEventListener(
//             "input",
//             loadHistoryTable
//         );

//         searchInput.dataset.initialized = "true";
//     }


//     if (actionFilter && !actionFilter.dataset.initialized) {

//         actionFilter.addEventListener(
//             "change",
//             loadHistoryTable
//         );

//         actionFilter.dataset.initialized = "true";
//     }


//     if (objectFilter && !objectFilter.dataset.initialized) {

//         objectFilter.addEventListener(
//             "change",
//             loadHistoryTable
//         );

//         objectFilter.dataset.initialized = "true";
//     }


//     if (refreshButton && !refreshButton.dataset.initialized) {

//         refreshButton.addEventListener(
//             "click",
//             loadHistoryTable
//         );

//         refreshButton.dataset.initialized = "true";
//     }


//     loadHistoryTable();
// }
// /* ============================================================
//    HISTORY MANAGEMENT
//    ============================================================ */

// /*
//  * Lịch sử hoạt động được lưu trong localStorage.
//  *
//  * Không tạo dữ liệu lịch sử cố định trong code.
//  * Các chức năng khác trong hệ thống sẽ gọi:
//  *
//  * addHistory(...)
//  *
//  * để ghi lại hoạt động thực tế của người dùng.
//  */

// const HISTORY_STORAGE_KEY = "sales_management_history";


// /* ============================================================
//    GET HISTORY DATA
//    ============================================================ */

// function getHistoryData() {

//     try {

//         const storedHistory =
//             localStorage.getItem(HISTORY_STORAGE_KEY);

//         if (!storedHistory) {
//             return [];
//         }

//         const parsedHistory =
//             JSON.parse(storedHistory);

//         return Array.isArray(parsedHistory)
//             ? parsedHistory
//             : [];

//     } catch (error) {

//         console.error(
//             "Không thể đọc lịch sử hoạt động:",
//             error
//         );

//         return [];
//     }
// }


// /* ============================================================
//    ADD HISTORY
//    ============================================================ */

// /*
//  * Hàm dùng chung để các chức năng khác ghi lịch sử.
//  *
//  * Ví dụ:
//  *
//  * addHistory({
//  *     action: "Thêm",
//  *     actionType: "add",
//  *     object: "Sản phẩm",
//  *     code: "SP008",
//  *     detail: "Thêm sản phẩm mới: Bánh Oreo"
//  * });
//  */

// function addHistory({
//     action,
//     actionType,
//     object,
//     code = "",
//     detail = ""
// }) {

//     const history =
//         getHistoryData();


//     /*
//      * Lấy thông tin người dùng hiện tại.
//      *
//      * Ưu tiên các biến/hàm đã có sẵn trong hệ thống.
//      * Không thay đổi cơ chế phân quyền hiện tại.
//      */

//     let currentUser = "Người dùng";

//     try {

//         if (
//             typeof getCurrentUser === "function"
//         ) {

//             const user =
//                 getCurrentUser();

//             if (user) {

//                 currentUser =
//                     user.name ||
//                     user.fullName ||
//                     user.username ||
//                     currentUser;
//             }

//         } else {

//             const storedUser =
//                 localStorage.getItem("currentUser");

//             if (storedUser) {

//                 const user =
//                     JSON.parse(storedUser);

//                 currentUser =
//                     user.name ||
//                     user.fullName ||
//                     user.username ||
//                     currentUser;
//             }
//         }

//     } catch (error) {

//         console.warn(
//             "Không lấy được thông tin người dùng hiện tại.",
//             error
//         );
//     }


//     /*
//      * Tạo thời gian theo định dạng:
//      * DD/MM/YYYY HH:mm
//      */

//     const now =
//         new Date();

//     const day =
//         String(now.getDate()).padStart(2, "0");

//     const month =
//         String(now.getMonth() + 1).padStart(2, "0");

//     const year =
//         now.getFullYear();

//     const hours =
//         String(now.getHours()).padStart(2, "0");

//     const minutes =
//         String(now.getMinutes()).padStart(2, "0");


//     const historyItem = {

//         time:
//             `${day}/${month}/${year} ${hours}:${minutes}`,

//         user:
//             currentUser,

//         action:
//             action,

//         actionType:
//             actionType,

//         object:
//             object,

//         code:
//             code,

//         detail:
//             detail
//     };


//     /*
//      * Hoạt động mới được đưa lên đầu danh sách.
//      */

//     history.unshift(historyItem);


//     try {

//         localStorage.setItem(
//             HISTORY_STORAGE_KEY,
//             JSON.stringify(history)
//         );

//     } catch (error) {

//         console.error(
//             "Không thể lưu lịch sử hoạt động:",
//             error
//         );

//         return;
//     }


//     /*
//      * Nếu trang Lịch sử đang mở thì cập nhật ngay.
//      */

//     if (
//         typeof loadHistoryTable === "function"
//     ) {

//         loadHistoryTable();
//     }
// }
/* ============================================================
   HISTORY MANAGEMENT
   ============================================================ */

const HISTORY_STORAGE_KEY = "sales_management_history";


/* ============================================================
   GET HISTORY DATA
   ============================================================ */

function getHistoryData() {

    try {

        const storedHistory =
            localStorage.getItem(HISTORY_STORAGE_KEY);

        if (!storedHistory) {
            return [];
        }

        const parsedHistory =
            JSON.parse(storedHistory);

        return Array.isArray(parsedHistory)
            ? parsedHistory
            : [];

    } catch (error) {

        console.error(
            "Không thể đọc lịch sử hoạt động:",
            error
        );

        return [];
    }
}


/* ============================================================
   RENDER HISTORY
   ============================================================ */

function loadHistoryTable() {

    /* Kiểm tra quyền xem lịch sử */
    if (
        typeof hasCurrentUserPermission === "function" &&
        !hasCurrentUserPermission("history_view")
    ) {
        return;
    }

    const tbody =
        document.getElementById("history-table-body");

    if (!tbody) {
        return;
    }

    const searchInput =
        document.getElementById("history-search-input");

    const actionFilter =
        document.getElementById("history-action-filter");

    const objectFilter =
        document.getElementById("history-object-filter");

    const search =
        searchInput
            ? searchInput.value.toLowerCase().trim()
            : "";

    const action =
        actionFilter
            ? actionFilter.value
            : "all";

    const object =
        objectFilter
            ? objectFilter.value
            : "all";


    /* Lấy dữ liệu thực tế từ localStorage */
    const historyData =
        getHistoryData();


    const filteredData =
        historyData.filter(item => {

            const matchSearch =
                !search ||
                (item.user || "").toLowerCase().includes(search) ||
                (item.action || "").toLowerCase().includes(search) ||
                (item.object || "").toLowerCase().includes(search) ||
                (item.code || "").toLowerCase().includes(search) ||
                (item.detail || "").toLowerCase().includes(search);

            const matchAction =
                action === "all" ||
                item.actionType === action;

            const matchObject =
                object === "all" ||
                item.object === object;

            return matchSearch &&
                   matchAction &&
                   matchObject;
        });


    tbody.innerHTML = "";


    if (filteredData.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="history-empty">
                        Không tìm thấy lịch sử hoạt động
                    </div>
                </td>
            </tr>
        `;

        updateHistoryCount(0);

        return;
    }


    filteredData.forEach((item, index) => {

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${index + 1}</td>

            <td class="history-time">
                ${item.time || ""}
            </td>

            <td class="history-user">
                ${item.user || ""}
            </td>

            <td>
                <span class="history-action ${item.actionType || ""}">
                    ${item.action || ""}
                </span>
            </td>

            <td>
                ${item.object || ""}
            </td>

            <td>
                ${item.code || ""}
            </td>

            <td>
                ${item.detail || ""}
            </td>
        `;

        tbody.appendChild(row);
    });


    updateHistoryCount(
        filteredData.length
    );
}


/* ============================================================
   COUNT
   ============================================================ */

function updateHistoryCount(count) {

    const element =
        document.getElementById("history-count");

    if (!element) {
        return;
    }

    element.textContent =
        `Hiển thị ${count} hoạt động`;
}


/* ============================================================
   INIT
   ============================================================ */

function initHistoryManagement() {

    /* Kiểm tra quyền */
    if (
        typeof requirePermission === "function" &&
        !requirePermission("history_view")
    ) {
        return;
    }


    const searchInput =
        document.getElementById("history-search-input");

    const actionFilter =
        document.getElementById("history-action-filter");

    const objectFilter =
        document.getElementById("history-object-filter");

    const refreshButton =
        document.getElementById("history-refresh-button");


    /* Tìm kiếm */
    if (
        searchInput &&
        !searchInput.dataset.initialized
    ) {

        searchInput.addEventListener(
            "input",
            loadHistoryTable
        );

        searchInput.dataset.initialized = "true";
    }


    /* Lọc hành động */
    if (
        actionFilter &&
        !actionFilter.dataset.initialized
    ) {

        actionFilter.addEventListener(
            "change",
            loadHistoryTable
        );

        actionFilter.dataset.initialized = "true";
    }


    /* Lọc đối tượng */
    if (
        objectFilter &&
        !objectFilter.dataset.initialized
    ) {

        objectFilter.addEventListener(
            "change",
            loadHistoryTable
        );

        objectFilter.dataset.initialized = "true";
    }


    /* Nút làm mới */
    if (
        refreshButton &&
        !refreshButton.dataset.initialized
    ) {

        refreshButton.addEventListener(
            "click",
            loadHistoryTable
        );

        refreshButton.dataset.initialized = "true";
    }


    /* Hiển thị dữ liệu ban đầu */
    loadHistoryTable();
}


/* ============================================================
   ADD HISTORY
   ============================================================ */

function addHistory({
    action,
    actionType,
    object,
    code = "",
    detail = ""
}) {

    const history =
        getHistoryData();


    let currentUser =
        "Người dùng";

    try {

        if (
            typeof getCurrentUser === "function"
        ) {

            const user =
                getCurrentUser();

            if (user) {

                currentUser =
                    user.name ||
                    user.fullName ||
                    user.username ||
                    currentUser;
            }

        } else {

            const storedUser =
                localStorage.getItem("currentUser");

            if (storedUser) {

                const user =
                    JSON.parse(storedUser);

                currentUser =
                    user.name ||
                    user.fullName ||
                    user.username ||
                    currentUser;
            }
        }

    } catch (error) {

        console.warn(
            "Không lấy được thông tin người dùng hiện tại.",
            error
        );
    }


    const now =
        new Date();

    const day =
        String(now.getDate()).padStart(2, "0");

    const month =
        String(now.getMonth() + 1).padStart(2, "0");

    const year =
        now.getFullYear();

    const hours =
        String(now.getHours()).padStart(2, "0");

    const minutes =
        String(now.getMinutes()).padStart(2, "0");


    const historyItem = {

        time:
            `${day}/${month}/${year} ${hours}:${minutes}`,

        user:
            currentUser,

        action:
            action,

        actionType:
            actionType,

        object:
            object,

        code:
            code,

        detail:
            detail
    };


    /* Đưa hoạt động mới lên đầu */
    history.unshift(historyItem);


    try {

        localStorage.setItem(
            HISTORY_STORAGE_KEY,
            JSON.stringify(history)
        );

    } catch (error) {

        console.error(
            "Không thể lưu lịch sử hoạt động:",
            error
        );

        return;
    }


    /* Nếu trang lịch sử đang mở thì cập nhật */
    if (
        typeof loadHistoryTable === "function"
    ) {

        loadHistoryTable();
    }
}