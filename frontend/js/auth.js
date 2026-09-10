/* =========================================================
   AUTHENTICATION
   Login / Logout / Session
   Xác thực bằng FastAPI, JWT và SQL Server
   ========================================================= */

(function () {

    "use strict";


    /* =========================================================
       CONFIG
       ========================================================= */

    const USERS_STORAGE_KEY =
        "sales_management_users";

    const CURRENT_USER_STORAGE_KEY =
        "sales_management_current_user";


    /* =========================================================
       STATE
       ========================================================= */

    let currentUser = null;


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
       ROLE NAMES
       ========================================================= */

    const roleNames = {
    admin: "Admin",
    owner: "Owner",
    staff: "Staff",
    customer: "Customer"
    };


    /* =========================================================
       LOAD USERS
       ========================================================= */

    function loadUsers() {

        try {

            const data =
                localStorage.getItem(
                    USERS_STORAGE_KEY
                );


            if (!data) {

                return [];
            }


            const users =
                JSON.parse(data);


            if (!Array.isArray(users)) {

                return [];
            }


            return users;

        } catch (error) {

            console.error(
                "Không thể đọc danh sách tài khoản:",
                error
            );

            return [];
        }
    }


    /* =========================================================
       FIND USER
       ========================================================= */

    function findUser(username) {

        const users =
            loadUsers();


        const normalizedUsername =
            String(username || "")
                .trim()
                .toLowerCase();


        return users.find(
            user => {

                return String(
                    user.username || ""
                )
                    .trim()
                    .toLowerCase()
                    === normalizedUsername;
            }
        );
    }


    /* =========================================================
       SAVE CURRENT USER
       ========================================================= */

    function saveCurrentUser(user) {

        if (!user) {

            localStorage.removeItem(
                CURRENT_USER_STORAGE_KEY
            );

            currentUser = null;

            return;
        }


        /*
         * TUYỆT ĐỐI KHÔNG LƯU PASSWORD.
         */

        const sessionUser = {

            id:
                user.id,

            username:
                user.username,

            fullName:
                user.fullName,

            phone:
                user.phone || "",

            email:
                user.email || "",

            avatarData:
                user.avatarData || "",

            role:
                user.role,

            isActive:
                user.isActive
        };


        currentUser =
            sessionUser;


        localStorage.setItem(
            CURRENT_USER_STORAGE_KEY,
            JSON.stringify(
                sessionUser
            )
        );
    }


    /* =========================================================
       LOAD CURRENT USER
       ========================================================= */

    function isAccessTokenExpired(token) {
        try {
            const encodedPayload = token.split(".")[1];
            if (!encodedPayload) return true;
            const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
            const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
            const payload = JSON.parse(atob(padded));
            return !payload.exp || Number(payload.exp) <= Math.floor(Date.now() / 1000) + 5;
        } catch (error) {
            return true;
        }
    }


    function loadCurrentUser() {

        try {

            const accessToken = localStorage.getItem(
                "sales_management_access_token"
            );

            if (!accessToken || isAccessTokenExpired(accessToken)) {
                currentUser = null;
                localStorage.removeItem("sales_management_access_token");
                localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
                return null;
            }

            const data =
                localStorage.getItem(
                    CURRENT_USER_STORAGE_KEY
                );


            if (!data) {

                currentUser = null;

                return null;
            }


            const user =
                JSON.parse(data);

            if (
                accessToken &&
                user &&
                ["admin", "owner", "staff", "customer"].includes(user.role) &&
                user.isActive !== false
            ) {
                currentUser = user;
                return currentUser;
            }


            if (!user) {

                currentUser = null;

                return null;
            }


            /*
             * Kiểm tra role.
             */

            if (
                ![
                "admin",
                "owner",
                "staff",
                "customer"
                ].includes(user.role)
            ){
                currentUser = null;
                localStorage.removeItem(
                CURRENT_USER_STORAGE_KEY
            );
            return null;
                }


            /*
             * Kiểm tra tài khoản trong users.
             *
             * Điều này rất quan trọng:
             *
             * Nếu tài khoản đã bị khóa
             * trong Users Management,
             * session cũ cũng không còn hợp lệ.
             */

            const latestUser =
                findUserById(
                    user.id
                );


            if (
                !latestUser ||
                latestUser.isActive === false
            ) {

                currentUser = null;

                localStorage.removeItem(
                    CURRENT_USER_STORAGE_KEY
                );

                return null;
            }


            /*
             * Lấy role mới nhất từ users.
             *
             * Ví dụ:
             *
             * staff01
             * staff → owner
             *
             * thì session cũng phải nhận owner.
             */

            currentUser = {

                id:
                    latestUser.id,

                username:
                    latestUser.username,

                fullName:
                    latestUser.fullName,

                phone:
                    latestUser.phone || "",

                email:
                    latestUser.email || "",

                avatarData:
                    latestUser.avatarData || "",

                role:
                    latestUser.role,

                isActive:
                    latestUser.isActive
            };


            /*
             * Cập nhật lại session.
             */

            localStorage.setItem(
                CURRENT_USER_STORAGE_KEY,
                JSON.stringify(
                    currentUser
                )
            );


            return currentUser;

        } catch (error) {

            console.error(
                "Không thể đọc phiên đăng nhập:",
                error
            );

            currentUser = null;

            localStorage.removeItem(
                CURRENT_USER_STORAGE_KEY
            );

            return null;
        }
    }


    /* =========================================================
       FIND USER BY ID
       ========================================================= */

    function findUserById(id) {

        const users =
            loadUsers();


        return users.find(
            user =>
                Number(user.id) ===
                Number(id)
        );
    }


    /* =========================================================
       LOGIN
       =========================================================

       HIỆN TẠI CHỈ LÀ FRONTEND MOCK.

       Không lưu password.

       Sau này:
       POST /api/auth/login
       ========================================================= */

    function loginLocal(
        username,
        password
    ) {

        username =
            String(username || "")
                .trim();

        password =
            String(password || "");


        /* =====================================================
           VALIDATE
           ===================================================== */

        if (!username) {

            return {

                success: false,

                message:
                    "Vui lòng nhập tên tài khoản.",

                field:
                    "login-username"
            };
        }


        if (!password) {

            return {

                success: false,

                message:
                    "Vui lòng nhập mật khẩu.",

                field:
                    "login-password"
            };
        }


        /* =====================================================
           FIND ACCOUNT
           ===================================================== */

        const user =
            findUser(username);


        if (!user) {

            return {

                success: false,

                message:
                    "Tên tài khoản hoặc mật khẩu không đúng."
            };
        }


        /* =====================================================
           CHECK STATUS
           ===================================================== */

        if (
            user.isActive === false
        ) {

            return {

                success: false,

                message:
                    "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên."
            };
        }


        /* =====================================================
           PASSWORD MOCK
           =====================================================

           Chưa có password trong dữ liệu frontend.

           Vì vậy giai đoạn này chỉ mô phỏng đăng nhập.

           Khi làm backend, password sẽ được kiểm tra
           tại FastAPI.
           ===================================================== */


        /*
         * LOGIN SUCCESS
         */

        saveCurrentUser(user);


        return {

            success: true,

            user:
                currentUser,

            message:
                "Đăng nhập thành công."
        };
    }


    /* =========================================================
       LOGIN FORM
       ========================================================= */

    async function loginWithAPI(username, password) {

        username = String(username || "").trim();
        password = String(password || "");

        if (!username) {
            return {
                success: false,
                message: "Vui lòng nhập tên tài khoản.",
                field: "login-username"
            };
        }

        if (!password) {
            return {
                success: false,
                message: "Vui lòng nhập mật khẩu.",
                field: "login-password"
            };
        }

        try {
            const response = await apiRequest("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ username, password })
            });
            const user = {
                id: response.user.id,
                username: response.user.username,
                fullName: response.user.full_name,
                phone: response.user.phone || "",
                email: response.user.email || "",
                avatarData: response.user.avatar_data || "",
                role: response.user.role,
                isActive: response.user.is_active
            };
            localStorage.setItem(
                "sales_management_access_token",
                response.access_token
            );
            saveCurrentUser(user);
            return {
                success: true,
                user,
                message: response.message
            };
        } catch (error) {
            return {
                success: false,
                message: error.message || "Tên tài khoản hoặc mật khẩu không đúng."
            };
        }
    }

    async function handleLoginSubmit(event) {

        if (event) {

            event.preventDefault();
        }


        const usernameInput =
            getElement(
                "login-username"
            );


        const passwordInput =
            getElement(
                "login-password"
            );


        const message =
            getElement(
                "login-message"
            );


        if (
            !usernameInput ||
            !passwordInput
        ) {

            console.error(
                "Không tìm thấy form Login."
            );

            return;
        }


        const username =
            usernameInput.value.trim();


        const password =
            passwordInput.value;


        const result =
            await loginWithAPI(
                username,
                password
            );


        /* =====================================================
           LOGIN FAILED
           ===================================================== */

        if (!result.success) {

            if (message) {

                message.textContent =
                    result.message;

                message.className =
                    "auth-message auth-message-error";
            }


            if (result.field) {

                const field =
                    getElement(
                        result.field
                    );


                if (field) {

                    field.focus();
                }
            }


            return;
        }


        /* =====================================================
           LOGIN SUCCESS
           ===================================================== */

        if (message) {

            message.textContent =
                "Đăng nhập thành công.";

            message.className =
                "auth-message auth-message-success";
        }


        /*
         * Xóa password khỏi form.
         */

        passwordInput.value = "";


        /*
         * Cập nhật giao diện.
         */

        updateAuthUI();


        /*
         * Cho phép hệ thống permission
         * cập nhật theo currentUser.
         */

        if (
            typeof window.syncCurrentPermissionUser === "function"
        ){
            window.syncCurrentPermissionUser();
        }

        if (
            typeof window.applyPermissionVisibility === "function"
        ) {
            window.applyPermissionVisibility();
        }


        /*
         * Nếu project có dashboard,
         * chuyển vào hệ thống.
         */

        showApplication();

        if (
            typeof window.showDashboardPage === "function"
        ) {
            window.showDashboardPage();
        }


        /*
         * Cho các module khác biết login đã thành công.
         */

        window.dispatchEvent(
            new CustomEvent(
                "auth:login",
                {
                    detail: currentUser
                }
            )
        );

        /*
         * Chờ các vùng dữ liệu chính khởi tạo xong trong lần đăng
         * nhập đầu tiên. Nhờ đó Dashboard và danh sách hóa đơn
         * không cần người dùng tải lại trang mới hiển thị.
         */
        const initializationTasks = [];

        if (
            typeof window.initDashboardFromAPI ===
            "function"
        ) {
            initializationTasks.push(
                window.initDashboardFromAPI()
            );
        }

        if (
            typeof window.initInvoiceSearchFeature ===
            "function"
        ) {
            initializationTasks.push(
                window.initInvoiceSearchFeature()
            );
        }

        await Promise.allSettled(
            initializationTasks
        );
    }


    /* =========================================================
       LOGOUT
       ========================================================= */

    async function logout() {

        const hadAccessToken = Boolean(
            localStorage.getItem("sales_management_access_token")
        );

        if (hadAccessToken) {
            try {
                if (window.salesApi?.account?.logout) {
                    await window.salesApi.account.logout();
                } else {
                    await apiRequest("/api/auth/logout", { method: "POST" });
                }
            } catch (error) {
                // Vẫn kết thúc phiên cục bộ nếu backend tạm thời không phản hồi.
                console.error("Không thể ghi nhật ký đăng xuất:", error);
            }
        }

        currentUser = null;


        localStorage.removeItem(
            CURRENT_USER_STORAGE_KEY
        );

        localStorage.removeItem(
            "sales_management_access_token"
        );


        /*
         * Thông báo cho các module khác.
         */

        window.dispatchEvent(
            new CustomEvent(
                "auth:logout"
            )
        );


        /*
         * Cập nhật giao diện.
         */

        updateAuthUI();


        /*
         * Hiện màn hình login.
         */

        showLoginPage();
    }


    /* =========================================================
       IS LOGGED IN
       ========================================================= */

    function isLoggedIn() {

        return (
            currentUser !== null &&
            currentUser.isActive !== false
        );
    }


    /* =========================================================
       GET CURRENT USER
       ========================================================= */

    function getCurrentUser() {

        if (!currentUser) {

            loadCurrentUser();
        }


        return currentUser;
    }


    /* =========================================================
       GET CURRENT ROLE
       ========================================================= */

    function getCurrentRole() {

        const user =
            getCurrentUser();


        if (!user) {

            return null;
        }


        return user.role || null;
    }


    /* =========================================================
       CHECK ROLE
       ========================================================= */

    function hasRole(role) {

        const currentRole =
            getCurrentRole();


        return (
            currentRole === role
        );
    }


    /* =========================================================
       UPDATE AUTH UI
       ========================================================= */

    function updateAuthUI() {

        const user =
            getCurrentUser();


        /*
         * Username.
         */

        const usernameElements =
            document.querySelectorAll(
                "[data-current-username]"
            );


        usernameElements.forEach(
            element => {

                element.textContent =
                    user
                        ? user.username
                        : "";
            }
        );


        /*
         * Full name.
         */

        const fullNameElements =
            document.querySelectorAll(
                "[data-current-fullname]"
            );


        fullNameElements.forEach(
            element => {

                element.textContent =
                    user
                        ? user.fullName
                        : "";
            }
        );


        /*
         * Role.
         */

        const roleElements =
            document.querySelectorAll(
                "[data-current-role]"
            );


        roleElements.forEach(
            element => {

                element.textContent =
                    user
                        ? (
                            roleNames[user.role]
                            ||
                            user.role
                        )
                        : "";
            }
        );

        /*
         * Avatar và màu giao diện theo đúng tài khoản đang đăng nhập.
         */

        const avatar =
            getElement(
                "current-user-avatar"
            );

        if (avatar) {

            const avatarSource =
                user
                    ? (
                        user.role ||
                        user.username ||
                        user.fullName ||
                        "U"
                    )
                    : "U";

            if (user && user.avatarData) {
                avatar.innerHTML = "";
                const image = document.createElement("img");
                image.src = user.avatarData;
                image.alt = `Ảnh đại diện của ${user.fullName || user.username}`;
                avatar.appendChild(image);
            } else {
                avatar.textContent =
                    String(avatarSource)
                        .trim()
                        .charAt(0)
                        .toUpperCase() || "U";
            }
        }

        if (document.body) {

            if (user && user.role) {
                document.body.dataset.userRole = user.role;
            } else {
                delete document.body.dataset.userRole;
            }
        }


        /*
         * Login area.
         */

        const loginArea =
            getElement(
                "login-page"
            );


        if (loginArea) {

            loginArea.style.display =
                user
                    ? "none"
                    : "";
        }


        /*
         * Logout buttons.
         */

        const logoutButtons =
            document.querySelectorAll(
                "[data-auth-action='logout']"
            );


        logoutButtons.forEach(
            button => {

                button.style.display =
                    user
                        ? ""
                        : "none";
            }
        );
    }


    /* =========================================================
       SHOW LOGIN PAGE
       ========================================================= */

    function showLoginPage() {

        const loginPage =
            getElement(
                "login-page"
            );


        const app =
            getElement(
                "app"
            );


        if (loginPage) {

            loginPage.style.display =
                "";
        }


        if (app) {

            app.style.display =
                "none";
        }
    }


    /* =========================================================
       SHOW APPLICATION
       ========================================================= */

    function showApplication() {

        const loginPage =
            getElement(
                "login-page"
            );


        const app =
            getElement(
                "app"
            );


        if (loginPage) {

            loginPage.style.display =
                "none";
        }


        if (app) {

            app.style.display =
                "";
        }
    }


    /* =========================================================
       REQUIRE LOGIN
       ========================================================= */

    function requireLogin() {

        const user =
            getCurrentUser();


        if (
            !user ||
            user.isActive === false
        ) {

            showLoginPage();

            return false;
        }


        return true;
    }


    /* =========================================================
       AUTH GUARD
       ========================================================= */

    function authGuard() {

        const user =
            loadCurrentUser();


        if (!user) {

            showLoginPage();

            return false;
        }


        showApplication();

        updateAuthUI();

        return true;
    }


    /* =========================================================
       INIT LOGIN FORM
       ========================================================= */

    function setupLoginEvents() {

        const form =
            getElement(
                "login-form"
            );


        if (form) {

            form.onsubmit =
                handleLoginSubmit;
        }


        /*
         * Logout bằng:
         *
         * <button data-auth-action="logout">
         */

        document.addEventListener(
            "click",
            function (event) {

                const button =
                    event.target.closest(
                        "[data-auth-action='logout']"
                    );


                if (!button) {

                    return;
                }


                event.preventDefault();

                logout();
            }
        );
    }


    /* =========================================================
       EXPOSE WINDOW
       ========================================================= */

    window.loginLocal =
        loginWithAPI;


    window.logout =
        logout;


    window.getCurrentUser =
        getCurrentUser;


    window.getCurrentRole =
        getCurrentRole;


    window.isLoggedIn =
        isLoggedIn;


    window.hasRole =
        hasRole;


    window.requireLogin =
        requireLogin;


    window.authGuard =
        authGuard;


    window.loadCurrentUser =
        loadCurrentUser;


    window.findUserById =
        findUserById;


    window.updateAuthUI =
        updateAuthUI;


    window.showLoginPage =
        showLoginPage;


    window.showApplication =
        showApplication;


    /* =========================================================
       INITIALIZE
       ========================================================= */

    function initAuth() {

        loadCurrentUser();

        setupLoginEvents();

        updateAuthUI();

        /*
         * Nếu chưa đăng nhập thì hiện login.
         *
         * Nếu đã đăng nhập thì vào app.
         */

        if (isLoggedIn()) {

            showApplication();

        } else {

            showLoginPage();
        }
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initAuth
        );

    } else {

        initAuth();
    }

})();
