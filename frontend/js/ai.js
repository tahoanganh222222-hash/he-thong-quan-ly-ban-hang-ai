/* =========================================================
   AI01 - TƯ VẤN SẢN PHẨM

   Frontend version

   Hiện tại:
   - Dùng mock products
   - Mô phỏng logic AI
   - Không gọi API AI

   Sau này:
   - Gửi nhu cầu + dữ liệu sản phẩm/tồn kho
     tới backend FastAPI
   - Backend gọi Gemini API
   - Nhận kết quả và hiển thị lại
   ========================================================= */

(function () {

    "use strict";


    /* =========================================================
       MOCK PRODUCTS
       ========================================================= */

    const aiProducts = [

        {
            id: 1,
            code: "SP001",
            name: "Nước suối Aquafina 500ml",
            category: "Đồ uống",
            sellingPrice: 6000,
            unit: "Chai",
            stock: 120
        },

        {
            id: 2,
            code: "SP002",
            name: "Nước ngọt Coca Cola 330ml",
            category: "Đồ uống",
            sellingPrice: 10000,
            unit: "Lon",
            stock: 85
        },

        {
            id: 3,
            code: "SP003",
            name: "Mì Hảo Hảo tôm chua cay",
            category: "Thực phẩm",
            sellingPrice: 5000,
            unit: "Gói",
            stock: 150
        },

        {
            id: 4,
            code: "SP004",
            name: "Nước giặt OMO 3.6kg",
            category: "Hàng gia dụng",
            sellingPrice: 125000,
            unit: "Túi",
            stock: 30
        },

        {
            id: 5,
            code: "SP005",
            name: "Quạt điện Senko",
            category: "Thiết bị điện",
            sellingPrice: 520000,
            unit: "Cái",
            stock: 12
        },

        {
            id: 6,
            code: "SP006",
            name: "Máy sấy tóc Philips",
            category: "Thiết bị điện",
            sellingPrice: 350000,
            unit: "Cái",
            stock: 8
        },

        {
            id: 7,
            code: "SP007",
            name: "Bóng đèn LED 12W",
            category: "Thiết bị điện",
            sellingPrice: 45000,
            unit: "Cái",
            stock: 45
        },

        {
            id: 8,
            code: "SP008",
            name: "Giấy A4 Double A",
            category: "Văn phòng phẩm",
            sellingPrice: 78000,
            unit: "Ram",
            stock: 40
        }

    ];


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
        need
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

            count.textContent =
                `${recommendations.length} sản phẩm`;
        }


        if (
            recommendations.length === 0
        ) {

            result.innerHTML = `

                <div class="ai-no-product">

                    <h4>
                        Chưa tìm thấy sản phẩm phù hợp
                    </h4>

                    <p>
                        Hãy thử mô tả nhu cầu cụ thể hơn
                        hoặc thay đổi mức ngân sách.
                    </p>

                </div>
            `;

            return;
        }


        result.innerHTML = "";


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

        /*
         * Frontend mock:
         *
         * owner và customer được sử dụng.
         *
         * Nếu chưa có auth.js hoặc chưa đăng nhập,
         * cho phép hiển thị để test prototype.
         */

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
                "ai-advice-content"
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
                        chỉ dành cho Chủ cửa hàng và Khách hàng.
                    </p>

                </div>

            </div>
        `;
    }


    /* =========================================================
       REQUEST ADVICE
       ========================================================= */

    function requestProductAdvice() {

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


        /*
         * Mô phỏng thời gian AI xử lý.
         */

        setTimeout(
            function () {

                const recommendations =
                    getRecommendations(
                        need
                    );


                renderRecommendations(
                    recommendations,
                    need
                );

            },
            500
        );
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

    function initAIProductAdvice() {

        const button =
            getElement(
                "ai-advice-button"
            );

        const resetButton =
            getElement(
                "ai-reset-button"
            );


        if (button) {

            button.addEventListener(
                "click",
                requestProductAdvice
            );
        }


        if (resetButton) {

            resetButton.addEventListener(
                "click",
                resetAIAdvice
            );
        }


        renderEmptyResult();
    }


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