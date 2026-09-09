/* =========================================================
   SALES MANAGEMENT
   PERMISSION MANAGEMENT - FRONTEND
   ========================================================= */

/*
    =========================================================
    1. TÀI KHOẢN HIỆN TẠI
    =========================================================

    Hiện tại FRONTEND chưa có backend/login thật nên dùng
    tài khoản giả lập.

    Sau này:
        currentPermissionUser
        sẽ được lấy từ API đăng nhập / token / session.
*/

let currentPermissionUser = null;


/* =========================================================
   LẤY TÀI KHOẢN ĐANG ĐĂNG NHẬP
   ========================================================= */

function syncCurrentPermissionUser() {

    try {

        const saved =
            localStorage.getItem(
                "sales_management_current_user"
            );

        if (!saved) {
            currentPermissionUser = null;
            return;
        }

        const user = JSON.parse(saved);

        if (!user) {
            currentPermissionUser = null;
            return;
        }

        /*
         * Chuyển role từ hệ thống tài khoản
         * sang role của module phân quyền.
         */
        const roleMap = {
            admin: "ADMIN",
            owner: "OWNER",
            staff: "SALES",
            customer: "CUSTOMER"
        };

        currentPermissionUser = {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: roleMap[user.role] || null,
            phone: user.phone || "",
            isActive: user.isActive === true
        };

    } catch (error) {

        console.error(
            "Không thể đồng bộ tài khoản hiện tại:",
            error
        );

        currentPermissionUser = null;
    }
}


/* =========================================================
   3. DANH SÁCH QUYỀN
   ========================================================= */

const permissionDefinitions = [

    {
        key: "login",
        name: "Đăng nhập / đăng xuất",
        description: "Cho phép đăng nhập và đăng xuất khỏi hệ thống."
    },

    {
        key: "permission",
        name: "Phân quyền",
        description: "Quản lý quyền sử dụng chức năng của các vai trò."
    },

    {
        key: "user_manage",
        name: "Quản lý người dùng",
        description: "Tạo, sửa, khóa và quản lý tài khoản người dùng."
    },

    {
        key: "product_manage",
        name: "Quản lý sản phẩm",
        description: "Thêm, sửa, xóa và quản lý sản phẩm."
    },

    {
        key: "customer_manage",
        name: "Quản lý khách hàng",
        description: "Quản lý thông tin khách hàng."
    },

    {
        key: "search_filter",
        name: "Tìm kiếm / lọc",
        description: "Tìm kiếm và lọc dữ liệu trong hệ thống."
    },

    {
        key: "invoice_create",
        name: "Lập hóa đơn",
        description: "Tạo và lập hóa đơn bán hàng."
    },

    {
        key: "invoice_search",
        name: "Tìm kiếm / lọc hóa đơn",
        description: "Tìm kiếm và lọc hóa đơn."
    },

    {
        key: "purchase_track",
        name: "Theo dõi nhập hàng",
        description: "Theo dõi tình trạng nhập hàng."
    },

    {
        key: "inventory_view",
        name: "Xem sản phẩm và tồn kho",
        description: "Xem thông tin sản phẩm và số lượng tồn kho."
    },

    {
        key: "revenue_statistics",
        name: "Xem thống kê doanh thu",
        description: "Xem các thống kê liên quan đến doanh thu."
    },

    {
        key: "top_products",
        name: "Xem sản phẩm bán chạy",
        description: "Xem danh sách các sản phẩm bán chạy."
    },

    {
        key: "report_export",
        name: "Xuất báo cáo",
        description: "Xuất dữ liệu và báo cáo."
    },

    {
        key: "sales_data_qa",
        name: "Hỏi đáp dữ liệu bán hàng",
        description: "Tra cứu và hỏi đáp dữ liệu bán hàng."
    },

    {
        key: "ai_product_advice",
        name: "Sử dụng AI tư vấn sản phẩm / xem kết quả",
        description: "Sử dụng chức năng AI tư vấn sản phẩm."
    },

    {
        key: "history_view",
        name: "Xem lịch sử",
        description: "Xem lịch sử hoạt động."
    }

];


/* =========================================================
   4. QUYỀN MẶC ĐỊNH
   ========================================================= */

const defaultRolePermissions = {

    ADMIN: {

        login: true,
        permission: true,
        user_manage: true,

        product_manage: true,
        customer_manage: true,
        search_filter: true,

        invoice_create: true,
        invoice_search: true,

        purchase_track: true,
        inventory_view: true,

        revenue_statistics: true,
        top_products: true,

        report_export: true,

        sales_data_qa: true,
        ai_product_advice: true,

        history_view: true
    },


    SALES: {

        login: true,
        permission: false,
        user_manage: false,

        product_manage: false,
        customer_manage: true,
        search_filter: true,

        invoice_create: true,
        invoice_search: true,

        purchase_track: false,
        inventory_view: false,

        revenue_statistics: false,
        top_products: false,

        report_export: false,

        sales_data_qa: false,
        ai_product_advice: false,

        history_view: true
    },


    OWNER: {

        login: true,
        permission: false,
        user_manage: true,

        product_manage: false,
        customer_manage: false,
        search_filter: false,

        invoice_create: false,
        invoice_search: false,

        purchase_track: true,
        inventory_view: true,

        revenue_statistics: true,
        top_products: true,

        report_export: true,

        sales_data_qa: true,
        ai_product_advice: true,

        history_view: true
    },


    CUSTOMER: {

        login: true,
        permission: false,
        user_manage: false,

        product_manage: false,
        customer_manage: false,
        search_filter: false,

        invoice_create: false,
        invoice_search: false,

        purchase_track: false,
        inventory_view: false,

        revenue_statistics: false,
        top_products: false,

        report_export: false,

        sales_data_qa: false,
        ai_product_advice: true,

        history_view: false
    }

};


/* =========================================================
   5. MÔ TẢ ROLE
   ========================================================= */

const roleDescriptions = {

    ADMIN:
        "Quản trị viên: quản lý sản phẩm, khách hàng, phân quyền và các chức năng quản trị được hệ thống cho phép.",

    SALES:
        "Nhân viên bán hàng: quản lý khách hàng, lập hóa đơn, tìm kiếm/lọc và xem lịch sử.",

    OWNER:
        "Chủ cửa hàng: theo dõi nhập hàng, tồn kho, doanh thu, sản phẩm bán chạy, báo cáo và các chức năng AI.",

    CUSTOMER:
        "Khách hàng: cung cấp nhu cầu và sử dụng chức năng AI tư vấn sản phẩm."

};


/* =========================================================
   6. DỮ LIỆU QUYỀN
   ========================================================= */

/*
    rolePermissions
    = dữ liệu ĐÃ LƯU.

    permissionDrafts
    = dữ liệu ĐANG CHỈNH SỬA.
*/

let rolePermissions =
    clonePermissions(defaultRolePermissions);

let permissionDrafts =
    clonePermissions(defaultRolePermissions);


/* =========================================================
   7. HELPER CLONE
   ========================================================= */

function clonePermissions(data) {

    return JSON.parse(
        JSON.stringify(data)
    );

}


/* =========================================================
   8. LOAD PERMISSIONS FROM DATABASE
   ========================================================= */

async function loadPermissionsFromAPI() {

    rolePermissions =
        clonePermissions(
            defaultRolePermissions
        );

    if (
        !currentPermissionUser ||
        !window.salesApi ||
        !window.salesApi.permissions
    ) {
        permissionDrafts = clonePermissions(rolePermissions);
        return false;
    }

    try {

        const saved =
            await window.salesApi.permissions.list();

        Object.keys(
            defaultRolePermissions
        ).forEach(function (role) {

            rolePermissions[role] = {
                ...defaultRolePermissions[role],
                ...(saved[role] || {})
            };

        });

        permissionDrafts =
            clonePermissions(
                rolePermissions
            );

        return true;

    } catch (error) {

        console.error(
            "Lỗi khi tải dữ liệu phân quyền từ database:",
            error
        );

        permissionDrafts =
            clonePermissions(
                rolePermissions
            );

        return false;
    }
}


/* =========================================================
   10. TÊN ROLE
   ========================================================= */

function getRoleName(role) {

    const names = {

        ADMIN: "Quản trị viên",

        OWNER: "Chủ cửa hàng",

        SALES: "Nhân viên bán hàng",

        CUSTOMER: "Khách hàng"

    };

    return names[role] || role;

}


/* =========================================================
   11. KIỂM TRA QUYỀN
   ========================================================= */

// // function hasPermission(role, permissionKey) {
//     if (!role) {
//         return false;
//     }
//     if (!rolePermissions[role]) {
//         return false;
//     }
//     return (
//         rolePermissions[role][permissionKey] === true
//     );
// } 
function hasPermission(role, permissionKey) {

    if (!role) {
        return false;
    }

    // Admin có toàn quyền
    if (role === "ADMIN") {
        return true;
    }

    if (!rolePermissions[role]) {
        return false;
    }

    return (
        rolePermissions[role][permissionKey] === true
    );
}


/* =========================================================
   12. KIỂM TRA QUYỀN TÀI KHOẢN HIỆN TẠI
   ========================================================= */

/*
    Đây là hàm QUAN TRỌNG để các module khác sử dụng.

    Ví dụ:

        hasCurrentUserPermission("product_manage")

    hoặc:

        if (!hasCurrentUserPermission("invoice_create")) {
            return;
        }
*/

function hasCurrentUserPermission(permissionKey) {

    if (!currentPermissionUser) {
        return false;
    }

    if (
        currentPermissionUser.isActive !== true
    ) {
        return false;
    }

    return hasPermission(
        currentPermissionUser.role,
        permissionKey
    );

}


/* =========================================================
   13. KIỂM TRA QUYỀN QUẢN LÝ PHÂN QUYỀN
   ========================================================= */

function canManagePermissions() {

    if (!currentPermissionUser) {
        return false;
    }

    if (
        currentPermissionUser.isActive !== true
    ) {
        return false;
    }

    return hasCurrentUserPermission("permission");

}


/* =========================================================
   14. KHỞI TẠO TRANG
   ========================================================= */

async function initPermissionManagement() {

    syncCurrentPermissionUser();

    await loadPermissionsFromAPI();

    renderPermissionPage();

    applyPermissionVisibility();

}


/* =========================================================
   15. RENDER TRANG
   ========================================================= */

function renderPermissionPage() {

    const deniedBox =
        document.getElementById(
            "permission-denied"
        );

    const permissionContent =
        document.getElementById(
            "permission-content"
        );


    if (
        !deniedBox ||
        !permissionContent
    ) {
        return;
    }


    /*
        Không có quyền phân quyền.
    */

    if (!canManagePermissions()) {

        deniedBox.style.display =
            "block";

        permissionContent.classList.remove(
            "active"
        );

        return;
    }


    /*
        Có quyền.
    */

    deniedBox.style.display =
        "none";

    permissionContent.classList.add(
        "active"
    );


    renderCurrentPermissionUser();


    const roleSelect =
        document.getElementById(
            "permission-role-select"
        );


    let selectedRole =
        "ADMIN";


    if (
        roleSelect &&
        roleSelect.value &&
        rolePermissions[
            roleSelect.value
        ]
    ) {

        selectedRole =
            roleSelect.value;

    }


    if (roleSelect) {

        roleSelect.value =
            selectedRole;

    }


    renderRolePermissions(
        selectedRole
    );

}


/* =========================================================
   16. RENDER THÔNG TIN TÀI KHOẢN
   ========================================================= */

function renderCurrentPermissionUser() {

    if (!currentPermissionUser) {
        return;
    }


    const username =
        document.getElementById(
            "permission-current-username"
        );

    const fullName =
        document.getElementById(
            "permission-current-fullname"
        );

    const role =
        document.getElementById(
            "permission-current-role"
        );

    const status =
        document.getElementById(
            "permission-current-status"
        );


    if (username) {

        username.textContent =
            currentPermissionUser.username;

    }


    if (fullName) {

        fullName.textContent =
            currentPermissionUser.fullName;

    }


    if (role) {

        role.textContent =
            getRoleName(
                currentPermissionUser.role
            );

    }


    if (status) {

        status.textContent =
            currentPermissionUser.isActive
                ? "Đang hoạt động"
                : "Đã khóa";

    }

}


/* =========================================================
   17. ĐỔI ROLE
   ========================================================= */

function changePermissionRole() {

    const select =
        document.getElementById(
            "permission-role-select"
        );


    if (!select) {
        return;
    }


    const role =
        select.value;


    renderRolePermissions(role);

}


/* =========================================================
   18. RENDER BẢNG QUYỀN
   ========================================================= */

function renderRolePermissions(role) {

    const tbody =
        document.getElementById(
            "permission-table-body"
        );

    const description =
        document.getElementById(
            "permission-role-description"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";


    /*
        Mô tả role.
    */

    if (description) {

        description.textContent =
            roleDescriptions[role] ||
            "Chưa có mô tả cho vai trò này.";

    }


    /*
        Đảm bảo draft tồn tại.
    */

    if (!permissionDrafts[role]) {

        permissionDrafts[role] = {};

    }


    const permissions =
        permissionDrafts[role];


    /*
        Tạo từng dòng.
    */

    permissionDefinitions.forEach(
        function (permission, index) {

            const allowed =
                permissions[
                    permission.key
                ] === true;


            const row =
                document.createElement("tr");


            /*
                Class cho trạng thái.
            */

            row.className =
                allowed
                    ? "permission-row allowed-row"
                    : "permission-row denied-row";


            row.innerHTML = `

                <td class="permission-name-cell">

                    <div class="permission-name">
                        ${escapeHTML(permission.name)}
                    </div>

                    <div class="permission-description">
                        ${escapeHTML(permission.description)}
                    </div>

                </td>


                <td class="permission-status-cell">

                    <label
                        class="permission-switch"
                        title="${
                            allowed
                                ? "Đang được phép"
                                : "Đang không được phép"
                        }"
                    >

                        <input
                            type="checkbox"

                            class="permission-checkbox"

                            data-role="${escapeHTML(role)}"

                            data-permission="${escapeHTML(permission.key)}"

                            ${allowed ? "checked" : ""}
                            ${role === "ADMIN" ? "disabled" : ""}
                        >

                        <span class="permission-slider"></span>

                    </label>


                    <span
                        class="permission-status-text ${
                            allowed
                                ? "status-allowed"
                                : "status-denied"
                        }"
                    >
                        ${
                            allowed
                                ? "Được phép"
                                : "Không được phép"
                        }
                    </span>

                </td>

            `;


            tbody.appendChild(row);

        }
    );


    /*
        Áp dụng CSS đẹp cho bảng nếu project
        chưa có CSS tương ứng.
    */

    injectPermissionStyles();

}


/* =========================================================
   19. CHECKBOX CHANGE
   ========================================================= */

function handlePermissionCheckboxChange(event) {

    const checkbox =
        event.target.closest(
            ".permission-checkbox"
        );


    if (!checkbox) {
        return;
    }


    /*
        Kiểm tra quyền ADMIN.
    */

    if (!canManagePermissions()) {

        checkbox.checked =
            !checkbox.checked;

        alert(
            "Bạn không có quyền thay đổi phân quyền."
        );

        return;
    }


    const role =
        checkbox.dataset.role;


    const permissionKey =
        checkbox.dataset.permission;


    if (
        !role ||
        !permissionKey
    ) {
        return;
    }


    if (!permissionDrafts[role]) {

        permissionDrafts[role] = {};

    }


    /*
        Cập nhật draft.
    */

    permissionDrafts[role][
        permissionKey
    ] = checkbox.checked;


    /*
        Cập nhật UI ngay lập tức.
    */

    const row =
        checkbox.closest("tr");


    if (row) {

        row.classList.toggle(
            "allowed-row",
            checkbox.checked
        );

        row.classList.toggle(
            "denied-row",
            !checkbox.checked
        );


        const statusText =
            row.querySelector(
                ".permission-status-text"
            );


        if (statusText) {

            statusText.textContent =
                checkbox.checked
                    ? "Được phép"
                    : "Không được phép";


            statusText.classList.toggle(
                "status-allowed",
                checkbox.checked
            );

            statusText.classList.toggle(
                "status-denied",
                !checkbox.checked
            );

        }


        const switchElement =
            row.querySelector(
                ".permission-switch"
            );


        if (switchElement) {

            switchElement.title =
                checkbox.checked
                    ? "Đang được phép"
                    : "Đang không được phép";

        }

    }


    updatePermissionSaveState();

}


/* =========================================================
   20. KIỂM TRA CÓ THAY ĐỔI
   ========================================================= */

function hasUnsavedChanges(role) {

    if (
        !role ||
        !rolePermissions[role] ||
        !permissionDrafts[role]
    ) {

        return false;

    }


    for (
        const permission
        of permissionDefinitions
    ) {

        const key =
            permission.key;


        const saved =
            rolePermissions[role][key] === true;


        const draft =
            permissionDrafts[role][key] === true;


        if (saved !== draft) {

            return true;

        }

    }


    return false;

}


/* =========================================================
   21. CẬP NHẬT TRẠNG THÁI NÚT
   ========================================================= */

function updatePermissionSaveState() {

    const roleSelect =
        document.getElementById(
            "permission-role-select"
        );


    const saveButton =
        document.getElementById(
            "permission-save-button"
        );


    const resetButton =
        document.getElementById(
            "permission-reset-button"
        );


    if (!roleSelect) {
        return;
    }


    const role =
        roleSelect.value;


    const changed =
        hasUnsavedChanges(role);


    /*
        Nút lưu.
    */

    if (saveButton) {

        saveButton.classList.toggle(
            "has-changes",
            changed
        );

        saveButton.disabled =
            !changed;


        if (changed) {

            saveButton.title =
                "Có thay đổi chưa được lưu";

        } else {

            saveButton.title =
                "Không có thay đổi";

        }

    }


    /*
        Nút làm mới.
    */

    if (resetButton) {

        resetButton.classList.toggle(
            "has-changes",
            changed
        );

    }

}


/* =========================================================
   22. LƯU QUYỀN
   ========================================================= */

async function savePermissions() {

    if (!canManagePermissions()) {

        alert(
            "Bạn không có quyền truy cập chức năng này."
        );

        return;
    }


    const roleSelect =
        document.getElementById(
            "permission-role-select"
        );


    if (!roleSelect) {
        return;
    }


    const role =
        roleSelect.value;


    if (role === "ADMIN") {

        alert(
            "Quản trị viên luôn có toàn quyền và không thể thay đổi."
        );

        return;
    }


    if (!rolePermissions[role]) {

        alert(
            "Vai trò không hợp lệ."
        );

        return;
    }


    /*
        Không có thay đổi.
    */

    if (!hasUnsavedChanges(role)) {

        alert(
            `Không có thay đổi nào cần lưu cho vai trò "${getRoleName(role)}".`
        );

        return;
    }


    try {

        const saved =
            await window.salesApi.permissions.update(
                role,
                permissionDrafts[role]
            );

        rolePermissions[role] = {
            ...defaultRolePermissions[role],
            ...saved
        };

        permissionDrafts[role] =
            clonePermissions(
                rolePermissions[role]
            );

    } catch (error) {

        alert(
            error.message ||
            "Không thể lưu quyền. Vui lòng thử lại."
        );

        return;
    }


    /*
        Render lại.
    */

    renderRolePermissions(role);


    updatePermissionSaveState();

    applyPermissionVisibility();


    /*
        Thông báo.
    */

    alert(
        `Đã lưu quyền cho vai trò "${getRoleName(role)}".`
    );

}


/* =========================================================
   23. LÀM MỚI
   ========================================================= */

function resetPermissions() {

    const roleSelect =
        document.getElementById(
            "permission-role-select"
        );


    if (!roleSelect) {
        return;
    }


    const role =
        roleSelect.value;


    /*
        Không có thay đổi.
    */

    if (!hasUnsavedChanges(role)) {

        renderRolePermissions(role);

        return;
    }


    /*
        Khôi phục draft bằng dữ liệu đã lưu.
    */

    permissionDrafts[role] =
        clonePermissions(
            rolePermissions[role]
        );


    renderRolePermissions(role);

    updatePermissionSaveState();

}


/* =========================================================
   24. RESET TOÀN BỘ VỀ MẶC ĐỊNH
   ========================================================= */

/*
    Chỉ dùng để TEST frontend.

    Không phải nút "Làm mới".
*/

async function resetAllPermissionsToDefault() {

    const confirmed =
        confirm(
            "Bạn có chắc muốn khôi phục toàn bộ quyền về mặc định?"
        );


    if (!confirmed) {
        return;
    }


    if (!canManagePermissions()) {
        alert("Bạn không có quyền thay đổi phân quyền.");
        return;
    }

    try {

        for (const role of ["SALES", "OWNER", "CUSTOMER"]) {
            await window.salesApi.permissions.update(
                role,
                defaultRolePermissions[role]
            );
        }

        await loadPermissionsFromAPI();

    } catch (error) {

        alert(
            error.message ||
            "Không thể khôi phục quyền mặc định."
        );

        return;
    }


    renderPermissionPage();


    alert(
        "Đã khôi phục toàn bộ quyền mặc định."
    );

}


/* =========================================================
   25. TEST ĐĂNG NHẬP VỚI ROLE
   ========================================================= */

/*
    Dùng khi chưa có backend.

    Console:

        setPermissionTestRole("SALES");

    hoặc:

        setPermissionTestRole("OWNER");

    hoặc:

        setPermissionTestRole("CUSTOMER");

    hoặc:

        setPermissionTestRole("ADMIN");
*/

function setPermissionTestRole(role) {

    if (
        !rolePermissions[role]
    ) {

        console.warn(
            `Role "${role}" không tồn tại.`
        );

        return;

    }


    currentPermissionUser.role =
        role;


    /*
        Cập nhật username demo.
    */

    const usernames = {

        ADMIN: "admin01",

        SALES: "sales01",

        OWNER: "owner01",

        CUSTOMER: "customer01"

    };


    const fullNames = {

        ADMIN: "Quản trị viên",

        SALES: "Nhân viên bán hàng",

        OWNER: "Chủ cửa hàng",

        CUSTOMER: "Khách hàng"

    };


    currentPermissionUser.username =
        usernames[role] || "user01";


    currentPermissionUser.fullName =
        fullNames[role] || "Người dùng";


    currentPermissionUser.isActive =
        true;


    renderPermissionPage();


    console.log(
        `Đang test với tài khoản: ${getRoleName(role)}`
    );

}


/* =========================================================
   26. TEST KHÓA / MỞ TÀI KHOẢN
   ========================================================= */

function setPermissionTestAccountStatus(
    isActive
) {

    currentPermissionUser.isActive =
        Boolean(isActive);


    renderPermissionPage();

}


/* =========================================================
   27. BẢO VỆ CHỨC NĂNG
   ========================================================= */

/*
    Đây là hàm các module khác sẽ sử dụng.

    Ví dụ:

        if (!requirePermission("product_manage")) {
            return;
        }

    Nếu có quyền:
        return true

    Nếu không có quyền:
        alert + return false
*/

function requirePermission(permissionKey) {

    if (
        hasCurrentUserPermission(
            permissionKey
        )
    ) {

        return true;

    }


    const permission =
        permissionDefinitions.find(
            function (item) {

                return (
                    item.key === permissionKey
                );

            }
        );


    const permissionName =
        permission
            ? permission.name
            : permissionKey;


    alert(
        `Bạn không có quyền sử dụng chức năng "${permissionName}".`
    );


    return false;

}


function requireAnyPermission(permissionKeys) {

    const keys = Array.isArray(permissionKeys)
        ? permissionKeys
        : [permissionKeys];

    if (
        keys.some(function (permissionKey) {
            return hasCurrentUserPermission(permissionKey);
        })
    ) {
        return true;
    }

    alert(
        "Bạn không có quyền sử dụng chức năng này."
    );

    return false;
}


/* =========================================================
   28. ẨN / HIỆN PHẦN TỬ THEO QUYỀN
   ========================================================= */

/*
    Dùng cho menu / button.

    HTML có thể dùng:

        data-permission="product_manage"

    JS sẽ tự ẩn nếu không có quyền.
*/

function applyPermissionVisibility() {

    const elements =
        document.querySelectorAll(
            "[data-permission]:not(.permission-checkbox), [data-permission-any]"
        );


    elements.forEach(
        function (element) {

            const permissionKeys =
                (
                    element.dataset.permissionAny ||
                    element.dataset.permission ||
                    ""
                )
                .split(",")
                .map(function (key) {
                    return key.trim();
                })
                .filter(Boolean);


            if (
                permissionKeys.some(function (permissionKey) {
                    return hasCurrentUserPermission(permissionKey);
                })
            ) {

                element.style.display = "";

                element.classList.remove(
                    "permission-disabled"
                );

                element.removeAttribute(
                    "aria-disabled"
                );

                element.removeAttribute(
                    "aria-hidden"
                );

            } else {

                if (
                    element.classList.contains(
                        "menu-item"
                    )
                ) {

                    element.style.display = "";

                    element.classList.add(
                        "permission-disabled"
                    );

                    element.setAttribute(
                        "aria-disabled",
                        "true"
                    );

                    element.removeAttribute(
                        "aria-hidden"
                    );

                    return;
                }

                element.style.display = "none";

                element.setAttribute(
                    "aria-hidden",
                    "true"
                );

            }

        }
    );

}


/* =========================================================
   29. ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =========================================================
   30. CSS CHO BẢNG PHÂN QUYỀN
   ========================================================= */

function injectPermissionStyles() {

    if (
        document.getElementById(
            "permission-management-styles"
        )
    ) {

        return;

    }


    const style =
        document.createElement("style");


    style.id =
        "permission-management-styles";


    style.textContent = `

        /* =========================================
           PERMISSION TABLE
        ========================================= */

        #permission-table-body tr {
            transition:
                background-color 0.2s ease,
                transform 0.15s ease;
        }


        #permission-table-body tr:hover {
            transform: translateY(-1px);
        }


        .permission-name-cell {
            padding: 14px 16px;
        }


        .permission-name {
            font-size: 14px;
            font-weight: 600;
            color: #1f2937;
        }


        .permission-description {
            margin-top: 4px;
            font-size: 12px;
            color: #6b7280;
            line-height: 1.45;
        }


        .permission-status-cell {
            padding: 14px 16px;
            white-space: nowrap;
        }


        /* =========================================
           SWITCH
        ========================================= */

        .permission-switch {
            position: relative;

            display: inline-block;

            width: 44px;
            height: 24px;

            margin-right: 9px;

            vertical-align: middle;

            cursor: pointer;
        }


        .permission-switch input {
            opacity: 0;
            width: 0;
            height: 0;
            position: absolute;
        }


        .permission-slider {
            position: absolute;

            inset: 0;

            border-radius: 999px;

            background: #d1d5db;

            transition:
                background-color 0.2s ease,
                box-shadow 0.2s ease;
        }


        .permission-slider::before {
            content: "";

            position: absolute;

            width: 18px;
            height: 18px;

            left: 3px;
            top: 3px;

            border-radius: 50%;

            background: white;

            box-shadow:
                0 1px 4px rgba(0, 0, 0, 0.18);

            transition:
                transform 0.2s ease;
        }


        .permission-switch input:checked
        + .permission-slider {
            background: #22c55e;
        }


        .permission-switch input:checked
        + .permission-slider::before {
            transform: translateX(20px);
        }


        .permission-switch:hover
        .permission-slider {
            box-shadow:
                0 0 0 4px rgba(34, 197, 94, 0.10);
        }


        /* =========================================
           STATUS TEXT
        ========================================= */

        .permission-status-text {
            display: inline-block;

            min-width: 92px;

            font-size: 12px;
            font-weight: 600;

            vertical-align: middle;
        }

        .menu-item.permission-disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }


        .status-allowed {
            color: #16a34a;
        }


        .status-denied {
            color: #9ca3af;
        }


        /* =========================================
           ROW STATUS
        ========================================= */

        .allowed-row {
            background:
                rgba(34, 197, 94, 0.025);
        }


        .denied-row {
            background:
                rgba(107, 114, 128, 0.018);
        }


        /* =========================================
           SAVE BUTTON
        ========================================= */

        #permission-save-button {
            transition:
                opacity 0.2s ease,
                transform 0.15s ease,
                box-shadow 0.2s ease;
        }


        #permission-save-button:not(:disabled):hover {
            transform: translateY(-1px);

            box-shadow:
                0 5px 14px rgba(0, 0, 0, 0.12);
        }


        #permission-save-button:disabled {
            cursor: not-allowed;
            opacity: 0.55;
        }


        #permission-save-button.has-changes {
            animation:
                permissionPulse 1.8s ease-in-out infinite;
        }


        @keyframes permissionPulse {

            0%,
            100% {
                box-shadow:
                    0 0 0 0 rgba(59, 130, 246, 0);
            }

            50% {
                box-shadow:
                    0 0 0 4px rgba(59, 130, 246, 0.08);
            }

        }


        /* =========================================
           RESET BUTTON
        ========================================= */

        #permission-reset-button {
            transition:
                transform 0.15s ease,
                box-shadow 0.2s ease;
        }


        #permission-reset-button:hover {
            transform: translateY(-1px);
        }


        /* =========================================
           RESPONSIVE
        ========================================= */

        @media (max-width: 700px) {

            .permission-description {
                display: none;
            }


            .permission-status-text {
                min-width: auto;
            }

        }

    `;


    document.head.appendChild(style);

}


/* =========================================================
   31. EVENT LISTENERS
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        /*
            Load dữ liệu.
        */
        syncCurrentPermissionUser();
        await loadPermissionsFromAPI();


        /*
            Thêm CSS.
        */

        injectPermissionStyles();


        /*
            Role select.
        */

        const roleSelect =
            document.getElementById(
                "permission-role-select"
            );


        /*
            Save button.
        */

        const saveButton =
            document.getElementById(
                "permission-save-button"
            );


        /*
            Reset button.
        */

        const resetButton =
            document.getElementById(
                "permission-reset-button"
            );


        /*
            Permission table.
        */

        const permissionTableBody =
            document.getElementById(
                "permission-table-body"
            );


        /*
            Đổi role.
        */

        if (roleSelect) {

            roleSelect.addEventListener(
                "change",
                changePermissionRole
            );

        }


        /*
            Lưu.
        */

        if (saveButton) {

            saveButton.addEventListener(
                "click",
                savePermissions
            );

        }


        /*
            Làm mới.
        */

        if (resetButton) {

            resetButton.addEventListener(
                "click",
                resetPermissions
            );

        }


        /*
            Checkbox.

            Dùng event delegation vì checkbox
            được tạo động bằng JS.
        */

        if (permissionTableBody) {

            permissionTableBody.addEventListener(
                "change",
                handlePermissionCheckboxChange
            );

        }


        /*
            Render lần đầu.
        */

        renderPermissionPage();


        /*
            Áp dụng quyền cho các element
            có data-permission.
        */

        applyPermissionVisibility();


        /*
            Cập nhật trạng thái nút.
        */

        updatePermissionSaveState();

    }
);


window.addEventListener(
    "auth:login",
    async function () {
        syncCurrentPermissionUser();
        await loadPermissionsFromAPI();
        renderPermissionPage();
        applyPermissionVisibility();
    }
);


window.addEventListener(
    "auth:logout",
    function () {
        syncCurrentPermissionUser();
        rolePermissions = clonePermissions(defaultRolePermissions);
        permissionDrafts = clonePermissions(defaultRolePermissions);
        renderPermissionPage();
        applyPermissionVisibility();
    }
);


/* =========================================================
   32. API FRONTEND CHO CÁC MODULE KHÁC
   ========================================================= */

/*
    Các file khác trong frontend có thể dùng:

        hasCurrentUserPermission("product_manage")

        requirePermission("product_manage")

        applyPermissionVisibility()

    Ví dụ:

        function openProductManagement() {

            if (!requirePermission("product_manage")) {
                return;
            }

            // mở trang sản phẩm
        }
*/


/* =========================================================
   33. DEBUG
   ========================================================= */

console.log(
    "✓ Permission Management loaded."
);

console.log(
    "Current user:",
    currentPermissionUser
);

window.syncCurrentPermissionUser =
    syncCurrentPermissionUser;

window.loadPermissionsFromAPI =
    loadPermissionsFromAPI;

window.requirePermission =
    requirePermission;

window.requireAnyPermission =
    requireAnyPermission;

window.hasCurrentUserPermission =
    hasCurrentUserPermission;

window.applyPermissionVisibility =
    applyPermissionVisibility;
