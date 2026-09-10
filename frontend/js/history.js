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

    function renderSummary() {
        const total = byId("history-total-count");
        const today = byId("history-today-count");
        const users = byId("history-user-count");
        const uniqueUsers = new Set(
            historyData.map(item => item.username || item.user).filter(Boolean)
        );
        if (total) total.textContent = historyData.length.toLocaleString("vi-VN");
        if (today) {
            today.textContent = historyData
                .filter(item => localDateKey(item.createdAt) === todayKey())
                .length.toLocaleString("vi-VN");
        }
        if (users) users.textContent = uniqueUsers.size.toLocaleString("vi-VN");
    }

    function getFilteredData() {
        const search = (byId("history-search-input")?.value || "")
            .toLocaleLowerCase("vi").trim();
        const action = byId("history-action-filter")?.value || "all";
        const object = byId("history-object-filter")?.value || "all";
        const date = byId("history-date-filter")?.value || "";
        return historyData.filter(item => {
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
            return `
            <tr>
                <td class="history-index">${start + index + 1}</td>
                <td class="history-time">${escapeHTML(item.time)}</td>
                <td class="history-user"><strong>${escapeHTML(item.user || item.username)}</strong><span>@${escapeHTML(item.username || "không xác định")}</span></td>
                <td><span class="history-action ${escapeHTML(item.actionType)}">${escapeHTML(item.action)}</span></td>
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
            renderHistoryTable();
        } catch (error) {
            historyData = [];
            renderSummary();
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
            ? '<span aria-hidden="true">↻</span> Đang đồng bộ...'
            : '<span aria-hidden="true">↻</span> Làm mới dữ liệu';
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
