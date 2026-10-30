/* View, edit and cancel saved business documents; stock belongs to documents. */
(function () {
    "use strict";
    const escape = value => String(value ?? "").replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    const money = value => Number(value || 0).toLocaleString("vi-VN") + " ₫";
    let modal, state, sequence = 0;
    const sale = () => state.kind === "invoices";
    const permission = () => sale() ? "invoice_create" : "purchase_track";
    const canEdit = () => state.doc.status !== "cancelled" && window.hasCurrentUserPermission?.(permission());

    function ensureModal() {
        if (modal) return;
        modal = document.createElement("dialog");
        modal.id = "sales-document-modal";
        modal.className = "document-modal";
        modal.setAttribute("aria-labelledby", "document-title");
        modal.addEventListener("cancel", event => {
            event.preventDefault();
            if (!state?.busy) modal.close();
        });
        modal.addEventListener("close", () => { sequence += 1; });
        modal.addEventListener("click", event => {
            if (event.target === modal && !state?.busy) modal.close();
        });
        document.body.appendChild(modal);
    }

    function error(message) {
        const box = modal.querySelector(".document-error");
        if (box) { box.hidden = false; box.textContent = message; box.focus(); }
    }

    function totals() {
        const subtotal = state.items.reduce((sum, item) =>
            sum + Number(item.quantity) * Number(item.unitPrice) - (sale() ? Number(item.discount || 0) : 0), 0);
        const discount = sale() ? Number(modal.querySelector('[name="discount"]')?.value ?? state.doc.discount ?? 0) : 0;
        return { subtotal, discount, final: subtotal - discount };
    }

    function updateTotal() {
        const box = modal.querySelector(".document-total");
        if (box) box.textContent = money(totals().final);
    }

    function renderRows() {
        const editing = state.mode === "edit";
        modal.querySelector("tbody").innerHTML = state.items.map((item, index) => `
            <tr data-line="${index}">
                <td><div class="document-product"><img src="${escape(item.productImageData || "./assets/branding/sales-manager-logo.svg")}" alt=""><div><strong>${escape(item.productName)}</strong><small>${escape(item.productCode)}</small></div></div></td>
                <td>${editing ? `<input aria-label="Số lượng ${escape(item.productName)}" data-field="quantity" type="number" min="1" step="1" required value="${Number(item.quantity)}">` : Number(item.quantity).toLocaleString("vi-VN")}</td>
                <td>${editing ? `<input aria-label="Đơn giá ${escape(item.productName)}" data-field="unitPrice" type="number" min="0" step="any" required value="${Number(item.unitPrice)}">` : money(item.unitPrice)}</td>
                ${sale() ? `<td>${editing ? `<input aria-label="Giảm giá dòng ${escape(item.productName)}" data-field="discount" type="number" min="0" step="any" required value="${Number(item.discount || 0)}">` : money(item.discount)}</td>` : ""}
                <td class="document-line-total">${money(Number(item.quantity) * Number(item.unitPrice) - (sale() ? Number(item.discount || 0) : 0))}</td>
                ${editing ? '<td><button type="button" data-remove aria-label="Bỏ mặt hàng">×</button></td>' : ""}
            </tr>`).join("");
        modal.querySelectorAll("[data-field]").forEach(input => input.addEventListener("input", () => {
            const index = Number(input.closest("tr").dataset.line);
            state.items[index][input.dataset.field] = Number(input.value);
            const item = state.items[index];
            input.closest("tr").querySelector(".document-line-total").textContent = money(item.quantity * item.unitPrice - (sale() ? item.discount || 0 : 0));
            updateTotal();
        }));
        modal.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => {
            state.items.splice(Number(button.closest("tr").dataset.line), 1);
            renderRows(); updateTotal();
        }));
    }

    function render() {
        const doc = state.doc;
        const editing = state.mode === "edit", cancelling = state.mode === "cancel";
        const isSale = sale(), label = isSale ? "hóa đơn" : "phiếu nhập";
        const customerOptions = [{ id: "", name: "Khách lẻ" }, ...(state.customers || [])];
        if (doc.customerId && !customerOptions.some(item => Number(item.id) === Number(doc.customerId))) {
            customerOptions.push({ id: doc.customerId, name: doc.customerName });
        }
        modal.innerHTML = `
            <form class="document-content">
                <header><div><span>${editing ? "SỬA" : cancelling ? "HỦY" : "CHI TIẾT"} ${isSale ? "HÓA ĐƠN" : "PHIẾU NHẬP"}</span><h2 id="document-title">${escape(doc.code)}</h2></div><button type="button" data-close aria-label="Đóng">×</button></header>
                <div class="document-body">
                    <div class="document-error" role="alert" tabindex="-1" hidden></div>
                    <div class="document-meta"><span>Ngày lập: <strong>${escape(new Date(doc.createdAt).toLocaleString("vi-VN"))}</strong></span><span class="document-status ${doc.status === "cancelled" ? "cancelled" : ""}">${doc.status === "cancelled" ? "Đã hủy" : "Hoàn tất"}</span></div>
                    ${doc.status === "cancelled" ? `<div class="document-cancel-info"><strong>Lý do hủy:</strong> ${escape(doc.cancellationReason)}<br><small>Thời gian: ${escape(new Date(doc.cancelledAt).toLocaleString("vi-VN"))}</small></div>` : ""}
                    <div class="document-fields">
                        ${isSale ? `<label>Khách hàng${editing ? `<select name="customerId">${customerOptions.map(customer => `<option value="${Number(customer.id) || ""}" ${String(customer.id) === String(doc.customerId || "") ? "selected" : ""}>${escape(customer.name)}</option>`).join("")}</select>` : `<strong>${escape(doc.customerName)}</strong>`}</label>
                        <label>Thanh toán${editing ? `<select name="paymentMethod">${[["cash", "Tiền mặt"], ["transfer", "Chuyển khoản"], ["other", "Khác"]].map(([key, text]) => `<option value="${key}" ${doc.paymentMethod === key ? "selected" : ""}>${text}</option>`).join("")}</select>` : `<strong>${escape(({ cash: "Tiền mặt", transfer: "Chuyển khoản", other: "Khác" })[doc.paymentMethod] || doc.paymentMethod)}</strong>`}</label>` : `<label>Nhà cung cấp${editing ? `<input name="supplierName" required maxlength="150" value="${escape(doc.supplierName)}">` : `<strong>${escape(doc.supplierName)}</strong>`}</label>`}
                    </div>
                    <div class="document-table"><table><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th>${isSale ? "<th>Giảm giá dòng</th>" : ""}<th>Thành tiền</th>${editing ? "<th></th>" : ""}</tr></thead><tbody></tbody></table></div>
                    ${editing ? `<div class="document-add"><select aria-label="Chọn sản phẩm" data-product><option value="">Chọn sản phẩm cần thêm</option>${state.products.filter(p => !isSale || p.isActive).map(p => `<option value="${p.id}">${escape(p.code)} — ${escape(p.name)} (tồn ${Number(p.stock)})</option>`).join("")}</select><button type="button" data-add>+ Thêm mặt hàng</button></div>` : ""}
                    <div class="document-totals">${isSale ? `<label>Giảm giá hóa đơn${editing ? `<input name="discount" aria-label="Giảm giá hóa đơn" type="number" min="0" step="any" required value="${Number(doc.discount)}">` : `<strong>${money(doc.discount)}</strong>`}</label>` : ""}<div><span>Tổng ${isSale ? "thanh toán" : "giá trị"}</span><strong class="document-total">${money(isSale ? doc.finalAmount : doc.totalAmount)}</strong></div></div>
                    ${editing ? '<p class="document-note">Lưu thay đổi sẽ tự điều chỉnh tồn kho theo chênh lệch số lượng và cập nhật báo cáo.</p>' : ""}
                    ${cancelling ? `<div class="document-cancel-info">${isSale ? "Hàng đã bán sẽ được hoàn lại kho. Hóa đơn này sẽ không còn được tính vào doanh thu." : "Hệ thống sẽ trừ lại số hàng của phiếu nhập. Chỉ hủy được khi tồn kho còn đủ."} Chứng từ vẫn được lưu để tra cứu.</div><label class="document-reason">Lý do hủy<textarea name="reason" minlength="3" maxlength="500" required placeholder="Nhập lý do hủy chứng từ"></textarea></label>` : ""}
                </div>
                <footer><button type="button" data-back>${editing || cancelling ? "Quay lại" : "Đóng"}</button>${editing ? '<button type="submit" class="primary">Lưu thay đổi</button>' : cancelling ? '<button type="submit" class="danger">Xác nhận hủy chứng từ</button>' : canEdit() ? `<button type="button" data-edit class="primary">Sửa ${label}</button><button type="button" data-cancel class="danger-outline">Hủy ${label}</button>` : ""}</footer>
            </form>`;
        renderRows();
        modal.querySelector("[data-close]").onclick = () => { if (!state.busy) modal.close(); };
        modal.querySelector("[data-back]").onclick = () => {
            if (state.busy) return;
            if (state.mode === "view") modal.close();
            else { state.mode = "view"; state.items = structuredClone(doc.items || []); render(); }
        };
        modal.querySelector("[data-edit]")?.addEventListener("click", edit);
        modal.querySelector("[data-cancel]")?.addEventListener("click", () => {
            if (!canEdit()) return;
            state.mode = "cancel"; render(); modal.querySelector("textarea").focus();
        });
        modal.querySelector("[data-add]")?.addEventListener("click", () => {
            const product = state.products.find(p => p.id === Number(modal.querySelector("[data-product]").value));
            if (!product) return;
            if (state.items.some(item => item.productId === product.id)) return error("Sản phẩm đã có trong chứng từ. Hãy sửa số lượng ở dòng tương ứng.");
            state.items.push({ productId: product.id, productCode: product.code, productName: product.name,
                productImageData: product.imageData, quantity: 1, unitPrice: isSale ? product.sellingPrice : product.purchasePrice, discount: 0 });
            renderRows(); updateTotal();
        });
        modal.querySelector('[name="discount"]')?.addEventListener("input", updateTotal);
        modal.querySelector("form").onsubmit = submit;
    }

    async function edit() {
        if (!canEdit() || state.busy) return;
        const version = sequence;
        state.busy = true;
        const editButton = modal.querySelector("[data-edit]");
        editButton.disabled = true;
        try {
            const [products, customers] = await Promise.all([
                window.salesApi.products.list(), sale() ? window.salesApi.customers.list() : Promise.resolve([])
            ]);
            if (version !== sequence || !modal.open || !canEdit()) return;
            Object.assign(state, { products, customers, mode: "edit" });
            render();
        } catch (exc) { if (version === sequence) error(exc.message || "Không thể tải dữ liệu sửa chứng từ."); }
        finally { state.busy = false; if (editButton.isConnected) editButton.disabled = false; }
    }

    async function submit(event) {
        event.preventDefault();
        if (state.busy || !canEdit()) return;
        const version = sequence, context = state;
        let payload;
        if (state.mode === "cancel") {
            const reason = modal.querySelector('[name="reason"]').value.trim();
            if (reason.length < 3) return error("Vui lòng nhập lý do hủy có ít nhất 3 ký tự.");
            payload = reason;
        } else {
            if (!state.items.length) return error("Chứng từ phải có ít nhất một mặt hàng.");
            if (state.items.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 ||
                (sale() && (Number(item.discount || 0) < 0 || Number(item.discount || 0) > item.quantity * item.unitPrice)))) return error("Kiểm tra số lượng, đơn giá và giảm giá từng mặt hàng.");
            const values = totals();
            if (values.discount < 0 || values.final < 0) return error("Giảm giá hóa đơn không được vượt quá tổng tiền.");
            payload = { items: state.items.map(item => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, discount: sale() ? item.discount || 0 : 0 })) };
            if (sale()) Object.assign(payload, { customerId: Number(modal.querySelector('[name="customerId"]').value) || null,
                paymentMethod: modal.querySelector('[name="paymentMethod"]').value, discount: values.discount });
            else payload.supplierName = modal.querySelector('[name="supplierName"]').value.trim();
        }
        state.busy = true;
        modal.querySelectorAll("button,input,select,textarea").forEach(el => { el.disabled = true; });
        try {
            if (!await window.appConfirm(state.mode === "cancel" ? `Hủy ${state.doc.code}? ${sale() ? "Hệ thống sẽ hoàn hàng về kho và loại hóa đơn khỏi doanh thu." : "Hệ thống sẽ trừ lại hàng trong kho."}` : `Lưu thay đổi ${state.doc.code} và điều chỉnh tồn kho tương ứng?`)) return;
            if (version !== sequence || !modal.open || !canEdit()) return;
            const result = context.mode === "cancel"
                ? await window.salesApi[context.kind].cancel(context.doc.id, payload)
                : await window.salesApi[context.kind].update(context.doc.id, payload);
            document.dispatchEvent(new CustomEvent("sales:document-changed", { detail: { kind: context.kind, id: context.doc.id } }));
            window.appNotify(context.mode === "cancel" ? "Đã hủy chứng từ và cập nhật tồn kho." : "Đã lưu chứng từ và cập nhật tồn kho.");
            if (version !== sequence || !modal.open) return;
            context.doc = result; context.items = structuredClone(result.items || []); context.mode = "view";
            render();
        } catch (exc) { if (version === sequence && modal.open) error(exc.message || "Không thể cập nhật chứng từ."); }
        finally {
            context.busy = false;
            if (version === sequence && modal.open) modal.querySelectorAll("button,input,select,textarea").forEach(el => { el.disabled = false; });
        }
    }

    window.openSalesDocument = async function (kind, id) {
        if (!["invoices", "purchases"].includes(kind) || state?.busy) return;
        ensureModal();
        const version = ++sequence;
        const token = window.getAuthAccessToken?.();
        modal.innerHTML = '<div class="document-loading" role="status">Đang tải chứng từ…</div>';
        if (!modal.open) modal.showModal();
        try {
            const doc = await window.salesApi[kind].get(id);
            if (version !== sequence || !modal.open || token !== window.getAuthAccessToken?.()) return;
            state = { kind, doc, mode: "view", items: structuredClone(doc.items || []), busy: false };
            render();
        } catch (exc) {
            if (version !== sequence) return;
            modal.close(); window.appNotify(exc.message || "Không thể tải chứng từ.");
        }
    };
})();
