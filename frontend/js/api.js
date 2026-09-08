const API_BASE_URL = "http://127.0.0.1:8000";


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


    const defaultOptions = {

        headers: {
            "Content-Type": "application/json"
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

            throw new Error(
                data.detail ||
                "Có lỗi xảy ra khi gọi API."
            );

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
        "/api/health"
    );

}