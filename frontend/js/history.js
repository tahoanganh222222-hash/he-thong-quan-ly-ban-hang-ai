/* Nhật ký hoạt động lấy trực tiếp từ SQL Server qua REST API. */
(function () {
    "use strict";

    let historyData = [];
    const automaticallyLoggedObjects = new Set([
        "Sản phẩm",
        "Khách hàng",
        "Hóa đơn",
        "Phiếu nhập",
        "Tồn kho"
    ]);

    function escapeHistoryHTML(value) {
        const element = document.createElement("div");
        element.textContent = String(value ?? "");
        return element.innerHTML;
    }

    function updateHistoryCount(count) {
        const element = document.getElementById("history-count");
        if (element) {
            element.textContent = `Hiển thị ${count} hoạt động`;
        }
    }

    function loadHistoryTable() {
        if (
            typeof hasCurrentUserPermission === "function" &&
            !hasCurrentUserPermission("history_view")
        ) {
            return;
        }

        const tbody = document.getElementById("history-table-body");
        if (!tbody) return;

        const search = (document.getElementById("history-search-input")?.value || "")
            .toLocaleLowerCase("vi")
            .trim();
        const action = document.getElementById("history-action-filter")?.value || "all";
        const object = document.getElementById("history-object-filter")?.value || "all";

        const filteredData = historyData.filter(item => {
            const searchable = [
                item.user,
                item.username,
                item.action,
                item.object,
                item.code,
                item.detail
            ].join(" ").toLocaleLowerCase("vi");
            return (
                (!search || searchable.includes(search)) &&
                (action === "all" || item.actionType === action) &&
                (object === "all" || item.object === object)
            );
        });

        if (!filteredData.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="history-empty">Không tìm thấy lịch sử hoạt động</div>
                    </td>
                </tr>
            `;
            updateHistoryCount(0);
            return;
        }

        tbody.innerHTML = filteredData.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td class="history-time">${escapeHistoryHTML(item.time)}</td>
                <td class="history-user">${escapeHistoryHTML(item.user || item.username)}</td>
                <td>
                    <span class="history-action ${escapeHistoryHTML(item.actionType)}">
                        ${escapeHistoryHTML(item.action)}
                    </span>
                </td>
                <td>${escapeHistoryHTML(item.object)}</td>
                <td>${escapeHistoryHTML(item.code)}</td>
                <td>${escapeHistoryHTML(item.detail)}</td>
            </tr>
        `).join("");
        updateHistoryCount(filteredData.length);
    }

    async function refreshHistory() {
        const tbody = document.getElementById("history-table-body");
        const refreshButton = document.getElementById("history-refresh-button");
        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.textContent = "↻ Đang làm mới...";
        }
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="history-empty">Đang tải lịch sử...</td></tr>';
        }
        try {
            historyData = await window.salesApi.history.list();
            loadHistoryTable();
        } catch (error) {
            console.error("Không thể tải lịch sử hoạt động:", error);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="history-empty">${escapeHistoryHTML(error.message || "Không thể tải lịch sử")}</td></tr>`;
            }
            updateHistoryCount(0);
        } finally {
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.textContent = "↻ Làm mới";
            }
        }
    }

    async function initHistoryManagement() {
        if (
            typeof requirePermission === "function" &&
            !requirePermission("history_view")
        ) {
            return;
        }

        const searchInput = document.getElementById("history-search-input");
        const actionFilter = document.getElementById("history-action-filter");
        const objectFilter = document.getElementById("history-object-filter");
        const refreshButton = document.getElementById("history-refresh-button");

        if (searchInput && !searchInput.dataset.initialized) {
            searchInput.addEventListener("input", loadHistoryTable);
            searchInput.dataset.initialized = "true";
        }
        if (actionFilter && !actionFilter.dataset.initialized) {
            actionFilter.addEventListener("change", loadHistoryTable);
            actionFilter.dataset.initialized = "true";
        }
        if (objectFilter && !objectFilter.dataset.initialized) {
            objectFilter.addEventListener("change", loadHistoryTable);
            objectFilter.dataset.initialized = "true";
        }
        await refreshHistory();
    }

    async function addHistory(payload) {
        // Các nghiệp vụ này đã được backend ghi trong cùng giao dịch dữ liệu.
        if (!payload || automaticallyLoggedObjects.has(payload.object)) return;
        try {
            await window.salesApi.history.create(payload);
            if (document.getElementById("history-page")?.classList.contains("active")) {
                await refreshHistory();
            }
        } catch (error) {
            console.error("Không thể ghi lịch sử hoạt động:", error);
        }
    }

    document.addEventListener("sales:data-changed", function () {
        if (document.getElementById("history-page")?.classList.contains("active")) {
            refreshHistory();
        }
    });

    window.addHistory = addHistory;
    window.loadHistoryTable = loadHistoryTable;
    window.refreshHistory = refreshHistory;
    window.initHistoryManagement = initHistoryManagement;
})();
