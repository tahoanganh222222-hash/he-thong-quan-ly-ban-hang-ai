const API_BASE_URL = "http://127.0.0.1:8000";
let unauthorizedSessionHandled = false;

function handleUnauthorizedSession(endpoint) {
    if (endpoint === "/api/auth/login" || unauthorizedSessionHandled) return;
    unauthorizedSessionHandled = true;
    localStorage.removeItem("sales_management_access_token");
    localStorage.removeItem("sales_management_current_user");
    window.setTimeout(function () {
        if (typeof window.logout === "function") {
            window.logout();
        } else {
            document.getElementById("app")?.style.setProperty("display", "none");
            document.getElementById("login-page")?.style.removeProperty("display");
        }
        const message = document.getElementById("login-message");
        if (message) {
            message.textContent = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
            message.className = "auth-message auth-message-error";
        }
    }, 0);
}


/**
 * Gửi request tới Backend API.
 *
 * @param {string} endpoint
 * @param {object} options
 * @returns {Promise<object>}
 */
async function apiRequest(endpoint, options = {}) {

    const url =
        `${API_BASE_URL}${endpoint}`;


    const accessToken = localStorage.getItem(
        "sales_management_access_token"
    );

    const defaultOptions = {

        headers: {
            "Content-Type": "application/json",
            ...(accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : {})
        }

    };


    const requestOptions = {

        ...defaultOptions,

        ...options,

        headers: {

            ...defaultOptions.headers,

            ...(options.headers || {})

        }

    };


    try {

        const response =
            await fetch(
                url,
                requestOptions
            );


        const data =
            await response.json();


        if (!response.ok) {

            if (response.status === 401) {
                handleUnauthorizedSession(endpoint);
            }

            const requestError = new Error(
                data.detail ||
                "Có lỗi xảy ra khi gọi API."
            );

            requestError.status = response.status;
            requestError.authenticationExpired = response.status === 401;

            throw requestError;

        }


        return data;


    } catch (error) {

        console.error(
            "API Error:",
            error
        );

        throw error;

    }

}


/**
 * Kiểm tra trạng thái Backend.
 */
async function checkBackend() {

    return await apiRequest("/");

}


/**
 * Kiểm tra trạng thái Backend + SQL Server.
 */
async function checkSystemHealth() {

    return await apiRequest(
        "/health"
    );

}
