/* Nhật ký AI: tải trực tiếp từ bảng AILogs qua REST API. */
(function () {
    "use strict";

    const PAGE_SIZE = 6;
    const FEATURE_LABELS = {
        product_advice: "Tư vấn sản phẩm",
        revenue_analysis: "Báo cáo doanh thu",
        sales_qa: "Hỏi đáp dữ liệu"
    };
    let logs = [];
    let currentPage = 1;

    const byId = id => document.getElementById(id);

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return { date: "--/--/----", time: "--:--" };
        return {
            date: date.toLocaleDateString("vi-VN"),
            time: date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        };
    }

    function dateKey(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function normalize(value) {
        return String(value || "").toLocaleLowerCase("vi").trim();
    }

    function filteredLogs() {
        const search = normalize(byId("ai-logs-search-input")?.value);
        const feature = byId("ai-logs-feature-filter")?.value || "all";
        const date = byId("ai-logs-date-filter")?.value || "";
        return logs.filter(log => {
            const searchable = normalize([
                log.userName,
                log.username,
                log.question,
                log.answer,
                FEATURE_LABELS[log.feature] || log.feature
            ].join(" "));
            return (!search || searchable.includes(search))
                && (feature === "all" || log.feature === feature)
                && (!date || dateKey(log.requestedAt) === date);
        });
    }

    function renderSummary() {
        const totalTokens = logs.reduce((sum, log) => sum + Number(log.tokenUsed || 0), 0);
        const users = new Set(logs.map(log => log.userId || log.username).filter(Boolean));
        if (byId("ai-logs-total")) byId("ai-logs-total").textContent = logs.length.toLocaleString("vi-VN");
        if (byId("ai-logs-tokens")) byId("ai-logs-tokens").textContent = totalTokens.toLocaleString("vi-VN");
        if (byId("ai-logs-users")) byId("ai-logs-users").textContent = users.size.toLocaleString("vi-VN");
    }

    function pageButton(label, target, disabled, active, ariaLabel) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.disabled = disabled;
        button.classList.toggle("active", active);
        button.setAttribute("aria-label", ariaLabel || `Trang ${target}`);
        if (active) button.setAttribute("aria-current", "page");
        button.addEventListener("click", () => {
            if (!disabled && target !== currentPage) {
                currentPage = target;
                renderTable();
            }
        });
        return button;
    }

    function renderPagination(total, pages) {
        const pagination = byId("ai-logs-pagination");
        if (!pagination) return;
        pagination.innerHTML = "";
        if (!total) return;
        pagination.appendChild(pageButton("‹", currentPage - 1, currentPage === 1, false, "Trang trước"));
        for (let page = 1; page <= pages; page += 1) {
            pagination.appendChild(pageButton(String(page), page, false, page === currentPage));
        }
        pagination.appendChild(pageButton("›", currentPage + 1, currentPage === pages, false, "Trang sau"));
    }

    function renderTable() {
        const body = byId("ai-logs-table-body");
        const count = byId("ai-logs-count");
        if (!body) return;
        const filtered = filteredLogs();
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        currentPage = Math.min(Math.max(currentPage, 1), totalPages);
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageLogs = filtered.slice(start, start + PAGE_SIZE);

        if (!pageLogs.length) {
            body.innerHTML = '<tr><td colspan="8" class="ai-logs-empty">Chưa có nhật ký AI phù hợp với bộ lọc.</td></tr>';
            if (count) count.textContent = "Không có yêu cầu AI";
            renderPagination(0, 1);
            return;
        }

        body.innerHTML = pageLogs.map(log => {
            const requested = formatDate(log.requestedAt);
            const feature = FEATURE_LABELS[log.feature] || log.feature || "AI";
            return `
                <tr>
                    <td class="ai-log-id">#${escapeHtml(log.id)}</td>
                    <td class="ai-log-user"><strong>${escapeHtml(log.userName)}</strong><span>@${escapeHtml(log.username || "không xác định")}</span></td>
                    <td><span class="ai-log-feature ${escapeHtml(log.feature)}">${escapeHtml(feature)}</span></td>
                    <td><div class="ai-log-preview" title="${escapeHtml(log.question)}">${escapeHtml(log.question || "—")}</div></td>
                    <td><div class="ai-log-preview" title="${escapeHtml(log.answer)}">${escapeHtml(log.answer || "—")}</div></td>
                    <td class="ai-log-token">${Number(log.tokenUsed || 0).toLocaleString("vi-VN")}</td>
                    <td class="ai-log-date"><strong>${requested.date}</strong>${requested.time}</td>
                    <td><button type="button" class="ai-log-detail-button" data-ai-log-id="${escapeHtml(log.id)}" aria-label="Xem chi tiết nhật ký #${escapeHtml(log.id)}">›</button></td>
                </tr>`;
        }).join("");

        body.querySelectorAll("[data-ai-log-id]").forEach(button => {
            button.addEventListener("click", () => openDetail(button.dataset.aiLogId));
        });
        const end = Math.min(start + PAGE_SIZE, filtered.length);
        if (count) count.textContent = `Hiển thị ${start + 1}-${end} / ${filtered.length} yêu cầu`;
        renderPagination(filtered.length, totalPages);
    }

    function openDetail(id) {
        const log = logs.find(item => String(item.id) === String(id));
        const modal = byId("ai-log-detail-modal");
        if (!log || !modal) return;
        const requested = formatDate(log.requestedAt);
        byId("ai-log-detail-title").textContent = `${FEATURE_LABELS[log.feature] || "Nhật ký AI"} #${log.id}`;
        byId("ai-log-detail-meta").innerHTML = `
            <span>${escapeHtml(log.userName)} (@${escapeHtml(log.username || "không xác định")})</span>
            <span>${requested.date} lúc ${requested.time}</span>
            <span>${Number(log.tokenUsed || 0).toLocaleString("vi-VN")} token</span>`;
        byId("ai-log-detail-question").textContent = log.question || "Không có dữ liệu đầu vào.";
        byId("ai-log-detail-answer").textContent = log.answer || "Không có phản hồi.";
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeDetail() {
        const modal = byId("ai-log-detail-modal");
        if (!modal) return;
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.removeProperty("overflow");
    }

    async function refreshAILogs() {
        const body = byId("ai-logs-table-body");
        const button = byId("ai-logs-refresh-button");
        if (body) body.innerHTML = '<tr><td colspan="8" class="ai-logs-empty">Đang tải nhật ký AI...</td></tr>';
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span aria-hidden="true">↻</span> Đang đồng bộ...';
        }
        try {
            logs = await window.salesApi.ai.logs();
            currentPage = 1;
            renderSummary();
            renderTable();
        } catch (error) {
            logs = [];
            renderSummary();
            if (body) body.innerHTML = `<tr><td colspan="8" class="ai-logs-empty">${escapeHtml(error.message || "Không thể tải nhật ký AI.")}</td></tr>`;
            if (byId("ai-logs-count")) byId("ai-logs-count").textContent = "Không thể tải dữ liệu";
            renderPagination(0, 1);
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = '<span aria-hidden="true">↻</span> Làm mới dữ liệu';
            }
        }
    }

    async function showAILogsPage() {
        if (typeof window.requirePermission === "function" && !window.requirePermission("ai_log_view")) return;
        window.showHistoryPage?.();
        await window.activateHistoryTab?.("ai");
    }

    function resetFilters() {
        if (byId("ai-logs-search-input")) byId("ai-logs-search-input").value = "";
        if (byId("ai-logs-feature-filter")) byId("ai-logs-feature-filter").value = "all";
        if (byId("ai-logs-date-filter")) byId("ai-logs-date-filter").value = "";
        currentPage = 1;
        renderTable();
    }

    function setup() {
        byId("ai-logs-refresh-button")?.addEventListener("click", refreshAILogs);
        byId("ai-logs-clear-filter")?.addEventListener("click", resetFilters);
        byId("ai-log-detail-close")?.addEventListener("click", closeDetail);
        byId("ai-log-detail-modal")?.addEventListener("click", event => {
            if (event.target === event.currentTarget) closeDetail();
        });
        ["ai-logs-search-input", "ai-logs-feature-filter", "ai-logs-date-filter"].forEach(id => {
            const eventName = id === "ai-logs-search-input" ? "input" : "change";
            byId(id)?.addEventListener(eventName, () => {
                currentPage = 1;
                renderTable();
            });
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") closeDetail();
        });
        window.addEventListener("auth:login", () => {
            byId("ai-logs-page")?.classList.remove("active");
            closeDetail();
        });
        window.addEventListener("auth:logout", closeDetail);
        document.querySelectorAll(".menu-item[data-page]").forEach(item => {
            item.addEventListener("click", () => {
                if (!['ai-logs', 'history'].includes(item.dataset.page)) {
                    byId("ai-logs-page")?.classList.remove("active");
                }
            });
        });
        renderSummary();
        renderTable();
    }

    window.showAILogsPage = showAILogsPage;
    window.refreshAILogs = refreshAILogs;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setup);
    } else {
        setup();
    }
})();
