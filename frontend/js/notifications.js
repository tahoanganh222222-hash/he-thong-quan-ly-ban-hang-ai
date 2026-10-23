(function () {
    "use strict";

    const PREFERENCE_PREFIX = "sales_management_notifications_";
    const READ_PREFIX = "sales_management_notification_read_";
    const REFRESH_INTERVAL = 60000;
    const DEFAULT_PREFERENCE = {
        stock: true,
        invoice: true,
        security: true,
        sound: false
    };

    const STOCK_PERMISSIONS = [
        "inventory_view",
        "purchase_track",
        "report_export",
        "sales_data_qa",
        "revenue_statistics"
    ];
    const INVOICE_PERMISSIONS = [
        "invoice_search",
        "revenue_statistics",
        "top_products",
        "report_export",
        "sales_data_qa",
        "history_view"
    ];

    let notifications = [];
    let refreshPromise = null;
    let refreshTimer = 0;
    let pollingTimer = 0;
    let previousUnreadIds = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function currentUser() {
        return window.getCurrentUser?.() || null;
    }

    function isAuthenticated() {
        return Boolean(
            currentUser() &&
            (window.getAuthAccessToken?.() ||
                localStorage.getItem("sales_management_access_token") ||
                sessionStorage.getItem("sales_management_access_token"))
        );
    }

    function scopedKey(prefix) {
        const user = currentUser();
        return `${prefix}${user?.id || user?.username || "guest"}`;
    }

    function loadPreference() {
        try {
            return {
                ...DEFAULT_PREFERENCE,
                ...JSON.parse(localStorage.getItem(scopedKey(PREFERENCE_PREFIX)) || "{}")
            };
        } catch (_error) {
            return { ...DEFAULT_PREFERENCE };
        }
    }

    function loadReadIds() {
        try {
            const stored = JSON.parse(localStorage.getItem(scopedKey(READ_PREFIX)) || "[]");
            return new Set(Array.isArray(stored) ? stored : []);
        } catch (_error) {
            return new Set();
        }
    }

    function saveReadIds(readIds) {
        const ids = Array.from(readIds).slice(-400);
        localStorage.setItem(scopedKey(READ_PREFIX), JSON.stringify(ids));
    }

    function hasAnyPermission(permissionKeys) {
        if (typeof window.hasCurrentUserPermission !== "function") return true;
        return permissionKeys.some(key => window.hasCurrentUserPermission(key));
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeImageSource(value) {
        const source = String(value || "").trim();
        if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(source)) return source;
        if (/^(?:https?:\/\/|\.\.?\/|\/)[^\s]+$/i.test(source)) return source;
        return "";
    }

    function numberValue(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatMoney(value) {
        return `${numberValue(value).toLocaleString("vi-VN")} ₫`;
    }

    function parseDate(value) {
        const date = value ? new Date(value) : null;
        return date && !Number.isNaN(date.getTime()) ? date : null;
    }

    function formatRelativeTime(value) {
        const date = parseDate(value);
        if (!date) return "";
        const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
        if (seconds < 60) return "Vừa xong";
        if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
        return new Intl.DateTimeFormat("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }).format(date);
    }

    function stockIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"/>
                <path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v9"/>
                <path d="M8 5.2 16 10"/>
            </svg>`;
    }

    function invoiceIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/>
                <path d="M9 8h6M9 12h6M9 16h3"/>
            </svg>`;
    }

    function securityIcon() {
        return `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3 5 6v5c0 4.7 2.9 8.2 7 10 4.1-1.8 7-5.3 7-10V6l-7-3Z"/>
                <path d="m9 12 2 2 4-4"/>
            </svg>`;
    }

    function buildStockNotifications(items) {
        return (Array.isArray(items) ? items : [])
            .filter(item => item?.isActive !== false)
            .filter(item => numberValue(item.quantity) <= numberValue(item.minimum))
            .sort((left, right) => {
                const leftQuantity = numberValue(left.quantity);
                const rightQuantity = numberValue(right.quantity);
                if ((leftQuantity <= 0) !== (rightQuantity <= 0)) return leftQuantity <= 0 ? -1 : 1;
                return leftQuantity - rightQuantity;
            })
            .slice(0, 10)
            .map(item => {
                const quantity = numberValue(item.quantity);
                const minimum = numberValue(item.minimum);
                const unit = String(item.unit || "sản phẩm").trim();
                return {
                    id: `stock:${item.id || item.productId || item.code}:${quantity}:${minimum}`,
                    type: "stock",
                    title: item.name || "Sản phẩm tồn kho thấp",
                    message: quantity <= 0
                        ? `Đã hết hàng · Mức tối thiểu ${minimum} ${unit}`
                        : `Còn ${quantity.toLocaleString("vi-VN")} ${unit} · Tối thiểu ${minimum.toLocaleString("vi-VN")}`,
                    meta: item.code ? `Mã ${item.code}` : "Cảnh báo tồn kho",
                    timeLabel: quantity <= 0 ? "Hết hàng" : "Sắp hết",
                    sortValue: Number.MAX_SAFE_INTEGER - quantity,
                    image: safeImageSource(item.imageData),
                    icon: stockIcon(),
                    payload: item
                };
            });
    }

    function buildInvoiceNotifications(items) {
        return (Array.isArray(items) ? items : [])
            .slice()
            .sort((left, right) => {
                const leftDate = parseDate(left.createdAt || left.date)?.getTime() || 0;
                const rightDate = parseDate(right.createdAt || right.date)?.getTime() || 0;
                return rightDate - leftDate;
            })
            .slice(0, 5)
            .map(item => {
                const createdAt = item.createdAt || item.date;
                return {
                    id: `invoice:${item.id || item.invoiceCode || item.code}`,
                    type: "invoice",
                    title: `Hóa đơn ${item.invoiceCode || item.code || "mới"}`,
                    message: `${item.customerName || "Khách lẻ"} · ${formatMoney(item.finalAmount ?? item.totalAmount)}`,
                    meta: item.paymentMethod ? `Thanh toán: ${item.paymentMethod}` : "Giao dịch bán hàng",
                    timeLabel: formatRelativeTime(createdAt),
                    sortValue: parseDate(createdAt)?.getTime() || 0,
                    icon: invoiceIcon(),
                    payload: item
                };
            });
    }

    function buildSecurityNotifications(items) {
        const user = currentUser();
        const username = String(user?.username || "").toLowerCase();
        return (Array.isArray(items) ? items : [])
            .filter(item => ["login", "logout"].includes(String(item.actionType || "").toLowerCase()))
            .filter(item => !username || String(item.username || "").toLowerCase() === username)
            .slice(0, 4)
            .map(item => {
                const actionType = String(item.actionType || "").toLowerCase();
                const createdAt = item.createdAt;
                return {
                    id: `security:${item.id || `${actionType}:${createdAt || item.time}`}`,
                    type: "security",
                    title: actionType === "logout" ? "Tài khoản đã đăng xuất" : "Đăng nhập tài khoản",
                    message: item.detail || item.action || "Hoạt động bảo mật của tài khoản",
                    meta: item.time || "Lịch sử bảo mật",
                    timeLabel: formatRelativeTime(createdAt),
                    sortValue: parseDate(createdAt)?.getTime() || 0,
                    icon: securityIcon(),
                    payload: item
                };
            });
    }

    function enabledSourceCount(preference) {
        return [preference.stock, preference.invoice, preference.security].filter(Boolean).length;
    }

    async function loadNotificationSources(preference) {
        const sources = [];

        if (preference.stock && hasAnyPermission(STOCK_PERMISSIONS)) {
            sources.push({
                type: "stock",
                promise: window.salesApi.inventory.list()
            });
        }
        if (preference.invoice && hasAnyPermission(INVOICE_PERMISSIONS)) {
            sources.push({
                type: "invoice",
                promise: window.salesApi.invoices.list()
            });
        }
        if (preference.security && hasAnyPermission(["history_view"])) {
            sources.push({
                type: "security",
                promise: window.salesApi.history.list()
            });
        }

        const results = await Promise.allSettled(sources.map(source => source.promise));
        const loaded = [];
        let failed = 0;

        results.forEach((result, index) => {
            if (result.status !== "fulfilled") {
                failed += 1;
                console.warn(`Không thể tải thông báo ${sources[index].type}:`, result.reason?.message || result.reason);
                return;
            }
            if (sources[index].type === "stock") loaded.push(...buildStockNotifications(result.value));
            if (sources[index].type === "invoice") loaded.push(...buildInvoiceNotifications(result.value));
            if (sources[index].type === "security") loaded.push(...buildSecurityNotifications(result.value));
        });

        loaded.sort((left, right) => {
            const priority = { stock: 3, invoice: 2, security: 1 };
            const priorityDifference = (priority[right.type] || 0) - (priority[left.type] || 0);
            return priorityDifference || right.sortValue - left.sortValue;
        });

        return { items: loaded, failed, requested: sources.length };
    }

    function emptyMarkup(preference) {
        const disabled = enabledSourceCount(preference) === 0;
        return `
            <div class="topbar-notification-empty">
                <div>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/>
                        <path d="M10 21h4"/>
                    </svg>
                    <strong>${disabled ? "Thông báo đang được tắt" : "Không có cảnh báo mới"}</strong>
                    <span>${disabled
                        ? "Bạn có thể bật từng loại cảnh báo trong phần cài đặt thông báo."
                        : "Tồn kho, hóa đơn và hoạt động bảo mật hiện không có cập nhật cần hiển thị."}</span>
                </div>
            </div>`;
    }

    function errorMarkup() {
        return `
            <div class="topbar-notification-error">
                <div>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 9v4M12 17h.01"/><path d="M10.3 4.6 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z"/>
                    </svg>
                    <strong>Chưa thể tải thông báo</strong>
                    <span>Không kết nối được dữ liệu hệ thống. Hãy nhấn làm mới để thử lại.</span>
                </div>
            </div>`;
    }

    function itemMarkup(item, readIds) {
        const unread = !readIds.has(item.id);
        const image = item.image
            ? `<img src="${escapeHTML(item.image)}" alt="" loading="lazy">`
            : item.icon;
        return `
            <button
                type="button"
                class="topbar-notification-item${unread ? " is-unread" : ""}"
                data-notification-id="${escapeHTML(item.id)}"
                data-notification-type="${escapeHTML(item.type)}"
                role="listitem"
            >
                <span class="topbar-notification-item-icon">${image}</span>
                <span class="topbar-notification-item-content">
                    <strong class="topbar-notification-item-title">${escapeHTML(item.title)}</strong>
                    <span class="topbar-notification-item-message">${escapeHTML(item.message)}</span>
                    <span class="topbar-notification-item-meta">${escapeHTML(item.meta)}</span>
                </span>
                <span class="topbar-notification-item-side">
                    ${unread ? '<i class="topbar-notification-unread-dot" aria-label="Chưa xem"></i>' : ""}
                    <span>${escapeHTML(item.timeLabel)}</span>
                </span>
            </button>`;
    }

    function updateBadge(readIds, options = {}) {
        const badge = byId("topbar-notification-badge");
        const button = byId("topbar-notification-button");
        if (!badge || !button) return;

        const unreadCount = notifications.filter(item => !readIds.has(item.id)).length;
        badge.hidden = unreadCount === 0;
        badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        button.classList.toggle("has-unread", unreadCount > 0);
        button.setAttribute(
            "aria-label",
            unreadCount > 0 ? `Mở thông báo, ${unreadCount} thông báo chưa xem` : "Mở thông báo"
        );

        if (options.animate && unreadCount > 0) {
            button.classList.remove("has-unread");
            void button.offsetWidth;
            button.classList.add("has-unread");
        }
    }

    function renderNotifications(loadResult = {}) {
        const list = byId("topbar-notification-list");
        const summary = byId("topbar-notification-summary");
        const readAll = byId("topbar-notification-read-all");
        if (!list || !summary || !readAll) return;

        const preference = loadPreference();
        const readIds = loadReadIds();
        const unreadCount = notifications.filter(item => !readIds.has(item.id)).length;

        if (!notifications.length) {
            list.innerHTML = loadResult.failed && loadResult.failed === loadResult.requested
                ? errorMarkup()
                : emptyMarkup(preference);
        } else {
            list.innerHTML = notifications.map(item => itemMarkup(item, readIds)).join("");
        }

        if (notifications.length) {
            summary.textContent = unreadCount
                ? `${unreadCount} chưa xem · ${notifications.length} cập nhật từ dữ liệu hệ thống`
                : `${notifications.length} cập nhật · Bạn đã xem tất cả`;
        } else if (enabledSourceCount(preference) === 0) {
            summary.textContent = "Các loại thông báo đang được tắt trong tài khoản";
        } else {
            summary.textContent = loadResult.failed
                ? "Không thể tải dữ liệu thông báo lúc này"
                : "Không có cập nhật cần xử lý";
        }

        readAll.disabled = unreadCount === 0;
        updateBadge(readIds, { animate: loadResult.animate });
    }

    function playNotificationSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const context = new AudioContext();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(740, context.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.12);
            gain.gain.setValueAtTime(0.0001, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.2);
            oscillator.addEventListener("ended", () => context.close());
        } catch (_error) {
            // Trình duyệt có thể chặn âm thanh khi người dùng chưa tương tác.
        }
    }

    async function refreshNotifications(options = {}) {
        if (refreshPromise) return refreshPromise;

        if (!isAuthenticated() || !window.salesApi) {
            notifications = [];
            previousUnreadIds = null;
            renderNotifications();
            return null;
        }

        const refreshButton = byId("topbar-notification-refresh");
        refreshButton?.classList.add("is-loading");

        refreshPromise = (async () => {
            const preference = loadPreference();
            const result = await loadNotificationSources(preference);
            notifications = result.items;

            const readIds = loadReadIds();
            const unreadIds = new Set(notifications.filter(item => !readIds.has(item.id)).map(item => item.id));
            const hasNewUnread = previousUnreadIds !== null &&
                Array.from(unreadIds).some(id => !previousUnreadIds.has(id));

            renderNotifications({
                ...result,
                animate: hasNewUnread
            });

            if (hasNewUnread && preference.sound && options.silent !== true) {
                playNotificationSound();
            }
            previousUnreadIds = unreadIds;
            return notifications;
        })().catch(error => {
            console.warn("Không thể cập nhật trung tâm thông báo:", error?.message || error);
            notifications = [];
            renderNotifications({ failed: 1, requested: 1 });
            return [];
        }).finally(() => {
            refreshPromise = null;
            refreshButton?.classList.remove("is-loading");
        });

        return refreshPromise;
    }

    function scheduleRefresh(delay = 250) {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => refreshNotifications(), delay);
    }

    function setPanelOpen(open) {
        const panel = byId("topbar-notification-panel");
        const button = byId("topbar-notification-button");
        if (!panel || !button) return;
        panel.hidden = !open;
        button.setAttribute("aria-expanded", String(open));
        if (open) refreshNotifications({ silent: true });
    }

    function markAsRead(ids) {
        const readIds = loadReadIds();
        ids.forEach(id => readIds.add(id));
        saveReadIds(readIds);
        renderNotifications();
        previousUnreadIds = new Set(notifications.filter(item => !readIds.has(item.id)).map(item => item.id));
    }

    async function openNotificationTarget(item) {
        if (!item) return;
        setPanelOpen(false);

        if (item.type === "stock") {
            document.querySelector('.menu-item[data-page="inventory"]')?.click();
            return;
        }

        if (item.type === "invoice") {
            const invoiceMenu = document.querySelector('.menu-item[data-page="invoices"]');
            const canViewInvoice = hasAnyPermission(["invoice_search"]);
            if (!canViewInvoice) {
                const fallbackPage = hasAnyPermission(["revenue_statistics"])
                    ? "statistics"
                    : hasAnyPermission(["report_export"])
                        ? "reports"
                        : "history";
                document.querySelector(`.menu-item[data-page="${fallbackPage}"]`)?.click();
                return;
            }
            if (typeof window.showInvoiceListPage === "function") {
                document.querySelectorAll(".menu-item[data-page]").forEach(menu => {
                    menu.classList.toggle("active", menu === invoiceMenu);
                });
                window.showInvoiceListPage();
            } else {
                invoiceMenu?.click();
            }
            try {
                await window.refreshInvoiceSearchData?.();
                await window.viewInvoiceSearchDetail?.(item.payload.id);
            } catch (error) {
                console.warn("Không thể mở chi tiết hóa đơn từ thông báo:", error?.message || error);
            }
            return;
        }

        if (item.type === "security") {
            document.querySelector('.menu-item[data-page="history"]')?.click();
        }
    }

    async function openNotificationSettings() {
        setPanelOpen(false);
        await window.openAccountModal?.();
        document.querySelector('.account-tab[data-account-tab="notifications"]')?.click();
    }

    function setupEvents() {
        const button = byId("topbar-notification-button");
        const panel = byId("topbar-notification-panel");

        button?.addEventListener("click", event => {
            event.stopPropagation();
            setPanelOpen(panel?.hidden !== false);
        });

        panel?.addEventListener("click", event => event.stopPropagation());

        byId("topbar-notification-read-all")?.addEventListener("click", () => {
            markAsRead(notifications.map(item => item.id));
        });

        byId("topbar-notification-settings")?.addEventListener("click", openNotificationSettings);
        byId("topbar-notification-refresh")?.addEventListener("click", () => refreshNotifications());

        byId("topbar-notification-list")?.addEventListener("click", event => {
            const target = event.target.closest("[data-notification-id]");
            if (!target) return;
            const item = notifications.find(entry => entry.id === target.dataset.notificationId);
            if (!item) return;
            markAsRead([item.id]);
            openNotificationTarget(item);
        });

        document.addEventListener("click", () => setPanelOpen(false));
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") setPanelOpen(false);
        });

        window.addEventListener("account:notification-preferences", () => scheduleRefresh(0));
        document.addEventListener("sales:data-changed", () => scheduleRefresh(300));
        window.addEventListener("auth:login", () => {
            previousUnreadIds = null;
            scheduleRefresh(120);
        });
        window.addEventListener("auth:logout", () => {
            window.clearTimeout(refreshTimer);
            notifications = [];
            previousUnreadIds = null;
            setPanelOpen(false);
            renderNotifications();
        });
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden && isAuthenticated()) scheduleRefresh(100);
        });
    }

    function initNotifications() {
        setupEvents();
        renderNotifications();
        scheduleRefresh(300);
        pollingTimer = window.setInterval(() => {
            if (!document.hidden && isAuthenticated()) refreshNotifications();
        }, REFRESH_INTERVAL);
    }

    window.refreshTopbarNotifications = refreshNotifications;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initNotifications);
    } else {
        initNotifications();
    }
})();
