/* =========================================================
   AI01 - TƯ VẤN SẢN PHẨM

   Dữ liệu sản phẩm và tồn kho được tải từ REST API.
   ========================================================= */

(function () {

    "use strict";


    /* =========================================================
       REAL PRODUCTS
       ========================================================= */

    let aiProducts = [];

    async function loadAIProducts() {

        if (!window.salesApi?.products) {
            throw new Error("API sản phẩm chưa sẵn sàng.");
        }

        const products =
            await window.salesApi.products.list();

        aiProducts =
            products
                .filter(product => product.isActive !== false)
                .map(product => ({
                    id: product.id,
                    code: product.code || "",
                    name: product.name || "Sản phẩm",
                    category: product.category || "",
                    sellingPrice: Number(product.sellingPrice || 0),
                    unit: product.unit || "",
                    stock: Number(product.stock || 0)
                }));

        return aiProducts;
    }


    /* =========================================================
       FORMAT MONEY
       ========================================================= */

    function formatAIMoney(value) {

        return Number(value || 0)
            .toLocaleString("vi-VN")
            + " ₫";
    }


    /* =========================================================
       GET ELEMENT
       ========================================================= */

    function getElement(id) {

        return document.getElementById(id);
    }


    function escapeAIHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function formatAIText(value) {
        return escapeAIHtml(value).replace(/\r?\n/g, "<br>");
    }


    /* =========================================================
       NORMALIZE TEXT
       ========================================================= */

    function normalizeText(text) {

        return String(text || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }


    /* =========================================================
       EXTRACT PRICE FROM NEED
       ========================================================= */

    function extractBudget(text) {

        const normalized =
            normalizeText(text);

        /*
         * Ví dụ:
         *
         * "dưới 600 nghìn"
         * "duoi 600k"
         * "gia 500000"
         */

        const millionMatch =
            normalized.match(
                /(\d+(?:[.,]\d+)?)\s*(trieu|trieu dong|tr)/
            );

        if (millionMatch) {

            return Number(
                millionMatch[1]
                    .replace(",", ".")
            ) * 1000000;
        }


        const thousandMatch =
            normalized.match(
                /(\d+(?:[.,]\d+)?)\s*(nghin|nghin dong|k)/
            );

        if (thousandMatch) {

            return Number(
                thousandMatch[1]
                    .replace(",", ".")
            ) * 1000;
        }


        const normalMatch =
            normalized.match(
                /(\d{4,8})\s*(dong|d)?/
            );

        if (normalMatch) {

            return Number(
                normalMatch[1]
            );
        }


        return null;
    }


    /* =========================================================
       FIND CATEGORY KEYWORDS
       ========================================================= */

    function getCategoryKeywords(text) {

        const normalized =
            normalizeText(text);

        const keywords = [];


        if (
            normalized.includes("quat") ||
            normalized.includes("lam mat") ||
            normalized.includes("phong nong")
        ) {

            keywords.push(
                "quat",
                "thiet bi dien"
            );
        }


        if (
            normalized.includes("may say") ||
            normalized.includes("say toc")
        ) {

            keywords.push(
                "may say",
                "thiet bi dien"
            );
        }


        if (
            normalized.includes("nuoc") ||
            normalized.includes("uong") ||
            normalized.includes("giai khat")
        ) {

            keywords.push(
                "nuoc",
                "do uong"
            );
        }


        if (
            normalized.includes("mi") ||
            normalized.includes("an") ||
            normalized.includes("thuc pham")
        ) {

            keywords.push(
                "mi",
                "thuc pham"
            );
        }


        if (
            normalized.includes("giat") ||
            normalized.includes("ve sinh")
        ) {

            keywords.push(
                "giat",
                "hang gia dung"
            );
        }


        if (
            normalized.includes("den") ||
            normalized.includes("bong den")
        ) {

            keywords.push(
                "den",
                "thiet bi dien"
            );
        }


        if (
            normalized.includes("giay") ||
            normalized.includes("a4") ||
            normalized.includes("van phong")
        ) {

            keywords.push(
                "giay",
                "van phong pham"
            );
        }


        return keywords;
    }


    /* =========================================================
       CALCULATE PRODUCT SCORE
       ========================================================= */

    function calculateProductScore(
        product,
        need
    ) {

        const normalizedNeed =
            normalizeText(need);

        const productText =
            normalizeText(
                product.name +
                " " +
                product.category
            );

        let score = 0;


        /*
         * Sản phẩm phải còn hàng.
         */

        if (product.stock <= 0) {

            return -999;
        }


        /*
         * Khớp từ khóa trực tiếp.
         */

        const words =
            normalizedNeed
                .split(/\s+/)
                .filter(
                    word => word.length >= 3
                );


        words.forEach(
            word => {

                if (
                    productText.includes(word)
                ) {

                    score += 10;
                }
            }
        );


        /*
         * Khớp nhóm sản phẩm.
         */

        const categoryKeywords =
            getCategoryKeywords(
                normalizedNeed
            );


        categoryKeywords.forEach(
            keyword => {

                if (
                    productText.includes(keyword)
                ) {

                    score += 20;
                }
            }
        );


        /*
         * Kiểm tra ngân sách.
         */

        const budget =
            extractBudget(
                normalizedNeed
            );


        if (budget !== null) {

            if (
                product.sellingPrice <= budget
            ) {

                score += 30;

            } else {

                score -= 20;
            }
        }


        /*
         * Ưu tiên sản phẩm có tồn kho.
         */

        if (product.stock >= 5) {

            score += 5;
        }


        return score;
    }


    /* =========================================================
       GENERATE REASON
       ========================================================= */

    function generateReason(
        product,
        need
    ) {

        const normalizedNeed =
            normalizeText(need);

        const reasons = [];


        const budget =
            extractBudget(
                normalizedNeed
            );


        if (
            budget !== null &&
            product.sellingPrice <= budget
        ) {

            reasons.push(
                "phù hợp với ngân sách"
            );
        }


        const categoryKeywords =
            getCategoryKeywords(
                normalizedNeed
            );


        if (
            categoryKeywords.some(
                keyword =>
                    normalizeText(
                        product.name +
                        " " +
                        product.category
                    ).includes(keyword)
            )
        ) {

            reasons.push(
                "phù hợp với nhu cầu sản phẩm"
            );
        }


        if (product.stock > 0) {

            reasons.push(
                "sản phẩm đang còn hàng"
            );
        }


        if (reasons.length === 0) {

            return (
                "Sản phẩm được lựa chọn dựa trên " +
                "thông tin sản phẩm và tình trạng tồn kho."
            );
        }


        return (
            "Sản phẩm được đề xuất vì " +
            reasons.join(", ") +
            "."
        );
    }


    /* =========================================================
       GET AI RECOMMENDATIONS
       ========================================================= */

    function getRecommendations(need) {

        const results =
            aiProducts
                .map(
                    product => {

                        return {

                            product,

                            score:
                                calculateProductScore(
                                    product,
                                    need
                                )
                        };
                    }
                )
                .filter(
                    item =>
                        item.score > 0
                )
                .sort(
                    (a, b) =>
                        b.score - a.score
                )
                .slice(0, 3);


        return results;
    }


    /* =========================================================
       RENDER EMPTY
       ========================================================= */

    function renderEmptyResult() {

        const result =
            getElement(
                "ai-results"
            );

        const count =
            getElement(
                "ai-result-count"
            );

        if (!result) {
            return;
        }


        if (count) {

            count.textContent =
                "0 sản phẩm";
        }


        result.innerHTML = `

            <div class="ai-empty-result">

                <div>

                    <div class="ai-empty-result-icon">
                        🤖
                    </div>

                    <h4>
                        Chưa có kết quả tư vấn
                    </h4>

                    <p>
                        Hãy nhập nhu cầu của khách hàng
                        để hệ thống đề xuất sản phẩm phù hợp.
                    </p>

                </div>

            </div>
        `;
    }


    /* =========================================================
       RENDER LOADING
       ========================================================= */

    function renderLoading() {

        const result =
            getElement(
                "ai-results"
            );

        if (!result) {
            return;
        }


        result.innerHTML = `

            <div class="ai-loading">

                <div>

                    <div class="ai-loading-spinner">
                    </div>

                    <p>
                        AI đang phân tích nhu cầu...
                    </p>

                </div>

            </div>
        `;
    }


    /* =========================================================
       RENDER RESULTS
       ========================================================= */

    function renderRecommendations(
        recommendations,
        need,
        geminiAnswer = "",
        geminiError = ""
    ) {

        const result =
            getElement(
                "ai-results"
            );

        const count =
            getElement(
                "ai-result-count"
            );

        if (!result) {
            return;
        }


        if (count) {

            count.textContent = geminiAnswer
                ? `${recommendations.length} sản phẩm • Gemini`
                : `${recommendations.length} sản phẩm`;
        }


        result.innerHTML = "";


        if (geminiAnswer) {
            result.insertAdjacentHTML("beforeend", `
                <div class="ai-analysis-block">
                    <h4>Nhận xét từ Gemini</h4>
                    <p>${formatAIText(geminiAnswer)}</p>
                </div>
            `);
        } else if (geminiError) {
            result.innerHTML = `
                <div class="ai-analysis-block">
                    <h4>Đề xuất từ dữ liệu nội bộ</h4>
                    <p>Gemini chưa phản hồi: ${escapeAIHtml(geminiError)}</p>
                </div>
            `;
        }


        if (
            recommendations.length === 0
        ) {

            result.insertAdjacentHTML("beforeend", `

                <div class="ai-no-product">

                    <h4>
                        Chưa tìm thấy sản phẩm phù hợp
                    </h4>

                    <p>
                        Hãy thử mô tả nhu cầu cụ thể hơn
                        hoặc thay đổi mức ngân sách.
                    </p>

                </div>
            `);

            return;
        }

        const list =
            document.createElement("div");

        list.className =
            "ai-results-list";


        recommendations.forEach(
            item => {

                const product =
                    item.product;


                const card =
                    document.createElement("div");

                card.className =
                    "ai-product-result";


                card.innerHTML = `

                    <div class="ai-product-result-header">

                        <div>

                            <h4 class="ai-product-result-name">
                                ${product.name}
                            </h4>

                            <div class="ai-product-code">
                                Mã sản phẩm:
                                ${product.code}
                            </div>

                        </div>

                        <div class="ai-product-price">
                            ${formatAIMoney(
                                product.sellingPrice
                            )}
                        </div>

                    </div>


                    <div class="ai-product-info">

                        <span class="ai-product-tag">
                            ${product.category}
                        </span>

                        <span class="ai-product-tag">
                            Đơn vị: ${product.unit}
                        </span>

                        <span class="ai-product-tag ai-product-stock">
                            Tồn kho: ${product.stock}
                        </span>

                    </div>


                    <div class="ai-product-reason">

                        <strong>
                            Lý do đề xuất:
                        </strong>

                        ${generateReason(
                            product,
                            need
                        )}

                    </div>
                `;


                list.appendChild(card);
            }
        );


        result.appendChild(list);
    }


    /* =========================================================
       CHECK AI ACCESS
       ========================================================= */

    function canUseAIProductAdvice() {

        /* Dùng cùng cấu hình với màn hình phân quyền. */
        if (
            typeof window.hasCurrentUserPermission ===
            "function"
        ) {

            return window.hasCurrentUserPermission(
                "ai_product_advice"
            );
        }

        if (
            typeof window.getCurrentRole !==
            "function"
        ) {

            return true;
        }


        const role =
            window.getCurrentRole();


        if (!role) {

            return true;
        }


        return (
            role === "admin" ||
            role === "owner" ||
            role === "customer"
        );
    }


    /* =========================================================
       SHOW ACCESS DENIED
       ========================================================= */

    function renderAccessDenied() {

        const inputArea =
            getElement(
                "ai-results"
            );

        if (!inputArea) {
            return;
        }


        inputArea.innerHTML = `

            <div class="ai-empty-result">

                <div>

                    <div class="ai-empty-result-icon">
                        🔒
                    </div>

                    <h4>
                        Bạn không có quyền sử dụng chức năng này
                    </h4>

                    <p>
                        Chức năng AI tư vấn sản phẩm
                        chưa được cấp cho tài khoản hiện tại.
                    </p>

                </div>

            </div>
        `;
    }


    /* =========================================================
       REQUEST ADVICE
       ========================================================= */

    async function requestProductAdvice() {

        if (!canUseAIProductAdvice()) {

            renderAccessDenied();

            return;
        }


        const input =
            getElement(
                "ai-product-need"
            );


        if (!input) {
            return;
        }


        const need =
            input.value.trim();


        if (!need) {

            alert(
                "Vui lòng nhập nhu cầu của khách hàng."
            );

            input.focus();

            return;
        }


        renderLoading();

        try {
            await loadAIProducts();
            const recommendations =
                getRecommendations(
                    need
                );
            let geminiAnswer = "";
            let geminiError = "";
            try {
                const response = await window.salesApi.ai.productAdvice(need);
                geminiAnswer = response.answer || "";
            } catch (error) {
                if (error.status === 401) return;
                geminiError = error.message || "Không thể kết nối Gemini.";
            }
            renderRecommendations(
                recommendations,
                need,
                geminiAnswer,
                geminiError
            );
        } catch (error) {
            const result = getElement("ai-results");
            if (result) {
                result.innerHTML = `
                    <div class="ai-no-product">
                        <h4>Không thể tải dữ liệu sản phẩm</h4>
                        <p>${String(error.message || "Vui lòng kiểm tra kết nối backend.")}</p>
                    </div>
                `;
            }
        }
    }


    /* =========================================================
       RESET
       ========================================================= */

    function resetAIAdvice() {

        const input =
            getElement(
                "ai-product-need"
            );


        if (input) {

            input.value = "";
        }


        renderEmptyResult();
    }


    /* =========================================================
       INIT
       ========================================================= */

    async function initAIProductAdvice() {

    const button =
        getElement("ai-advice-button");

    const resetButton =
        getElement("ai-reset-button");


    if (button && !button.dataset.aiInitialized) {

        button.addEventListener(
            "click",
            requestProductAdvice
        );

        button.dataset.aiInitialized = "true";
    }


    if (
        resetButton &&
        !resetButton.dataset.aiInitialized
    ) {

        resetButton.addEventListener(
            "click",
            resetAIAdvice
        );

        resetButton.dataset.aiInitialized = "true";
    }


    renderLoading();
    try {
        await loadAIProducts();
        renderEmptyResult();
    } catch (error) {
        const result = getElement("ai-results");
        if (result) {
            result.innerHTML = `
                <div class="ai-no-product">
                    <h4>Không thể tải dữ liệu sản phẩm</h4>
                    <p>${String(error.message || "Vui lòng kiểm tra kết nối backend.")}</p>
                </div>
            `;
        }
    }
}

    document.addEventListener("sales:data-changed", function () {
        if (getElement("ai-product-page")?.classList.contains("active")) {
            loadAIProducts().catch(console.error);
        }
    });


    /* =========================================================
       EXPOSE
       ========================================================= */

    window.initAIProductAdvice =
        initAIProductAdvice;

    window.requestProductAdvice =
        requestProductAdvice;

    window.resetAIAdvice =
        resetAIAdvice;

})();
