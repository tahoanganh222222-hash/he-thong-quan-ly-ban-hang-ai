/* Trung tâm lịch sử: hoạt động hệ thống và nhật ký AI từ SQL Server. */
(function () {
    "use strict";

    let historyData = [];
    let currentHistoryPage = 1;
    let currentHistoryTab = "activity";
    const ITEMS_PER_PAGE = 6;
    const automaticallyLoggedObjects = new Set([
        "Sản phẩm", "Khách hàng", "Hóa đơn", "Phiếu nhập", "Tồn kho"
    ]);

    const byId = id => document.getElementById(id);

    function escapeHTML(value) {
        const element = document.createElement("div");
        element.textContent = String(value ?? "");
        return element.innerHTML;
    }

    function localDateKey(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    function todayKey() {
        return localDateKey(new Date());
    }

    function formatHistoryDetail(value) {
        return String(value ?? "").replace(
            /(tổng tiền\s+)(\d+(?:\.\d+)?)/giu,
            (match, prefix, amount) => {
                const numericAmount = Number(amount);
                return Number.isFinite(numericAmount)
                    ? `${prefix}${numericAmount.toLocaleString("vi-VN")} ₫`
                    : match;
            }
        );
    }

    function canView(permission) {
        return typeof window.hasCurrentUserPermission !== "function"
            || window.hasCurrentUserPermission(permission);
    }

    function getCurrentViewData() {
        return historyData;
    }

    function renderSummary() {
        const viewData = getCurrentViewData();
        const total = byId("history-total-count");
        const today = byId("history-today-count");
        const users = byId("history-user-count");
        const extraValue = byId("history-extra-value");
        const userNames = [...new Set(
            viewData.map(item => item.user || item.username).filter(Boolean)
        )];
        const uniqueUsers = new Set(userNames);
        const now = new Date();
        const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const startPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const yesterdayKey = localDateKey(yesterday);
        const todayCount = viewData.filter(item => localDateKey(item.createdAt) === todayKey()).length;
        const yesterdayCount = viewData.filter(item => localDateKey(item.createdAt) === yesterdayKey).length;
        const thisMonthCount = viewData.filter(item => {
            const date = new Date(item.createdAt);
            return !Number.isNaN(date.getTime()) && date >= startThisMonth && date < startNextMonth;
        }).length;
        const previousMonthCount = viewData.filter(item => {
            const date = new Date(item.createdAt);
            return !Number.isNaN(date.getTime()) && date >= startPreviousMonth && date < startThisMonth;
        }).length;
        const trendValue = (current, previous) => previous
            ? ((current - previous) / previous) * 100
            : (current ? 100 : 0);
        const applyTrend = (id, current, previous) => {
            const element = byId(id);
            if (!element) return;
            const value = trendValue(current, previous);
            const rounded = Math.abs(value).toFixed(1).replace(/\.0$/, "");
            element.textContent = `${value < 0 ? "↓" : "↑"} ${rounded}%`;
            element.classList.toggle("negative", value < 0);
        };
        if (total) total.textContent = viewData.length.toLocaleString("vi-VN");
        if (today) today.textContent = todayCount.toLocaleString("vi-VN");
        if (users) users.textContent = uniqueUsers.size.toLocaleString("vi-VN");
        applyTrend("history-total-trend", thisMonthCount, previousMonthCount);
        applyTrend("history-today-trend", todayCount, yesterdayCount);

        const avatars = byId("history-user-avatars");
        if (avatars) {
            const initials = name => String(name).trim().split(/\s+/).slice(-2).map(part => part[0] || "").join("").toUpperCase();
            avatars.innerHTML = userNames.slice(0, 3).map((name, index) =>
                `<i class="avatar-${index + 1}" title="${escapeHTML(name)}">${escapeHTML(initials(name))}</i>`
            ).join("") + (userNames.length > 3 ? `<b>+${userNames.length - 3}</b>` : "");
        }

        if (byId("history-total-label")) byId("history-total-label").textContent = "Tổng hoạt động";
        if (byId("history-today-label")) byId("history-today-label").textContent = "Hoạt động hôm nay";
        if (byId("history-user-label")) byId("history-user-label").textContent = "Người thực hiện";
        if (byId("history-extra-label")) byId("history-extra-label").textContent = "Thao tác nhiều nhất";
        if (extraValue) {
            const actionCounts = viewData.reduce((counts, item) => {
                const actionName = item.action || "Khác";
                counts.set(actionName, (counts.get(actionName) || 0) + 1);
                return counts;
            }, new Map());
            const topAction = [...actionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
            extraValue.textContent = topAction ? topAction[0] : "—";
            extraValue.title = topAction ? `${topAction[1]} lượt` : "";
            const extraMeta = byId("history-extra-meta");
            if (extraMeta) {
                const count = topAction ? topAction[1] : 0;
                const percent = viewData.length ? ((count / viewData.length) * 100).toFixed(1) : "0";
                extraMeta.textContent = `${count.toLocaleString("vi-VN")} lượt (${percent}%)`;
            }
        }
    }

    function historyActionVisual(item) {
        const objectName = String(item.object || "").toLocaleLowerCase("vi");
        if (item.actionType === "create") return { className: "invoice", icon: '<path d="M3 6h2l2 9h10l2-6H7"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/>' };
        if (item.actionType === "import") return { className: "purchase", icon: '<path d="m4 8 8-4 8 4-8 4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/>' };
        if (item.actionType === "update" && objectName.includes("danh mục")) return { className: "category", icon: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>' };
        if (item.actionType === "update") return { className: "product", icon: '<path d="m4 8 8-4 8 4-8 4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/>' };
        if (item.actionType === "add") return { className: "customer", icon: '<circle cx="12" cy="8" r="3"/><path d="M6 20c.6-4 2.6-6 6-6s5.4 2 6 6"/>' };
        if (["delete", "cancel"].includes(item.actionType)) return { className: "delete", icon: '<path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/>' };
        if (item.actionType === "login") return { className: "login", icon: '<path d="M13 5h6v14h-6M10 8l4 4-4 4M14 12H4"/>' };
        if (item.actionType === "logout") return { className: "logout", icon: '<path d="M11 5H5v14h6M14 8l4 4-4 4m4-4H8"/>' };
        if (item.actionType === "export") return { className: "export", icon: '<path d="M12 3v12m-4-4 4 4 4-4M5 19h14"/>' };
        return { className: "other", icon: '<circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/>' };
    }

    function renderHistoryInsights() {
        const chart = byId("history-donut-chart");
        const legend = byId("history-chart-legend");
        const recent = byId("history-recent-list");
        const totalElement = byId("history-donut-total");
        const palette = ["#22c783", "#f5a524", "#2397e5", "#4f63e8", "#8b5cf6", "#94a3b8"];
        const labels = {
            create: "Tạo hóa đơn",
            import: "Nhập hàng",
            update: "Cập nhật",
            login: "Đăng nhập",
            logout: "Đăng xuất",
            add: "Thêm dữ liệu",
            delete: "Xóa dữ liệu",
            cancel: "Hủy chứng từ",
            export: "Xuất báo cáo"
        };

        const counts = historyData.reduce((map, item) => {
            const key = item.actionType || "other";
            map.set(key, (map.get(key) || 0) + 1);
            return map;
        }, new Map());
        const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const total = historyData.length;
        if (totalElement) totalElement.textContent = total.toLocaleString("vi-VN");

        if (chart) {
            let cursor = 0;
            const stops = entries.map(([, count], index) => {
                const start = cursor;
                cursor += total ? (count / total) * 100 : 0;
                return `${palette[index % palette.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
            });
            chart.style.background = total
                ? `conic-gradient(${stops.join(", ")})`
                : "conic-gradient(#e2e8f0 0 100%)";
        }

        if (legend) {
            legend.innerHTML = entries.slice(0, 6).map(([key, count], index) => {
                const percent = total ? ((count / total) * 100).toFixed(1) : "0.0";
                return `<div><i style="background:${palette[index % palette.length]}"></i><span>${escapeHTML(labels[key] || key)}</span><strong>${count} (${percent}%)</strong></div>`;
            }).join("") || '<p class="history-insight-empty">Chưa có dữ liệu.</p>';
        }

        if (recent) {
            recent.innerHTML = historyData.slice(0, 5).map((item, index) => `
                <article>
                    <time>${escapeHTML(String(item.time || "").split(" ").pop() || "—")}</time>
                    <i style="--history-recent-color:${palette[index % palette.length]}"></i>
                    <div><strong>${escapeHTML(item.action || "Hoạt động")}${item.code ? ` ${escapeHTML(item.code)}` : ""}</strong><small>${escapeHTML(item.user || item.username || "Hệ thống")}</small></div>
                </article>
            `).join("") || '<p class="history-insight-empty">Chưa có hoạt động gần đây.</p>';
        }
    }

    function getFilteredData() {
        const search = (byId("history-search-input")?.value || "")
            .toLocaleLowerCase("vi").trim();
        const action = byId("history-action-filter")?.value || "all";
        const object = byId("history-object-filter")?.value || "all";
        const date = byId("history-date-filter")?.value || "";
        return getCurrentViewData().filter(item => {
            const searchable = [
                item.user, item.username, item.action, item.object, item.code, item.detail
            ].join(" ").toLocaleLowerCase("vi");
            return (!search || searchable.includes(search))
                && (action === "all" || item.actionType === action)
                && (object === "all" || item.object === object)
                && (!date || localDateKey(item.createdAt) === date);
        });
    }

    function updateCount(total, start, end) {
        const element = byId("history-count");
        if (element) {
            element.textContent = total
                ? `Hiển thị ${start}-${end} / ${total} hoạt động`
                : "Không có hoạt động";
        }
    }

    function makePageButton(label, target, disabled, active, ariaLabel) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.disabled = disabled;
        button.classList.toggle("active", active);
        button.setAttribute("aria-label", ariaLabel || `Trang ${target}`);
        if (active) button.setAttribute("aria-current", "page");
        button.addEventListener("click", () => {
            if (!disabled && target !== currentHistoryPage) {
                currentHistoryPage = target;
                renderHistoryTable();
            }
        });
        return button;
    }

    function renderPagination(total, pages) {
        const container = byId("history-pagination-buttons");
        if (!container) return;
        container.innerHTML = "";
        if (!total) return;
        container.appendChild(makePageButton(
            "‹", currentHistoryPage - 1, currentHistoryPage === 1, false, "Trang trước"
        ));
        const visiblePageCount = Math.min(5, pages);
        const firstVisiblePage = Math.min(
            Math.max(currentHistoryPage - Math.floor(visiblePageCount / 2), 1),
            Math.max(pages - visiblePageCount + 1, 1)
        );
        const lastVisiblePage = firstVisiblePage + visiblePageCount - 1;
        for (let page = firstVisiblePage; page <= lastVisiblePage; page += 1) {
            container.appendChild(makePageButton(String(page), page, false, page === currentHistoryPage));
        }
        container.appendChild(makePageButton(
            "›", currentHistoryPage + 1, currentHistoryPage === pages, false, "Trang sau"
        ));
    }

    function renderHistoryTable() {
        if (!canView("history_view")) return;
        const body = byId("history-table-body");
        if (!body) return;
        const filtered = getFilteredData();
        const pages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
        currentHistoryPage = Math.min(Math.max(currentHistoryPage, 1), pages);
        const start = (currentHistoryPage - 1) * ITEMS_PER_PAGE;
        const rows = filtered.slice(start, start + ITEMS_PER_PAGE);

        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="7" class="history-empty">Chưa có hoạt động phù hợp với bộ lọc.</td></tr>';
            updateCount(0, 0, 0);
            renderPagination(0, 1);
            return;
        }

        body.innerHTML = rows.map((item, index) => {
            const detail = formatHistoryDetail(item.detail);
            const actionVisual = historyActionVisual(item);
            return `
            <tr>
                <td class="history-index">${start + index + 1}</td>
                <td class="history-time">${escapeHTML(item.time)}</td>
                <td class="history-user"><strong>${escapeHTML(item.user || item.username)}</strong><span>@${escapeHTML(item.username || "không xác định")}</span></td>
                <td><span class="history-action ${escapeHTML(item.actionType)} ${actionVisual.className}"><svg viewBox="0 0 24 24" aria-hidden="true">${actionVisual.icon}</svg><span>${escapeHTML(item.action)}</span></span></td>
                <td><span class="history-object">${escapeHTML(item.object)}</span></td>
                <td class="history-code" title="${escapeHTML(item.code || "—")}">${escapeHTML(item.code || "—")}</td>
                <td><div class="history-detail" title="${escapeHTML(detail)}">${escapeHTML(detail || "—")}</div></td>
            </tr>`;
        }).join("");

        updateCount(filtered.length, start + 1, Math.min(start + ITEMS_PER_PAGE, filtered.length));
        renderPagination(filtered.length, pages);
    }

    async function refreshHistory() {
        if (!canView("history_view")) return;
        const body = byId("history-table-body");
        if (body) body.innerHTML = '<tr><td colspan="7" class="history-empty">Đang tải lịch sử hoạt động...</td></tr>';
        try {
            historyData = await window.salesApi.history.list();
            currentHistoryPage = 1;
            renderSummary();
            renderHistoryInsights();
            renderHistoryTable();
        } catch (error) {
            historyData = [];
            renderSummary();
            renderHistoryInsights();
            if (body) {
                body.innerHTML = `<tr><td colspan="7" class="history-empty">${escapeHTML(error.message || "Không thể tải lịch sử.")}</td></tr>`;
            }
            updateCount(0, 0, 0);
            renderPagination(0, 1);
        }
    }

    function setRefreshState(loading) {
        const button = byId("history-refresh-button");
        if (!button) return;
        button.disabled = loading;
        button.innerHTML = loading
            ? '<span aria-hidden="true">↻</span><span class="history-refresh-label">Đang đồng bộ...</span>'
            : '<span aria-hidden="true">↻</span><span class="history-refresh-label">Làm mới dữ liệu</span>';
    }

    async function refreshCurrentTab() {
        setRefreshState(true);
        try {
            if (currentHistoryTab === "ai") {
                await window.refreshAILogs?.();
            } else {
                await refreshHistory();
            }
        } finally {
            setRefreshState(false);
        }
    }

    function updateHero(tab) {
        const title = byId("history-hero-title");
        const description = byId("history-hero-description");
        const topTitle = document.querySelector(".topbar h1");
        const topDescription = document.querySelector(".topbar p");
        const isAI = tab === "ai";
        if (title) title.textContent = isAI ? "Nhật ký AI" : "Lịch sử hoạt động";
        if (description) {
            description.textContent = isAI
                ? "Tra cứu câu hỏi, phản hồi và mức tiêu thụ token trên toàn hệ thống."
                : "Theo dõi các thao tác, phiên đăng nhập và sự kiện phát sinh trong hệ thống.";
        }
        if (topTitle) topTitle.textContent = isAI ? "Nhật ký AI" : "Lịch sử";
        if (topDescription) {
            topDescription.textContent = isAI
                ? "Theo dõi lịch sử sử dụng và mức tiêu thụ token"
                : "Trung tâm theo dõi hoạt động hệ thống";
        }
    }

    async function activateHistoryTab(tab, refresh = true) {
        let nextTab = tab === "ai" ? "ai" : "activity";
        if (nextTab === "ai" && !canView("ai_log_view")) nextTab = "activity";
        if (nextTab === "activity" && !canView("history_view") && canView("ai_log_view")) nextTab = "ai";
        currentHistoryTab = nextTab;

        document.querySelectorAll("[data-history-tab]").forEach(button => {
            const selected = button.dataset.historyTab === nextTab;
            button.classList.toggle("active", selected);
            button.setAttribute("aria-selected", String(selected));
        });
        byId("history-activity-panel")?.classList.toggle("active", nextTab === "activity");
        byId("history-ai-panel")?.classList.toggle("active", nextTab === "ai");
        byId("ai-logs-page")?.classList.toggle("active", nextTab === "ai");
        updateHero(nextTab);
        if (refresh) await refreshCurrentTab();
    }

    function resetFilters() {
        if (byId("history-search-input")) byId("history-search-input").value = "";
        if (byId("history-action-filter")) byId("history-action-filter").value = "all";
        if (byId("history-object-filter")) byId("history-object-filter").value = "all";
        if (byId("history-date-filter")) byId("history-date-filter").value = "";
        currentHistoryPage = 1;
        renderHistoryTable();
    }

    async function initHistoryHub() {
        const preferred = currentHistoryTab === "ai" && canView("ai_log_view")
            ? "ai"
            : (canView("history_view") ? "activity" : "ai");
        await activateHistoryTab(preferred);
    }

    async function addHistory(payload) {
        if (!payload || automaticallyLoggedObjects.has(payload.object)) return;
        try {
            await window.salesApi.history.create(payload);
            if (byId("history-page")?.classList.contains("active") && currentHistoryTab === "activity") {
                await refreshHistory();
            }
        } catch (error) {
            console.error("Không thể ghi lịch sử hoạt động:", error);
        }
    }

    function setup() {
        const aiPage = byId("ai-logs-page");
        const aiPanel = byId("history-ai-panel");
        if (aiPage && aiPanel && aiPage.parentElement !== aiPanel) aiPanel.appendChild(aiPage);

        document.querySelectorAll("[data-history-tab]").forEach(button => {
            button.addEventListener("click", () => activateHistoryTab(button.dataset.historyTab));
        });
        ["history-search-input", "history-action-filter", "history-object-filter", "history-date-filter"].forEach(id => {
            const eventName = id === "history-search-input" ? "input" : "change";
            byId(id)?.addEventListener(eventName, () => {
                currentHistoryPage = 1;
                renderHistoryTable();
            });
        });
        byId("history-clear-filter")?.addEventListener("click", resetFilters);
        byId("history-refresh-button")?.addEventListener("click", refreshCurrentTab);
        renderSummary();
        renderHistoryInsights();
        renderHistoryTable();
    }

    document.addEventListener("sales:data-changed", () => {
        if (byId("history-page")?.classList.contains("active") && currentHistoryTab === "activity") {
            refreshHistory();
        }
    });

    window.addHistory = addHistory;
    window.loadHistoryTable = renderHistoryTable;
    window.refreshHistory = refreshHistory;
    window.initHistoryManagement = initHistoryHub;
    window.initHistoryHub = initHistoryHub;
    window.activateHistoryTab = activateHistoryTab;

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
    else setup();
})();
