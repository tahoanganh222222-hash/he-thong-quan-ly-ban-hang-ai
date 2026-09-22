/* =========================================================
   USERS MANAGEMENT
   Dữ liệu từ FastAPI + SQL Server
   - Role: owner / staff / customer
   - Tài khoản tạo mới có thể đăng nhập ngay
   ========================================================= */

(function () {
    "use strict";

    /* =========================================================
       CONFIG
       ========================================================= */

    const USERS_STORAGE_KEY = "sales_management_users";

    /*
     * Role dùng thống nhất với hệ thống phân quyền:
     *
     * owner    = Chủ cửa hàng
     * staff    = Nhân viên
     * customer = Khách hàng
     */
    const roleNames = {
        admin: "Quản trị viên",
        owner: "Chủ cửa hàng",
        staff: "Nhân viên",
        customer: "Khách hàng"
    };

    const roleDescriptions = {
        admin:
            "Quản trị viên quản lý tài khoản, phân quyền và các chức năng quản trị của hệ thống.",
        owner:
            "Chủ cửa hàng có quyền quản lý và theo dõi hoạt động của cửa hàng.",
        staff:
            "Nhân viên thực hiện các nghiệp vụ bán hàng và quản lý khách hàng theo quyền được cấp.",
        customer:
            "Khách hàng sử dụng các chức năng dành cho người mua."
    };


    /* =========================================================
       DEFAULT MOCK USERS
       ========================================================= */

    const defaultUsers = [
        {
            id: 1,
            fullName: "Nguyễn Văn A",
            username: "owner01",
            phone: "0901234567",
            email: "owner@example.com",
            role: "owner",
            isActive: true
        },

        {
            id: 2,
            fullName: "Trần Văn B",
            username: "staff01",
            phone: "0912345678",
            email: "staff@example.com",
            role: "staff",
            isActive: true
        },

        {
            id: 3,
            fullName: "Lê Văn C",
            username: "user01",
            phone: "0923456789",
            email: "user@example.com",
            role: "customer",
            isActive: true
        },

        {
            id: 4,
            fullName: "Phạm Thị D",
            username: "staff02",
            phone: "0934567890",
            email: "staff02@example.com",
            role: "staff",
            isActive: false
        },
        {
            id: 5,
            fullName: "Quản trị viên",
            username: "admin",
            phone: "0900000000",
            email: "admin@example.com",
            role: "admin",
            isActive: true
        },
    ];


    /* =========================================================
       STATE
       ========================================================= */

    let users = [];

    let editingUserId = null;


    /* =========================================================
       GET ELEMENT
       ========================================================= */

    function getElement(id) {
        return document.getElementById(id);
    }


    /* =========================================================
       ESCAPE HTML
       ========================================================= */

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =========================================================
       NORMALIZE USER
       ========================================================= */

    function normalizeUser(user) {

        return {
            id: Number(user.id),

            fullName:
                String(user.fullName || "").trim(),

            username:
                String(user.username || "").trim(),

            phone:
                String(user.phone || "").trim(),

            email:
                String(user.email || "").trim(),

            role:
                roleNames[user.role]
                    ? user.role
                    : "customer",

            isActive:
                user.isActive !== false
        };
    }


    /* =========================================================
       STORAGE
       ========================================================= */

    function loadUsersFromStorage() {
    const existingUsers = localStorage.getItem(USERS_STORAGE_KEY);

    if (existingUsers) {
        try {
            users = JSON.parse(existingUsers).map(normalizeUser);

            // Nếu chưa có Admin thì tự động thêm Admin
            const hasAdmin = users.some(user => user.role === "admin");

            if (!hasAdmin) {
                const nextId =
                    users.length > 0
                        ? Math.max(...users.map(user => Number(user.id) || 0)) + 1
                        : 1;

                users.push(
                    normalizeUser({
                        id: nextId,
                        fullName: "Quản trị viên",
                        username: "admin",
                        phone: "0900000000",
                        email: "admin@example.com",
                        role: "admin",
                        isActive: true
                    })
                );

                saveUsersToStorage();
            }

        } catch (error) {
            console.error("Dữ liệu người dùng không hợp lệ:", error);
            users = defaultUsers.map(normalizeUser);
            saveUsersToStorage();
        }

    } else {
        users = defaultUsers.map(normalizeUser);
        saveUsersToStorage();
    }

    return users;
}


    function saveUsersToStorage() {

        try {

            localStorage.setItem(
                USERS_STORAGE_KEY,
                JSON.stringify(users)
            );

        } catch (error) {

            console.error(
                "Không thể lưu dữ liệu users:",
                error
            );
        }
    }


    /* =========================================================
       DATA LAYER - FASTAPI
       ========================================================= */


    async function getUsers() {

        users = (
            await window.salesApi.users.list()
        ).map(normalizeUser);

        return users;
    }


    async function createUser(userData) {

        const newUser = normalizeUser(
            await window.salesApi.users.create(userData)
        );

        users.push(newUser);

        return newUser;
    }


    async function updateUser(userId, userData) {

        const updatedUser = normalizeUser(
            await window.salesApi.users.update(userId, userData)
        );

        users = users.map(user =>
            Number(user.id) === Number(userId)
                ? updatedUser
                : user
        );

        return updatedUser;
    }

    async function changeUserStatus(userId) {

        const user = users.find(
            item => Number(item.id) === Number(userId)
        );

        if (!user) {
            throw new Error("Không tìm thấy tài khoản.");
        }

        return updateUser(userId, {
            isActive: !user.isActive
        });
    }

    /* =========================================================
       FILTER USERS
       ========================================================= */

    function getFilteredUsers() {

        const searchInput =
            getElement("users-search");

        const roleFilter =
            getElement("users-role-filter");

        const statusFilter =
            getElement("users-status-filter");


        const search =
            searchInput
                ? searchInput.value
                    .trim()
                    .toLowerCase()
                : "";


        const role =
            roleFilter
                ? roleFilter.value
                : "all";


        const status =
            statusFilter
                ? statusFilter.value
                : "all";


        return users.filter(user => {

            const fullName =
                String(
                    user.fullName || ""
                ).toLowerCase();


            const username =
                String(
                    user.username || ""
                ).toLowerCase();


            const email =
                String(
                    user.email || ""
                ).toLowerCase();


            const phone =
                String(
                    user.phone || ""
                ).toLowerCase();


            const matchesSearch =
                !search ||
                fullName.includes(search) ||
                username.includes(search) ||
                email.includes(search) ||
                phone.includes(search);


            const matchesRole =
                role === "all" ||
                user.role === role;


            const matchesStatus =
                status === "all" ||

                (
                    status === "active" &&
                    user.isActive
                ) ||

                (
                    status === "inactive" &&
                    !user.isActive
                );


            return (
                matchesSearch &&
                matchesRole &&
                matchesStatus
            );
        });
    }


    /* =========================================================
       RENDER USERS
       ========================================================= */

    function renderUsers() {

        const tbody =
            getElement(
                "users-table-body"
            );

        const count =
            getElement(
                "users-count"
            );


        if (!tbody) {

            return;
        }


        const filteredUsers =
            getFilteredUsers();


        if (count) {

            count.textContent =
                `${filteredUsers.length} tài khoản`;
        }


        if (
            filteredUsers.length === 0
        ) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="users-empty">
                            Không tìm thấy tài khoản phù hợp
                        </div>
                    </td>
                </tr>
            `;

            return;
        }


        tbody.innerHTML =
            filteredUsers
                .map(renderUserRow)
                .join("");
    }


    /* =========================================================
       RENDER USER ROW
       ========================================================= */

    function renderUserRow(user) {

        const roleClass =
            `user-role-${user.role}`;


        const statusClass =
            user.isActive
                ? "user-status-active"
                : "user-status-inactive";


        const statusText =
            user.isActive
                ? "Hoạt động"
                : "Đã khóa";


        const toggleText =
            user.isActive
                ? "Khóa"
                : "Mở khóa";


        const toggleClass =
            user.isActive
                ? ""
                : "activate";


        return `
            <tr>

                <td class="user-id">
                    #${escapeHtml(user.id)}
                </td>

                <td>
                    <div class="user-name">
                        ${escapeHtml(user.fullName)}
                    </div>
                </td>

                <td>
                    <div class="user-username">
                        ${escapeHtml(user.username)}
                    </div>
                </td>

                <td>
                    <span
                        class="user-role ${roleClass}"
                        title="${escapeHtml(
                            roleDescriptions[user.role]
                        )}"
                    >
                        ${escapeHtml(
                            roleNames[user.role]
                        )}
                    </span>
                </td>

                <td>
                    ${escapeHtml(user.phone)}
                </td>

                <td>
                    <span
                        class="user-status ${statusClass}"
                    >
                        ${statusText}
                    </span>
                </td>

                <td>

                    <div class="users-actions">

                        <button
                            type="button"
                            class="user-action-button user-action-edit"
                            data-action="edit"
                            data-id="${user.id}"
                        >
                            Sửa
                        </button>

                        <button
                            type="button"
                            class="user-action-button user-action-toggle ${toggleClass}"
                            data-action="toggle"
                            data-id="${user.id}"
                        >
                            ${toggleText}
                        </button>

                    </div>

                </td>

            </tr>
        `;
    }


    /* =========================================================
       OPEN USER MODAL
       ========================================================= */

    function openUserModal(userId = null) {

        const modal =
            getElement(
                "user-modal-overlay"
            );

        const title =
            getElement(
                "user-modal-title"
            );

        const fullName =
            getElement(
                "user-full-name"
            );

        const username =
            getElement(
                "user-username"
            );

        const password =
            getElement(
                "user-password"
            );

        const phone =
            getElement(
                "user-phone"
            );

        const email =
            getElement(
                "user-email"
            );

        const role =
            getElement(
                "user-role"
            );

        const status =
            getElement(
                "user-status"
            );


        if (!modal) {

            console.error(
                "Không tìm thấy #user-modal-overlay"
            );

            return;
        }


        editingUserId =
            userId;


        /* =====================================================
           ADD
           ===================================================== */

        if (userId === null) {

            if (title) {
                title.textContent =
                    "Thêm tài khoản";
            }

            if (fullName) {
                fullName.value = "";
            }

            if (username) {
                username.value = "";
            }

            if (password) {

                password.value = "";

                password.required = true;
            }

            if (phone) {
                phone.value = "";
            }

            if (email) {
                email.value = "";
            }

            if (role) {
                role.value = "customer";
            }

            if (status) {
                status.value = "active";
            }


            modal.classList.add(
                "active"
            );


            focusUserFullName(
                fullName
            );

            return;
        }


        /* =====================================================
           EDIT
           ===================================================== */

        const user =
            users.find(
                item =>
                    Number(item.id) ===
                    Number(userId)
            );


        if (!user) {

            alert(
                "Không tìm thấy tài khoản."
            );

            return;
        }


        if (title) {

            title.textContent =
                "Chỉnh sửa tài khoản";
        }


        if (fullName) {

            fullName.value =
                user.fullName || "";
        }


        if (username) {

            username.value =
                user.username || "";
        }


        if (password) {

            password.value = "";

            password.required = false;

            /*
             * Mật khẩu không được load ngược
             * lên form.
             */
        }


        if (phone) {

            phone.value =
                user.phone || "";
        }


        if (email) {

            email.value =
                user.email || "";
        }


        if (role) {

            role.value =
                user.role || "customer";
        }


        if (status) {

            status.value =
                user.isActive
                    ? "active"
                    : "inactive";
        }


        modal.classList.add(
            "active"
        );


        focusUserFullName(
            fullName
        );
    }


    function focusUserFullName(input) {

        setTimeout(
            function () {

                if (input) {
                    input.focus();
                }

            },
            50
        );
    }


    /* =========================================================
       CLOSE MODAL
       ========================================================= */

    function closeUserModal() {

        const modal =
            getElement(
                "user-modal-overlay"
            );


        if (modal) {

            modal.classList.remove(
                "active"
            );
        }


        editingUserId =
            null;
    }


    /* =========================================================
       VALIDATE FORM
       ========================================================= */

    function validateUserForm(data) {

        if (!data.fullName) {

            return {
                valid: false,
                message:
                    "Vui lòng nhập họ tên.",
                field:
                    "user-full-name"
            };
        }


        if (!data.username) {

            return {
                valid: false,
                message:
                    "Vui lòng nhập tên tài khoản.",
                field:
                    "user-username"
            };
        }


        if (
             !["admin", "owner", "staff", "customer"]
                .includes(data.role)
        ) {

            return {
                valid: false,
                message:
                    "Vai trò tài khoản không hợp lệ.",
                field:
                    "user-role"
            };
        }


        if (
            !["active", "inactive"]
                .includes(data.status)
        ) {

            return {
                valid: false,
                message:
                    "Trạng thái tài khoản không hợp lệ.",
                field:
                    "user-status"
            };
        }


        return {
            valid: true
        };
    }


    /* =========================================================
       CHECK DUPLICATE USERNAME
       ========================================================= */

    function isDuplicateUsername(
        username,
        editingId
    ) {

        return users.some(user => {

            return (
                String(user.username)
                    .toLowerCase() ===
                String(username)
                    .toLowerCase() &&

                Number(user.id) !==
                Number(editingId)
            );
        });
    }


    /* =========================================================
       SAVE USER
       ========================================================= */

    async function saveUser(event) {

        if (event) {
            event.preventDefault();
        }


        const fullNameInput =
            getElement(
                "user-full-name"
            );

        const usernameInput =
            getElement(
                "user-username"
            );

        const passwordInput =
            getElement(
                "user-password"
            );

        const phoneInput =
            getElement(
                "user-phone"
            );

        const emailInput =
            getElement(
                "user-email"
            );

        const roleInput =
            getElement(
                "user-role"
            );

        const statusInput =
            getElement(
                "user-status"
            );


        if (
            !fullNameInput ||
            !usernameInput ||
            !passwordInput ||
            !phoneInput ||
            !emailInput ||
            !roleInput ||
            !statusInput
        ) {

            alert(
                "Không tìm thấy đầy đủ các trường trong form."
            );

            return;
        }


        const data = {

            fullName:
                fullNameInput.value.trim(),

            username:
                usernameInput.value.trim(),

            password:
                passwordInput.value,

            phone:
                phoneInput.value.trim(),

            email:
                emailInput.value.trim(),

            role:
                roleInput.value,

            status:
                statusInput.value
        };


        /* =====================================================
           VALIDATE
           ===================================================== */

        const validation =
            validateUserForm(data);


        if (!validation.valid) {

            alert(
                validation.message
            );


            const field =
                getElement(
                    validation.field
                );


            if (field) {
                field.focus();
            }


            return;
        }


        /* =====================================================
           DUPLICATE USERNAME
           ===================================================== */

        if (
            isDuplicateUsername(
                data.username,
                editingUserId
            )
        ) {

            alert(
                "Tên tài khoản đã tồn tại."
            );

            usernameInput.focus();

            return;
        }


        /* =====================================================
           ADD USER
           ===================================================== */

        if (editingUserId === null) {

            if (!data.password) {

                alert(
                    "Vui lòng nhập mật khẩu."
                );

                passwordInput.focus();

                return;
            }


            try {

                await createUser({

                    fullName:
                        data.fullName,

                    username:
                        data.username,

                    password:
                        data.password,

                    phone:
                        data.phone,

                    email:
                        data.email,

                    role:
                        data.role,

                    isActive:
                        data.status === "active"
                });


                alert(
                    "Thêm tài khoản thành công."
                );


                closeUserModal();

                renderUsers();

            } catch (error) {

                console.error(error);

                alert(
                    error.message ||
                    "Không thể thêm tài khoản."
                );
            }


            return;
        }


        /* =====================================================
           UPDATE USER
           ===================================================== */

        const existingUser =
            users.find(
                user =>
                    Number(user.id) ===
                    Number(editingUserId)
            );


        if (!existingUser) {

            alert(
                "Không tìm thấy tài khoản."
            );

            return;
        }


        try {

            await updateUser(
                editingUserId,
                {

                    fullName:
                        data.fullName,

                    username:
                        data.username,

                    phone:
                        data.phone,

                    email:
                        data.email,

                    role:
                        data.role,

                    isActive:
                        data.status === "active",

                    ...(data.password
                        ? { password: data.password }
                        : {})
                }
            );


            alert(
                "Cập nhật tài khoản thành công."
            );


            closeUserModal();

            renderUsers();

        } catch (error) {

            console.error(error);

            alert(
                error.message ||
                "Không thể cập nhật tài khoản."
            );
        }
    }


    /* =========================================================
       TOGGLE USER STATUS
       ========================================================= */

    async function toggleUserStatus(userId) {

        const user =
            users.find(
                item =>
                    Number(item.id) ===
                    Number(userId)
            );


        if (!user) {

            alert(
                "Không tìm thấy tài khoản."
            );

            return;
        }


        const action =
            user.isActive
                ? "khóa"
                : "mở khóa";


        const confirmed =
            confirm(
                `Bạn có chắc muốn ${action} tài khoản "${user.username}" không?`
            );


        if (!confirmed) {
            return;
        }


        try {

            const updatedUser =
                await changeUserStatus(
                    userId
                );


            alert(
                updatedUser.isActive
                    ? "Đã mở khóa tài khoản."
                    : "Đã khóa tài khoản."
            );


            renderUsers();

        } catch (error) {

            console.error(error);

            alert(
                error.message ||
                "Không thể thay đổi trạng thái tài khoản."
            );
        }
    }


    /* =========================================================
       TABLE ACTION
       ========================================================= */

    function handleTableAction(event) {

        if (!event) {
            return;
        }


        const button =
            event.target.closest(
                "[data-action]"
            );


        if (!button) {
            return;
        }


        const userId =
            Number(
                button.dataset.id
            );


        const action =
            button.dataset.action;


        if (action === "edit") {

            openUserModal(
                userId
            );

            return;
        }


        if (action === "toggle") {

            toggleUserStatus(
                userId
            );

            return;
        }
    }


    /* =========================================================
       SHOW USERS PAGE
       ========================================================= */

    function showUsersPage() {

        const dashboard =
            document.querySelector(
                ".dashboard-content"
            );


        const productsPage =
            getElement(
                "products-page"
            );

        const categoriesPage =
            getElement(
                "categories-page"
            );

        const customersPage =
            getElement(
                "customers-page"
            );

        const invoicePage =
            getElement(
                "sales-invoice-page"
            );

        const purchasePage =
            getElement(
                "purchase-page"
            );

        const inventoryPage =
            getElement(
                "inventory-page"
            );

        const historyPage =
            getElement(
                "history-page"
            );

        const statisticsPage =
            getElement(
                "statistics-page"
            );

        const reportsPage =
            getElement(
                "reports-page"
            );

        const usersPage =
            getElement(
                "users-page"
            );


        if (!usersPage) {

            console.warn(
                "Không tìm thấy #users-page"
            );

            return;
        }


        /* =====================================================
           HIDE DASHBOARD
           ===================================================== */

        if (dashboard) {

            dashboard.style.display =
                "none";
        }


        /* =====================================================
           HIDE OTHER PAGES
           ===================================================== */

        const pages = [

            productsPage,
            categoriesPage,
            customersPage,
            invoicePage,
            purchasePage,
            inventoryPage,
            historyPage,
            statisticsPage,
            reportsPage
        ];


        pages.forEach(
            function (page) {

                if (page) {

                    page.classList.remove(
                        "active"
                    );
                }
            }
        );


        /* =====================================================
           SHOW USERS
           ===================================================== */

        usersPage.classList.add(
            "active"
        );


        /* =====================================================
           TOPBAR
           ===================================================== */

        const title =
            document.querySelector(
                ".topbar h1"
            );


        const description =
            document.querySelector(
                ".topbar p"
            );


        if (title) {

            title.textContent =
                "Quản lý người dùng";
        }


        if (description) {

            description.textContent =
                "Quản lý tài khoản và người dùng trong hệ thống";
        }


        /* =====================================================
           RENDER
           ===================================================== */

        renderUsers();
    }


    /* =========================================================
       SETUP EVENTS
       ========================================================= */

    function setupUsersEvents() {

        const search =
            getElement(
                "users-search"
            );


        const roleFilter =
            getElement(
                "users-role-filter"
            );


        const statusFilter =
            getElement(
                "users-status-filter"
            );


        const addButton =
            getElement(
                "users-add-button"
            );


        const tbody =
            getElement(
                "users-table-body"
            );


        const form =
            getElement(
                "user-form"
            );


        const closeButton =
            getElement(
                "user-modal-close"
            );


        const cancelButton =
            getElement(
                "user-modal-cancel"
            );


        const modal =
            getElement(
                "user-modal-overlay"
            );


        /* =====================================================
           SEARCH
           ===================================================== */

        if (search) {

            search.oninput =
                renderUsers;
        }


        /* =====================================================
           ROLE FILTER
           ===================================================== */

        if (roleFilter) {

            roleFilter.onchange =
                renderUsers;
        }


        /* =====================================================
           STATUS FILTER
           ===================================================== */

        if (statusFilter) {

            statusFilter.onchange =
                renderUsers;
        }


        /* =====================================================
           ADD
           ===================================================== */

        if (addButton) {

            addButton.onclick =
                function (event) {

                    if (event) {
                        event.preventDefault();
                    }


                    openUserModal();
                };

        } else {

            console.warn(
                "Không tìm thấy #users-add-button"
            );
        }


        /* =====================================================
           TABLE
           ===================================================== */

        if (tbody) {

            tbody.onclick =
                handleTableAction;
        }


        /* =====================================================
           FORM
           ===================================================== */

        if (form) {

            form.onsubmit =
                saveUser;
        }


        /* =====================================================
           CLOSE
           ===================================================== */

        if (closeButton) {

            closeButton.onclick =
                function (event) {

                    if (event) {
                        event.preventDefault();
                    }


                    closeUserModal();
                };
        }


        /* =====================================================
           CANCEL
           ===================================================== */

        if (cancelButton) {

            cancelButton.onclick =
                function (event) {

                    if (event) {
                        event.preventDefault();
                    }


                    closeUserModal();
                };
        }


        /* =====================================================
           CLICK OUTSIDE
           ===================================================== */

        if (modal) {

            modal.onclick =
                function (event) {

                    if (
                        event.target ===
                        modal
                    ) {

                        closeUserModal();
                    }
                };
        }


        /* =====================================================
           ESC KEY
           ===================================================== */

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape"
                ) {

                    const modal =
                        getElement(
                            "user-modal-overlay"
                        );


                    if (
                        modal &&
                        modal.classList.contains(
                            "active"
                        )
                    ) {

                        closeUserModal();
                    }
                }
            }
        );
    }


    /* =========================================================
       CURRENT USER
       =========================================================

       Đây là phần để sau này nối LOGIN.

       Ví dụ:

       staff01 đăng nhập
       ↓
       currentUser.role = "staff"
       ↓
       Permission JS lấy role = staff
       ↓
       lấy quyền staff

       Hiện tại chỉ là mock.
       ========================================================= */

    function getCurrentUser() {

        try {

            const saved =
                localStorage.getItem(
                    "sales_management_current_user"
                );


            if (!saved) {
                return null;
            }


            return JSON.parse(saved);

        } catch (error) {

            console.error(
                "Không thể đọc current user:",
                error
            );

            return null;
        }
    }


    function setCurrentUser(user) {

        if (!user) {

            localStorage.removeItem(
                "sales_management_current_user"
            );

            return;
        }


        localStorage.setItem(
            "sales_management_current_user",
            JSON.stringify({
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                isActive: user.isActive
            })
        );
    }


    /* =========================================================
       LOGIN MOCK
       =========================================================

       Dùng để test frontend.

       Sau này bỏ function này và thay bằng API login.
       ========================================================= */

    function loginMock(
        username,
        password
    ) {

        /*
         * Hiện tại password chỉ dùng để mô phỏng.
         * Không lưu password vào localStorage.
         */

        const user =
            users.find(
                item =>
                    item.username
                        .toLowerCase() ===
                    String(username)
                        .trim()
                        .toLowerCase()
            );


        if (!user) {

            return {
                success: false,
                message:
                    "Tên tài khoản không tồn tại."
            };
        }


        if (!user.isActive) {

            return {
                success: false,
                message:
                    "Tài khoản đã bị khóa."
            };
        }


        if (!password) {

            return {
                success: false,
                message:
                    "Vui lòng nhập mật khẩu."
            };
        }


        /*
         * Login thành công.
         *
         * ROLE ĐƯỢC LẤY TRỰC TIẾP
         * TỪ TÀI KHOẢN.
         */

        setCurrentUser(user);


        return {
            success: true,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                isActive: user.isActive
            }
        };
    }


    function logoutMock() {

        localStorage.removeItem(
            "sales_management_current_user"
        );
    }


    /* =========================================================
       ROLE CHECK
       ========================================================= */

    function getUserRole(user) {

    if (!user) {
        return null;
    }

    return (
        user.role === "admin" ||
        user.role === "owner" ||
        user.role === "staff" ||
        user.role === "customer"
    )
        ? user.role
        : null;
}


    function getCurrentUserRole() {

        const currentUser =
            getCurrentUser();


        return getUserRole(
            currentUser
        );
    }


    /* =========================================================
       FIND USER
       ========================================================= */

    function findUserByUsername(
        username
    ) {

        return users.find(
            user =>
                user.username
                    .toLowerCase() ===
                String(username)
                    .trim()
                    .toLowerCase()
        );
    }


    function findUserById(id) {

        return users.find(
            user =>
                Number(user.id) ===
                Number(id)
        );
    }


    /* =========================================================
       TẢI LẠI DANH SÁCH
       ========================================================= */

    async function resetUsersToDefault() {

        const confirmed =
            confirm(
                "Bạn có muốn tải lại danh sách tài khoản từ database không?"
            );


        if (!confirmed) {
            return;
        }


        await getUsers();

        renderUsers();


        alert(
            "Đã tải lại danh sách tài khoản từ database."
        );
    }


    /* =========================================================
       EXPOSE WINDOW
       ========================================================= */

    window.showUsersPage =
        showUsersPage;

    window.openUserModal =
        openUserModal;

    window.closeUserModal =
        closeUserModal;

    window.saveUser =
        saveUser;

    window.toggleUserStatus =
        toggleUserStatus;

    window.renderUsers =
        renderUsers;

    window.setupUsersEvents =
        setupUsersEvents;

    window.getUsers =
        getUsers;

    window.findUserById =
        findUserById;

    window.findUserByUsername =
        findUserByUsername;

    window.getCurrentUser =
        getCurrentUser;

    window.setCurrentUser =
        setCurrentUser;

    window.getCurrentUserRole =
        getCurrentUserRole;

    window.loginMock =
        loginMock;

    window.logoutMock =
        logoutMock;

    window.resetUsersToDefault =
        resetUsersToDefault;


    /* =========================================================
       INITIALIZE
       ========================================================= */

    async function initUsers() {

        setupUsersEvents();

        if (window.getAuthAccessToken?.() || localStorage.getItem("sales_management_access_token")) {
            try {
                await getUsers();
            } catch (error) {
                console.error("Không thể tải danh sách tài khoản:", error);
                users = [];
            }
        } else {
            users = [];
        }

        renderUsers();
    }

    window.addEventListener("auth:login", initUsers);
    window.addEventListener("auth:logout", function () {
        users = [];
        renderUsers();
    });


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initUsers
        );

    } else {

        initUsers();
    }

})();
