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
            /^\/api\/(products|customers|inventory|invoices|purchases)(\/|$)/.test(path)
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
