/* ============================================================
   CATEGORY MANAGEMENT - PART 6
   ============================================================ */


/* ============================================================
   MOCK DATA
   ============================================================ */

let categories = [

    {
        id: 1,
        name: "Đồ uống",
        description: "Nước uống, nước ngọt và các loại đồ uống",
        isActive: true
    },

    {
        id: 2,
        name: "Thực phẩm",
        description: "Các sản phẩm thực phẩm tiêu dùng",
        isActive: true
    },

    {
        id: 3,
        name: "Hàng gia dụng",
        description: "Các sản phẩm phục vụ sinh hoạt gia đình",
        isActive: true
    },

    {
        id: 4,
        name: "Vật tư",
        description: "Vật tư và dụng cụ tiêu dùng",
        isActive: true
    },

    {
        id: 5,
        name: "Thiết bị điện",
        description: "Quạt điện, nồi cơm điện và thiết bị điện",
        isActive: true
    },

    {
        id: 6,
        name: "Chăm sóc cá nhân",
        description: "Các sản phẩm chăm sóc cá nhân",
        isActive: true
    },

    {
        id: 7,
        name: "Văn phòng phẩm",
        description: "Các sản phẩm văn phòng phẩm",
        isActive: false
    }

];


let categoryCurrentPage = 1;

const categoryPageSize = 6;

let categoryEditingId = null;


/* ============================================================
   FILTER
   ============================================================ */

function getFilteredCategories() {

    const searchInput =
        document.getElementById(
            "category-search-input"
        );

    const statusFilter =
        document.getElementById(
            "category-status-filter"
        );


    const keyword =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";


    const status =
        statusFilter
            ? statusFilter.value
            : "all";


    return categories.filter(category => {
        const matchesSearch = category.name.toLowerCase().includes(keyword) ||
            category.description.toLowerCase().includes(keyword);
        let matchesStatus = true;
        if (status === "active") {
            matchesStatus = category.isActive === true;
        }
        if (status === "inactive") {
            matchesStatus = category.isActive === false;
        }
        return matchesSearch &&
               matchesStatus;
    });

}


/* ============================================================
   RENDER CATEGORY TABLE
   ============================================================ */

function renderCategories() {

    const tableBody =
        document.getElementById(
            "category-table-body"
        );

    const countElement =
        document.getElementById(
            "category-count"
        );


    if (!tableBody) {
        return;
    }


    const filteredCategories =
        getFilteredCategories();


    if (countElement) {

        countElement.textContent =
            `${filteredCategories.length} danh mục`;

    }


    const totalPages =
        Math.ceil(
            filteredCategories.length /
            categoryPageSize
        );


    if (
        categoryCurrentPage >
        totalPages &&
        totalPages > 0
    ) {

        categoryCurrentPage =
            totalPages;

    }


    const start =
        (categoryCurrentPage - 1) *
        categoryPageSize;


    const pageCategories =
        filteredCategories.slice(
            start,
            start + categoryPageSize
        );


    tableBody.innerHTML = "";


    if (pageCategories.length === 0) {

        tableBody.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="category-empty"
                >

                    <strong>
                        Không tìm thấy danh mục
                    </strong>

                    <span>
                        Hãy thử thay đổi từ khóa tìm kiếm.
                    </span>

                </td>

            </tr>

        `;

        renderCategoryPagination(
            filteredCategories.length
        );

        return;
    }


    pageCategories.forEach(
        category => {

            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${category.id}
                </td>

                <td>
                    <strong>
                        ${category.name}
                    </strong>
                </td>

                <td>
                    ${category.description || "-"}
                </td>

                <td>

                    <span
                        class="category-status ${
                            category.isActive
                                ? "active"
                                : "inactive"
                        }"
                    >

                        ${
                            category.isActive
                                ? "Đang hoạt động"
                                : "Ngừng hoạt động"
                        }

                    </span>

                </td>

                <td>

                    <div class="category-actions">

                        <button
                            class="category-action-button edit"
                            onclick="editCategory(${category.id})"
                        >
                            Sửa
                        </button>

                        <button
                            class="category-action-button toggle"
                            onclick="toggleCategoryStatus(${category.id})"
                        >
                            ${
                                category.isActive
                                    ? "Ngừng"
                                    : "Kích hoạt"
                            }
                        </button>

                    </div>

                </td>

            `;


            tableBody.appendChild(row);

        }
    );


    renderCategoryPagination(
        filteredCategories.length
    );

}


/* ============================================================
   PAGINATION
   ============================================================ */

function renderCategoryPagination(
    totalItems
) {

    const info =
        document.getElementById(
            "category-pagination-info"
        );

    const buttons =
        document.getElementById(
            "category-pagination-buttons"
        );


    if (!buttons) {
        return;
    }


    buttons.innerHTML = "";


    const totalPages =
        Math.ceil(
            totalItems /
            categoryPageSize
        );


    if (totalItems === 0) {

        if (info) {
            info.textContent =
                "Không có danh mục";
        }

        return;

    }


    const start =
        (categoryCurrentPage - 1) *
        categoryPageSize + 1;


    const end =
        Math.min(
            categoryCurrentPage *
            categoryPageSize,
            totalItems
        );


    if (info) {

        info.textContent =
            `Hiển thị ${start}-${end} / ${totalItems}`;

    }


    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        const button =
            document.createElement(
                "button"
            );


        button.className =
            "category-page-button";


        if (
            page ===
            categoryCurrentPage
        ) {

            button.classList.add(
                "active"
            );

        }


        button.textContent =
            page;


        button.addEventListener(
            "click",
            function () {

                categoryCurrentPage =
                    page;

                renderCategories();

            }
        );


        buttons.appendChild(
            button
        );

    }

}


/* ============================================================
   OPEN ADD MODAL
   ============================================================ */

function openAddCategoryModal() {

    // KIỂM TRA PHÂN QUYỀN
    if (
        typeof requirePermission === "function" &&
        !requirePermission("product_manage")
    ) {
        return;
    }

    categoryEditingId = null;


    const modal =
        document.getElementById(
            "category-modal"
        );

    const title =
        document.getElementById(
            "category-modal-title"
        );

    const form =
        document.getElementById(
            "category-form"
        );


    if (!modal || !form) {
        return;
    }


    form.reset();


    if (title) {

        title.textContent =
            "Thêm danh mục";

    }


    modal.classList.add(
        "active"
    );

}


/* ============================================================
   EDIT CATEGORY
   ============================================================ */

function editCategory(id) {

    // KIỂM TRA PHÂN QUYỀN
    if (
        typeof requirePermission === "function" &&
        !requirePermission("product_manage")
    ) {
        return;
    }

    const category =
        categories.find(
            item =>
                item.id === id
        );


    if (!category) {
        return;
    }


    categoryEditingId =
        id;


    const modal =
        document.getElementById(
            "category-modal"
        );

    const title =
        document.getElementById(
            "category-modal-title"
        );

    const nameInput =
        document.getElementById(
            "category-name"
        );

    const descriptionInput =
        document.getElementById(
            "category-description"
        );


    if (!modal) {
        return;
    }


    if (title) {

        title.textContent =
            "Sửa danh mục";

    }


    if (nameInput) {

        nameInput.value =
            category.name;

    }


    if (descriptionInput) {

        descriptionInput.value =
            category.description;

    }


    modal.classList.add(
        "active"
    );

}


/* ============================================================
   CLOSE MODAL
   ============================================================ */

function closeCategoryModal() {

    const modal =
        document.getElementById(
            "category-modal"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );

    }


    categoryEditingId = null;

}


/* ============================================================
   SAVE CATEGORY
   ============================================================ */

function saveCategory(event) {

    event.preventDefault();

    // KIỂM TRA PHÂN QUYỀN
    if (
        typeof requirePermission === "function" &&
        !requirePermission("product_manage")
    ) {
        return;
    }


    const nameInput =
        document.getElementById(
            "category-name"
        );

    const descriptionInput =
        document.getElementById(
            "category-description"
        );


    const name =
        nameInput
            ? nameInput.value.trim()
            : "";


    const description =
        descriptionInput
            ? descriptionInput.value.trim()
            : "";


    if (!name) {

        alert(
            "Vui lòng nhập tên danh mục."
        );

        return;

    }


    const duplicate =
        categories.some(
            category =>

                category.name
                    .toLowerCase() ===
                name.toLowerCase() &&

                category.id !==
                categoryEditingId
        );


    if (duplicate) {

        alert(
            "Tên danh mục đã tồn tại."
        );

        return;

    }


    if (
        categoryEditingId ===
        null
    ) {

        const newId =
            categories.length > 0
                ? Math.max(
                    ...categories.map(
                        category =>
                            category.id
                    )
                ) + 1
                : 1;


        categories.push({

            id: newId,

            name: name,

            description:
                description,

            isActive: true

        });


        alert(
            "Thêm danh mục thành công."
        );

    } else {

        const category =
            categories.find(
                item =>
                    item.id ===
                    categoryEditingId
            );


        if (category) {

            category.name =
                name;

            category.description =
                description;

        }


        alert(
            "Cập nhật danh mục thành công."
        );

    }


    closeCategoryModal();

    renderCategories();

}


/* ============================================================
   TOGGLE STATUS
   ============================================================ */

function toggleCategoryStatus(id) {

    // KIỂM TRA PHÂN QUYỀN
    if (
        typeof requirePermission === "function" &&
        !requirePermission("product_manage")
    ) {
        return;
    }

    const category =
        categories.find(
            item =>
                item.id === id
        );


    if (!category) {
        return;
    }


    const action =
        category.isActive
            ? "ngừng hoạt động"
            : "kích hoạt";


    const confirmed =
        confirm(
            `Bạn có chắc muốn ${action} danh mục "${category.name}"?`
        );


    if (!confirmed) {
        return;
    }


    category.isActive =
        !category.isActive;


    renderCategories();

}


/* ============================================================
   FILTER EVENTS
   ============================================================ */

function setupCategoryFilters() {

    const searchInput =
        document.getElementById(
            "category-search-input"
        );

    const statusFilter =
        document.getElementById(
            "category-status-filter"
        );


    if (
        typeof hasCurrentUserPermission === "function" &&
        !hasCurrentUserPermission("search_filter")
    ) {
        return;
    }


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function () {

                categoryCurrentPage =
                    1;

                renderCategories();

            }
        );

    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            function () {

                categoryCurrentPage =
                    1;

                renderCategories();

            }
        );

    }

}


/* ============================================================
   MODAL EVENTS
   ============================================================ */

function setupCategoryModal() {

    const addButton =
        document.getElementById(
            "add-category-button"
        );

    const closeButton =
        document.getElementById(
            "category-modal-close"
        );

    const cancelButton =
        document.getElementById(
            "category-cancel-button"
        );

    const form =
        document.getElementById(
            "category-form"
        );

    const modal =
        document.getElementById(
            "category-modal"
        );


    if (addButton) {

        addButton.addEventListener(
            "click",
            openAddCategoryModal
        );

    }


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeCategoryModal
        );

    }


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            closeCategoryModal
        );

    }


    if (form) {

        form.addEventListener(
            "submit",
            saveCategory
        );

    }


    if (modal) {

        modal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    modal
                ) {

                    closeCategoryModal();

                }

            }
        );

    }

}


/* ============================================================
   INIT CATEGORY MANAGEMENT
   ============================================================ */

function initCategoryManagement() {

    // KIỂM TRA PHÂN QUYỀN
    if (
        typeof requirePermission === "function" &&
        !requirePermission("product_manage")
    ) {
        return;
    }

    categoryCurrentPage = 1;

    setupCategoryFilters();

    setupCategoryModal();

    renderCategories();

}