/* Category management backed by the REST API. */
let categories = [];
let categoryCurrentPage = 1;
const categoryPageSize = 6;
let categoryEditingId = null;
let categoryEventsInitialized = false;
let categoryImageData = null;
let categoryDetailReturnFocus = null;
let activeCategoryDetailId = null;

const CATEGORY_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const CATEGORY_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function escapeCategoryHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getCategoryImageSource(name, imageData = null) {
    return imageData || "./assets/branding/sales-manager-logo.svg";
}

function updateCategoryImagePreview() {
    const preview = document.getElementById("category-image-preview");
    if (!preview) return;
    const name = document.getElementById("category-name")?.value || "";
    preview.src = getCategoryImageSource(name, categoryImageData);
}

function readCategoryImage(file) {
    if (!CATEGORY_IMAGE_TYPES.has(file.type)) {
        alert("Vui lòng chọn ảnh PNG, JPG hoặc WebP.");
        return;
    }
    if (file.size > CATEGORY_IMAGE_MAX_BYTES) {
        alert("Kích thước ảnh không được vượt quá 2 MB.");
        return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
        categoryImageData = String(reader.result || "");
        updateCategoryImagePreview();
    });
    reader.addEventListener("error", () => alert("Không thể đọc tệp ảnh đã chọn."));
    reader.readAsDataURL(file);
}

async function loadCategoriesFromAPI() {
    try {
        categories = (await window.salesApi.categories.list()).sort(
            (a, b) => Number(b.id) - Number(a.id)
        );
    } catch (error) {
        categories = [];
        console.error("Không thể tải danh mục:", error);
        if (error.status === 401) return;
        alert(error.message || "Không thể tải danh mục từ máy chủ.");
    }
}

function getFilteredCategories() {
    const keyword = (document.getElementById("category-search-input")?.value || "")
        .trim().toLowerCase();
    const status = document.getElementById("category-status-filter")?.value || "all";
    return categories.filter(category => {
        const matchesSearch = !keyword || category.name.toLowerCase().includes(keyword) ||
            (category.description || "").toLowerCase().includes(keyword);
        const matchesStatus = status === "all" ||
            (status === "active" && category.isActive) ||
            (status === "inactive" && !category.isActive);
        return matchesSearch && matchesStatus;
    });
}

function renderCategories() {
    const tableBody = document.getElementById("category-table-body");
    const countElement = document.getElementById("category-count");
    if (!tableBody) return;
    const filtered = getFilteredCategories();
    if (countElement) countElement.textContent = `${filtered.length} danh mục`;
    const totalPages = Math.max(1, Math.ceil(filtered.length / categoryPageSize));
    categoryCurrentPage = Math.min(categoryCurrentPage, totalPages);
    const start = (categoryCurrentPage - 1) * categoryPageSize;
    const page = filtered.slice(start, start + categoryPageSize);
    if (!page.length) {
        tableBody.innerHTML = `<tr><td colspan="5" class="category-empty">
            <strong>Không tìm thấy danh mục</strong><span>Hãy thử thay đổi từ khóa tìm kiếm.</span>
        </td></tr>`;
        renderCategoryPagination(0);
        return;
    }
    tableBody.innerHTML = page.map(category => `<tr>
        <td>${category.id}</td>
        <td>
            <div
                class="category-visual category-detail-trigger"
                role="button"
                tabindex="0"
                onclick="openCategoryDetail(${category.id})"
                onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCategoryDetail(${category.id}); }"
                title="Xem chi tiết ${escapeCategoryHtml(category.name)}"
                aria-label="Xem chi tiết danh mục ${escapeCategoryHtml(category.name)}"
            >
                <span class="category-thumbnail-frame">
                    <img class="category-thumbnail" src="${escapeCategoryHtml(getCategoryImageSource(category.name, category.imageData))}" alt="" loading="lazy">
                </span>
                <span class="category-name-copy">
                    <strong>${escapeCategoryHtml(category.name)}</strong>
                    <small>Nhóm sản phẩm</small>
                </span>
                <span class="category-detail-arrow" aria-hidden="true">›</span>
            </div>
        </td>
        <td>${escapeCategoryHtml(category.description || "-")}</td>
        <td><span class="category-status ${category.isActive ? "active" : "inactive"}">
            ${category.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
        </span></td>
        <td><div class="category-actions">
            <button class="category-action-button edit" onclick="editCategory(${category.id})">Sửa</button>
            <button class="category-action-button toggle" onclick="toggleCategoryStatus(${category.id})">
                ${category.isActive ? "Ngừng" : "Kích hoạt"}
            </button>
            <button class="category-action-button delete" onclick="deleteCategory(${category.id})">Xóa</button>
        </div></td>
    </tr>`).join("");
    renderCategoryPagination(filtered.length);
}

function renderCategoryPagination(totalItems) {
    const info = document.getElementById("category-pagination-info");
    const buttons = document.getElementById("category-pagination-buttons");
    if (!buttons) return;
    buttons.innerHTML = "";
    if (!totalItems) {
        if (info) info.textContent = "Không có danh mục";
        return;
    }
    const totalPages = Math.ceil(totalItems / categoryPageSize);
    const start = (categoryCurrentPage - 1) * categoryPageSize + 1;
    const end = Math.min(categoryCurrentPage * categoryPageSize, totalItems);
    if (info) info.textContent = `Hiển thị ${start}-${end} / ${totalItems}`;
    for (let page = 1; page <= totalPages; page += 1) {
        const button = document.createElement("button");
        button.className = "category-page-button" + (page === categoryCurrentPage ? " active" : "");
        button.textContent = page;
        button.addEventListener("click", () => {
            categoryCurrentPage = page;
            renderCategories();
        });
        buttons.appendChild(button);
    }
}

function openAddCategoryModal() {
    if (typeof requirePermission === "function" && !requirePermission("product_manage")) return;
    categoryEditingId = null;
    const modal = document.getElementById("category-modal");
    const form = document.getElementById("category-form");
    if (!modal || !form) return;
    form.reset();
    categoryImageData = null;
    updateCategoryImagePreview();
    const title = document.getElementById("category-modal-title");
    if (title) title.textContent = "Thêm danh mục";
    modal.classList.add("active");
}

function editCategory(id) {
    if (typeof requirePermission === "function" && !requirePermission("product_manage")) return;
    const category = categories.find(item => item.id === id);
    if (!category) return;
    categoryEditingId = id;
    const title = document.getElementById("category-modal-title");
    const name = document.getElementById("category-name");
    const description = document.getElementById("category-description");
    if (title) title.textContent = "Sửa danh mục";
    if (name) name.value = category.name;
    if (description) description.value = category.description || "";
    categoryImageData = category.imageData || null;
    updateCategoryImagePreview();
    document.getElementById("category-modal")?.classList.add("active");
}

function closeCategoryModal() {
    document.getElementById("category-modal")?.classList.remove("active");
    categoryEditingId = null;
}

async function saveCategory(event) {
    event.preventDefault();
    if (typeof requirePermission === "function" && !requirePermission("product_manage")) return;
    const name = (document.getElementById("category-name")?.value || "").trim();
    const description = (document.getElementById("category-description")?.value || "").trim();
    if (!name) {
        alert("Vui lòng nhập tên danh mục.");
        return;
    }
    if (categories.some(item => item.id !== categoryEditingId && item.name.toLowerCase() === name.toLowerCase())) {
        alert("Tên danh mục đã tồn tại.");
        return;
    }
    try {
        if (categoryEditingId === null) {
            await window.salesApi.categories.create({
                name, description, isActive: true, imageData: categoryImageData
            });
            alert("Thêm danh mục thành công.");
        } else {
            await window.salesApi.categories.update(categoryEditingId, {
                name, description, imageData: categoryImageData
            });
            alert("Cập nhật danh mục thành công.");
        }
        closeCategoryModal();
        await loadCategoriesFromAPI();
        renderCategories();
    } catch (error) {
        alert(error.message || "Không thể lưu danh mục.");
    }
}

async function toggleCategoryStatus(id) {
    if (typeof requirePermission === "function" && !requirePermission("product_manage")) return;
    const category = categories.find(item => item.id === id);
    if (!category) return;
    const action = category.isActive ? "ngừng hoạt động" : "kích hoạt";
    if (!confirm(`Bạn có chắc muốn ${action} danh mục "${category.name}"?`)) return;
    try {
        const updated = await window.salesApi.categories.update(id, { isActive: !category.isActive });
        categories = categories.map(item => item.id === id ? updated : item);
        renderCategories();
    } catch (error) {
        alert(error.message || "Không thể cập nhật trạng thái danh mục.");
    }
}

async function deleteCategory(id) {
    if (typeof requirePermission === "function" && !requirePermission("product_manage")) return;
    const category = categories.find(item => item.id === id);
    if (!category || !confirm(`Xóa vĩnh viễn danh mục "${category.name}"?`)) return;
    try {
        await window.salesApi.categories.remove(id);
        categories = categories.filter(item => item.id !== id);
        renderCategories();
        alert("Đã xóa danh mục.");
    } catch (error) {
        alert(error.message || "Không thể xóa danh mục.");
    }
}

async function openCategoryDetail(id) {
    const category = categories.find(item => Number(item.id) === Number(id));
    const modal = document.getElementById("category-detail-modal");
    const content = document.getElementById("category-detail-content");
    if (!category || !modal || !content) return;

    activeCategoryDetailId = Number(category.id);
    content.innerHTML = `
        <div class="category-detail-showcase">
            <div class="category-detail-image-wrap">
                <img
                    src="${escapeCategoryHtml(getCategoryImageSource(category.name, category.imageData))}"
                    alt="${escapeCategoryHtml(category.name)}"
                >
            </div>
            <div class="category-detail-identity">
                <div class="category-detail-badges">
                    <span class="category-detail-code">DM${String(category.id).padStart(3, "0")}</span>
                    <span class="category-detail-business ${category.isActive ? "active" : "inactive"}">
                        ${category.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
                    </span>
                </div>
                <h3>${escapeCategoryHtml(category.name)}</h3>
                <p>${escapeCategoryHtml(category.description || "Danh mục chưa có mô tả.")}</p>
            </div>
        </div>
        <div class="category-detail-summary">
            <article>
                <span>Mã danh mục</span>
                <strong>#${category.id}</strong>
            </article>
            <article>
                <span>Loại dữ liệu</span>
                <strong>Nhóm sản phẩm</strong>
            </article>
            <article>
                <span>Sản phẩm thuộc danh mục</span>
                <strong id="category-detail-product-count">Đang tải...</strong>
            </article>
        </div>
    `;

    categoryDetailReturnFocus = document.activeElement;
    modal.hidden = false;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("category-detail-open");
    document.getElementById("category-detail-close")?.focus();

    try {
        const productItems = await window.salesApi.products.list();
        if (activeCategoryDetailId !== Number(category.id)) return;
        const count = productItems.filter(product => product.category === category.name).length;
        const countElement = document.getElementById("category-detail-product-count");
        if (countElement) countElement.textContent = `${count} sản phẩm`;
    } catch (error) {
        const countElement = document.getElementById("category-detail-product-count");
        if (countElement && activeCategoryDetailId === Number(category.id)) {
            countElement.textContent = "Chưa xác định";
        }
    }
}

function closeCategoryDetail() {
    const modal = document.getElementById("category-detail-modal");
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    modal.hidden = true;
    document.body.classList.remove("category-detail-open");
    activeCategoryDetailId = null;
    if (categoryDetailReturnFocus instanceof HTMLElement) {
        categoryDetailReturnFocus.focus();
    }
    categoryDetailReturnFocus = null;
}

function setupCategoryFilters() {
    document.getElementById("category-search-input")?.addEventListener("input", () => {
        categoryCurrentPage = 1;
        renderCategories();
    });
    document.getElementById("category-status-filter")?.addEventListener("change", () => {
        categoryCurrentPage = 1;
        renderCategories();
    });
}

function setupCategoryModal() {
    document.getElementById("add-category-button")?.addEventListener("click", openAddCategoryModal);
    document.getElementById("category-modal-close")?.addEventListener("click", closeCategoryModal);
    document.getElementById("category-cancel-button")?.addEventListener("click", closeCategoryModal);
    document.getElementById("category-form")?.addEventListener("submit", saveCategory);
    document.getElementById("category-image-input")?.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (file) readCategoryImage(file);
        event.target.value = "";
    });
    document.getElementById("category-image-remove")?.addEventListener("click", () => {
        categoryImageData = null;
        updateCategoryImagePreview();
    });
    document.getElementById("category-name")?.addEventListener("input", () => {
        if (!categoryImageData) updateCategoryImagePreview();
    });
    document.getElementById("category-modal")?.addEventListener("click", event => {
        if (event.target.id === "category-modal") closeCategoryModal();
    });
    document.getElementById("category-detail-close")?.addEventListener("click", closeCategoryDetail);
    document.getElementById("category-detail-modal")?.addEventListener("click", event => {
        if (event.target.id === "category-detail-modal") closeCategoryDetail();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeCategoryDetail();
    });
}

async function initCategoryManagement() {
    if (typeof requirePermission === "function" && !requirePermission("product_manage")) return;
    categoryCurrentPage = 1;
    if (!categoryEventsInitialized) {
        setupCategoryFilters();
        setupCategoryModal();
        categoryEventsInitialized = true;
    }
    await loadCategoriesFromAPI();
    renderCategories();
}
