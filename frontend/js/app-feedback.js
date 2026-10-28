/* Shared non-blocking notices and accessible, asynchronous confirmations. */
(function () {
    "use strict";

    let toastRegion;
    let dialog;
    let messageElement;
    let cancelButton;
    let confirmButton;
    let activeRequest = null;
    const requests = [];

    function ensureToastRegion() {
        if (toastRegion) return toastRegion;
        toastRegion = document.createElement("div");
        toastRegion.className = "app-toast-region";
        toastRegion.setAttribute("aria-live", "polite");
        toastRegion.setAttribute("aria-relevant", "additions");
        document.body.appendChild(toastRegion);
        return toastRegion;
    }

    window.appNotify = function (message) {
        const value = String(message ?? "");
        const notice = document.createElement("div");
        notice.className = "app-toast";
        const text = document.createElement("span");
        text.className = "app-toast-text";
        text.textContent = value;
        const close = document.createElement("button");
        close.type = "button";
        close.className = "app-toast-close";
        close.setAttribute("aria-label", "Đóng thông báo");
        close.textContent = "×";
        const dismiss = () => notice.remove();
        close.addEventListener("click", dismiss);
        notice.append(text, close);
        ensureToastRegion().appendChild(notice);
        window.setTimeout(dismiss, value.length > 120 ? 10000 : 7000);
    };

    function finish(result) {
        if (!activeRequest) return;
        const request = activeRequest;
        activeRequest = null;
        dialog.close();
        if (request.focus?.isConnected && typeof request.focus.focus === "function") request.focus.focus();
        request.resolve(result);
        openNext();
    }

    function ensureDialog() {
        if (dialog) return;
        dialog = document.createElement("dialog");
        dialog.className = "app-confirm";
        dialog.setAttribute("aria-labelledby", "app-confirm-title");
        dialog.setAttribute("aria-describedby", "app-confirm-message");
        dialog.innerHTML = '<div class="app-confirm-content"><h2 id="app-confirm-title">Xác nhận thao tác</h2><p id="app-confirm-message"></p><div class="app-confirm-actions"><button type="button" class="app-confirm-cancel">Hủy</button><button type="button" class="app-confirm-accept">Xác nhận</button></div></div>';
        messageElement = dialog.querySelector("#app-confirm-message");
        cancelButton = dialog.querySelector(".app-confirm-cancel");
        confirmButton = dialog.querySelector(".app-confirm-accept");
        cancelButton.addEventListener("click", () => finish(false));
        confirmButton.addEventListener("click", () => finish(true));
        dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
        dialog.addEventListener("keydown", event => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(false); }
        });
        dialog.addEventListener("click", event => { if (event.target === dialog) finish(false); });
        document.body.appendChild(dialog);
    }

    function openNext() {
        if (activeRequest || requests.length === 0) return;
        ensureDialog();
        activeRequest = requests.shift();
        messageElement.textContent = activeRequest.message;
        dialog.showModal();
        cancelButton.focus();
    }

    window.appConfirm = function (message) {
        return new Promise(resolve => {
            requests.push({ message: String(message ?? ""), resolve, focus: document.activeElement });
            openNext();
        });
    };
})();
