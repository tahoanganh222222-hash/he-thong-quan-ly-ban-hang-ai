let purchaseSuppliers = [];
let suppliersLoadFailed = false;
let supplierEditingId = null;

function renderPurchaseSuppliers(selectedId) {
    const select = document.getElementById("purchase-supplier");
    if (!select) return;
    const selected = selectedId == null ? select.value : String(selectedId);
    select.innerHTML = '<option value="">-- Chọn nhà cung cấp --</option>' + purchaseSuppliers
        .filter(item => item.isActive)
        .map(item => `<option value="${Number(item.id)}">${escapePurchaseHTML(item.name)}</option>`).join("");
    select.disabled = suppliersLoadFailed;
    select.value = selected;
    if (suppliersLoadFailed) select.innerHTML = '<option value="">Không tải được nhà cung cấp</option>';
    else if (!purchaseSuppliers.some(item => item.isActive)) select.innerHTML = '<option value="">Chưa có nhà cung cấp hoạt động — xem tab Nhà cung cấp</option>';
    renderSupplierList();
}

function renderSupplierList() {
    const body = document.getElementById("supplier-table-body");
    if (!body) return;
    const keyword = normalizePurchaseText(document.getElementById("supplier-search")?.value || "");
    const items = purchaseSuppliers.filter(item => normalizePurchaseText(`${item.name} ${item.phone} ${item.email}`).includes(keyword));
    document.getElementById("supplier-count").textContent = `${items.length} nhà cung cấp`;
    body.innerHTML = items.map(item => `<tr>
        <td><strong>${escapePurchaseHTML(item.name)}</strong><small>NCC${String(item.id).padStart(3, "0")} · ${item.isActive ? "Đang hoạt động" : "Đã khóa"}</small></td>
        <td>${escapePurchaseHTML(item.phone || "—")}<small>${escapePurchaseHTML(item.email || "")}</small></td>
        <td>${escapePurchaseHTML(item.address || "—")}</td>
        <td><div class="supplier-actions">${item.isActive ? `<button type="button" data-use-supplier="${Number(item.id)}">Chọn nhập hàng</button>` : ""}<button type="button" data-edit-supplier="${Number(item.id)}">Sửa</button><button type="button" data-lock-supplier="${Number(item.id)}">${item.isActive ? "Khóa" : "Mở khóa"}</button></div></td>
    </tr>`).join("") || `<tr><td colspan="4">${suppliersLoadFailed ? "Không tải được danh sách. Hãy mở lại mục Nhập hàng." : "Chưa có nhà cung cấp phù hợp."}</td></tr>`;
}

async function loadPurchaseSuppliers() {
    try {
        purchaseSuppliers = await window.salesApi.suppliers.list();
        suppliersLoadFailed = false;
    } catch (error) {
        purchaseSuppliers = [];
        suppliersLoadFailed = true;
        window.appNotify(error.message || "Không thể tải nhà cung cấp.");
    }
    renderPurchaseSuppliers();
}

function resetSupplierForm() {
    supplierEditingId = null;
    document.getElementById("supplier-form").reset();
    document.getElementById("supplier-form-title").textContent = "Thêm nhà cung cấp";
    document.getElementById("supplier-save").textContent = "Lưu nhà cung cấp";
    document.getElementById("supplier-cancel-edit").hidden = true;
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("supplier-reload")?.addEventListener("click", async event => {
        event.currentTarget.disabled = true;
        try { await loadPurchaseSuppliers(); }
        finally { document.getElementById("supplier-reload").disabled = false; }
    });
    document.getElementById("supplier-cancel-edit")?.addEventListener("click", resetSupplierForm);
    document.getElementById("supplier-search")?.addEventListener("input", renderSupplierList);
    document.getElementById("supplier-table-body")?.addEventListener("click", async event => {
        if (typeof requirePermission === "function" && !requirePermission("purchase_track")) return;
        const edit = event.target.closest("[data-edit-supplier]");
        const lock = event.target.closest("[data-lock-supplier]");
        if (edit) {
            if (document.getElementById("supplier-save").disabled) return;
            const supplier = purchaseSuppliers.find(item => item.id === Number(edit.dataset.editSupplier));
            if (!supplier) return;
            supplierEditingId = supplier.id;
            for (const key of ["name", "phone", "email", "address"]) document.getElementById(`supplier-${key}`).value = supplier[key] || "";
            document.getElementById("supplier-form-title").textContent = "Sửa nhà cung cấp";
            document.getElementById("supplier-save").textContent = "Lưu thay đổi";
            document.getElementById("supplier-cancel-edit").hidden = false;
            document.getElementById("supplier-name").focus();
            return;
        }
        if (lock) {
            const supplier = purchaseSuppliers.find(item => item.id === Number(lock.dataset.lockSupplier));
            if (!supplier || lock.disabled) return;
            if (!(await window.appConfirm(`${supplier.isActive ? "Khóa" : "Mở khóa"} nhà cung cấp "${supplier.name}"? ${supplier.isActive ? "Nhà cung cấp bị khóa sẽ không được chọn cho phiếu nhập mới." : ""}`))) return;
            lock.disabled = true;
            try {
                const updated = await window.salesApi.suppliers.update(supplier.id, {isActive: !supplier.isActive});
                purchaseSuppliers = purchaseSuppliers.map(item => item.id === updated.id ? updated : item);
                renderPurchaseSuppliers();
                window.appNotify(updated.isActive ? "Đã mở khóa nhà cung cấp." : "Đã khóa nhà cung cấp.");
            } catch (error) { window.appNotify(error.message || "Không thể cập nhật nhà cung cấp."); }
            finally { lock.disabled = false; }
            return;
        }
        const button = event.target.closest("[data-use-supplier]");
        if (!button) return;
        renderPurchaseSuppliers(button.dataset.useSupplier);
        document.querySelector('[data-purchase-view="create"]').click();
        document.getElementById("purchase-supplier").focus();
    });
    document.getElementById("supplier-form")?.addEventListener("submit", async event => {
        event.preventDefault();
        if (typeof requirePermission === "function" && !requirePermission("purchase_track")) return;
        const button = document.getElementById("supplier-save");
        if (button.disabled) return;
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form));
        if (!data.name.trim()) { window.appNotify("Vui lòng nhập tên nhà cung cấp."); return; }
        button.disabled = true;
        document.getElementById("supplier-cancel-edit").disabled = true;
        button.textContent = "Đang lưu...";
        try {
            const editing = supplierEditingId !== null;
            const supplier = editing ? await window.salesApi.suppliers.update(supplierEditingId, data) : await window.salesApi.suppliers.create(data);
            if (editing) purchaseSuppliers = purchaseSuppliers.map(item => item.id === supplier.id ? supplier : item);
            else purchaseSuppliers.unshift(supplier);
            suppliersLoadFailed = false;
            renderPurchaseSuppliers(supplier.id);
            resetSupplierForm();
            window.appNotify(editing ? "Đã cập nhật nhà cung cấp." : "Đã thêm nhà cung cấp. Chọn Nhập hàng để lập phiếu với nhà cung cấp này.");
        } catch (error) {
            window.appNotify(error.message || "Không thể thêm nhà cung cấp.");
        } finally {
            button.disabled = false;
            document.getElementById("supplier-cancel-edit").disabled = false;
            button.textContent = supplierEditingId === null ? "Lưu nhà cung cấp" : "Lưu thay đổi";
        }
    });
});
