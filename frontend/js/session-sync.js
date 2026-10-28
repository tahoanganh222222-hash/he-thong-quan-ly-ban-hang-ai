/* Refresh access across browsers; same-origin tabs also notify each other immediately. */
(function () {
    "use strict";
    const INTERVAL = 2000;
    let timer;
    let pending;
    let retryDelay = INTERVAL;
    let previousAccess = null;
    let channel;
    try {
        if (typeof BroadcastChannel === "function") channel = new BroadcastChannel("sales-management-access");
    } catch (_) { /* Polling also works when the browser disables messaging. */ }

    const pagePermissions = {
        "products-page": ["product_manage"], "categories-page": ["product_manage"],
        "customers-page": ["customer_manage"], "sales-invoice-page": ["invoice_create", "invoice_search"],
        "purchase-page": ["purchase_track"], "inventory-page": ["inventory_view"],
        "history-page": ["history_view", "ai_log_view"], "ai-logs-page": ["ai_log_view"],
        "statistics-page": ["revenue_statistics"], "reports-page": ["report_export"],
        "users-page": ["user_manage"], "permissions-page": ["permission"],
        "ai-product-page": ["ai_product_advice"], "ai-revenue-page": ["revenue_statistics"],
        "ai-qa-page": ["sales_data_qa"]
    };

    function closeProtectedOverlays(includeAccount = false) {
        document.querySelectorAll('dialog[open]').forEach(dialog => {
            // Cancel pending confirmations rather than leaving an unresolved action.
            dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
            if (dialog.open) dialog.close();
        });
        document.querySelectorAll('[id$="-modal"], #user-modal-overlay').forEach(modal => {
            if (modal.id === "account-modal" && !includeAccount) return;
            modal.classList.remove("active", "open");
            modal.setAttribute("aria-hidden", "true");
        });
        document.body.classList.remove("product-detail-open", "category-detail-open", "customer-history-open",
            "invoice-search-detail-open", "statistics-detail-open");
        if (includeAccount) document.body.classList.remove("account-modal-open");
        document.body.style.removeProperty("overflow");
    }

    function reconcileAccess(previous, permissions) {
        const revoked = previous && Object.keys(previous).some(key => previous[key] && !permissions[key]);
        if (revoked) {
            closeProtectedOverlays();
            const restrictedPage = Object.entries(pagePermissions).some(([id, keys]) =>
                document.getElementById(id)?.classList.contains("active") && !keys.some(key => permissions[key])
            );
            if (restrictedPage) {
                Object.keys(pagePermissions).forEach(id => document.getElementById(id)?.classList.remove("active"));
                window.showDashboardPage?.();
                document.querySelectorAll(".menu-item").forEach(item =>
                    item.classList.toggle("active", item.dataset.page === "dashboard"));
            } else if (document.getElementById("sales-invoice-page")?.classList.contains("active")) {
                if (!permissions.invoice_create && permissions.invoice_search) window.showInvoiceListPage?.();
                else if (!permissions.invoice_search && permissions.invoice_create) window.showSalesInvoicePage?.();
            }
            window.appNotify?.("Quyền truy cập đã được cập nhật bởi quản trị viên.");
        }
        if (document.getElementById("history-page")?.classList.contains("active")) window.initHistoryManagement?.();
        window.refreshTopbarNotifications?.();
    }

    function applySnapshot(snapshot) {
        const user = snapshot.user;
        const stored = window.getCurrentUser?.();
        const previous = previousAccess || Object.fromEntries(Object.keys(snapshot.permissions).map(key =>
            [key, window.hasCurrentUserPermission?.(key) === true]));
        const normalized = {
            id: user.id, username: user.username, fullName: user.full_name,
            phone: user.phone || "", email: user.email || "", avatarData: stored?.avatarData || "",
            role: user.role, isActive: user.is_active
        };
        const profileChanged = JSON.stringify(stored) !== JSON.stringify(normalized);
        if (profileChanged) {
            (window.getAuthSessionStorage?.() || sessionStorage).setItem("sales_management_current_user", JSON.stringify(normalized));
            window.loadCurrentUser?.();
            window.updateAuthUI?.();
            window.dispatchEvent(new CustomEvent("auth:user-updated", { detail: normalized }));
        }
        const changed = window.applyLivePermissions?.(snapshot.permissions);
        if (changed || profileChanged) reconcileAccess(previous, snapshot.permissions);
        previousAccess = { ...snapshot.permissions };
    }

    function schedule() {
        window.clearTimeout(timer);
        if (window.getAuthAccessToken?.()) timer = window.setTimeout(refresh, retryDelay);
    }

    function refresh() {
        if (pending) return pending;
        window.clearTimeout(timer);
        const token = window.getAuthAccessToken?.();
        if (!token) return Promise.resolve();
        pending = window.apiRequest("/api/auth/session", { cache: "no-store" })
            .then(snapshot => {
                if (token !== window.getAuthAccessToken?.()) return;
                retryDelay = INTERVAL;
                applySnapshot(snapshot);
            })
            .catch(() => { retryDelay = Math.min(retryDelay * 2, 30000); })
            .finally(() => { pending = null; schedule(); });
        return pending;
    }

    window.addEventListener("auth:login", () => { previousAccess = null; retryDelay = INTERVAL; refresh(); });
    window.addEventListener("auth:logout", () => {
        window.clearTimeout(timer); previousAccess = null; closeProtectedOverlays(true);
    });
    window.addEventListener("access:changed", () => { channel?.postMessage("changed"); refresh(); });
    window.addEventListener("auth:permission-denied", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
    if (channel) channel.onmessage = () => refresh();
    window.addEventListener("storage", event => {
        if (event.key === "sales_management_access_token") {
            if (!window.getAuthAccessToken?.()) {
                window.clearAuthSession?.();
                window.logout?.();
            } else refresh();
        }
    });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh);
    else refresh();
})();
