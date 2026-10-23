(function setupCollapsibleSidebar() {
    "use strict";

    const STORAGE_KEY = "sales-manager-sidebar-collapsed";
    const root = document.documentElement;
    const toggle = document.getElementById("sidebar-toggle");
    const sidebar = document.querySelector(".sidebar");
    const menuItems = Array.from(document.querySelectorAll(".sidebar-menu .menu-item"));
    const status = document.querySelector(".system-status");
    const logoutButton = document.getElementById("logout-button");
    let resizeTimer = null;

    if (!toggle || !sidebar) {
        return;
    }

    function isCollapsed() {
        return root.dataset.sidebarCollapsed === "true";
    }

    function setOptionalTitle(element, label, collapsed) {
        if (!element || !label) {
            return;
        }

        if (collapsed) {
            element.setAttribute("title", label);
        } else {
            element.removeAttribute("title");
        }
    }

    function notifyLayoutChanged() {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(function () {
            window.dispatchEvent(new Event("resize"));
            window.dispatchEvent(new CustomEvent("sidebar:change", {
                detail: { collapsed: isCollapsed() }
            }));
        }, 260);
    }

    function applyState(collapsed, persist) {
        if (collapsed) {
            root.dataset.sidebarCollapsed = "true";
        } else {
            delete root.dataset.sidebarCollapsed;
        }

        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute("aria-label", collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên");
        toggle.setAttribute("title", collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên");
        sidebar.setAttribute("aria-label", collapsed ? "Thanh bên đã thu gọn" : "Thanh bên");

        menuItems.forEach(function (item) {
            const labelNode = item.querySelector("span:not(.menu-icon)");
            const label = labelNode ? labelNode.textContent.trim() : "";
            setOptionalTitle(item, label, collapsed);
            if (label && !item.hasAttribute("aria-label")) {
                item.setAttribute("aria-label", label);
            }
        });

        setOptionalTitle(status, "Trạng thái hệ thống", collapsed);
        setOptionalTitle(logoutButton, "Đăng xuất", collapsed);

        if (persist) {
            try {
                localStorage.setItem(STORAGE_KEY, String(collapsed));
            } catch (error) {
                // Không làm gián đoạn thao tác nếu localStorage bị chặn.
            }
        }

        notifyLayoutChanged();
    }

    toggle.addEventListener("click", function () {
        applyState(!isCollapsed(), true);
    });

    applyState(isCollapsed(), false);
})();
