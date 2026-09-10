/* REST API used by the sales management screens. */
(function () {
    "use strict";

    async function request(path, method = "GET", body) {
        const options = { method, cache: "no-store" };
        if (body !== undefined) {
            options.body = JSON.stringify(body);
        }
        const result = await window.apiRequest(path, options);

        if (
            method !== "GET" &&
            /^\/api\/(categories|products|customers|inventory|invoices|purchases)(\/|$)/.test(path)
        ) {
            document.dispatchEvent(
                new CustomEvent("sales:data-changed", {
                    detail: { path, method }
                })
            );
        }

        return result;
    }

    window.salesApi = {
        account: {
            get: () => request("/api/auth/me"),
            update: data => request("/api/auth/me", "PUT", data),
            changePassword: data => request("/api/auth/me/password", "PUT", data),
            logout: () => request("/api/auth/logout", "POST")
        },
        ai: {
            productAdvice: need => request(
                "/api/ai/product-advice", "POST", { need }
            ),
            revenueAnalysis: period => request(
                "/api/ai/revenue-analysis", "POST", { period }
            ),
            salesQA: question => request(
                "/api/ai/sales-qa", "POST", { question }
            ),
            logs: feature => request(
                `/api/ai/logs${feature && feature !== "all" ? `?feature=${encodeURIComponent(feature)}` : ""}`
            )
        },
        categories: {
            list: () => request("/api/categories"),
            create: data => request("/api/categories", "POST", data),
            update: (id, data) => request(`/api/categories/${id}`, "PUT", data),
            remove: id => request(`/api/categories/${id}`, "DELETE")
        },
        products: {
            list: () => request("/api/products"),
            get: id => request(`/api/products/${id}`),
            create: data => request("/api/products", "POST", data),
            update: (id, data) => request(`/api/products/${id}`, "PUT", data),
            remove: id => request(`/api/products/${id}`, "DELETE")
        },
        customers: {
            list: () => request("/api/customers"),
            get: id => request(`/api/customers/${id}`),
            purchaseHistory: id => request(`/api/customers/${id}/purchase-history`),
            create: data => request("/api/customers", "POST", data),
            update: (id, data) => request(`/api/customers/${id}`, "PUT", data),
            remove: id => request(`/api/customers/${id}`, "DELETE")
        },
        users: {
            list: () => request("/api/auth/users"),
            create: data => request("/api/auth/users", "POST", data),
            update: (id, data) => request(`/api/auth/users/${id}`, "PUT", data),
            remove: id => request(`/api/auth/users/${id}`, "DELETE")
        },
        permissions: {
            list: () => request("/api/auth/permissions"),
            update: (role, data) =>
                request(`/api/auth/permissions/${role}`, "PUT", data)
        },
        inventory: {
            list: () => request("/api/inventory"),
            get: id => request(`/api/inventory/${id}`),
            create: data => request("/api/inventory", "POST", data),
            update: (id, data) => request(`/api/inventory/${id}`, "PUT", data),
            remove: id => request(`/api/inventory/${id}`, "DELETE")
        },
        invoices: {
            list: () => request("/api/invoices"),
            get: id => request(`/api/invoices/${id}`),
            create: data => request("/api/invoices", "POST", data),
            update: (id, data) => request(`/api/invoices/${id}`, "PUT", data),
            remove: id => request(`/api/invoices/${id}`, "DELETE")
        },
        purchases: {
            list: () => request("/api/purchases"),
            get: id => request(`/api/purchases/${id}`),
            create: data => request("/api/purchases", "POST", data),
            update: (id, data) => request(`/api/purchases/${id}`, "PUT", data),
            remove: id => request(`/api/purchases/${id}`, "DELETE")
        },
        history: {
            list: () => request("/api/history"),
            create: data => request("/api/history", "POST", data)
        }
    };
})();
