(function () {
    "use strict";

    const SESSION_KEY = "sales_management_current_user";
    const PREFERENCE_PREFIX = "sales_management_appearance_";
    const roleNames = {
        admin: "Quản trị viên",
        owner: "Chủ cửa hàng",
        staff: "Nhân viên bán hàng",
        customer: "Khách hàng"
    };
    const palettes = {
        indigo: { primary: "#4f46e5", dark: "#3730a3", soft: "#eef2ff", accent: "#2563eb" },
        blue: { primary: "#2563eb", dark: "#1e40af", soft: "#eff6ff", accent: "#06b6d4" },
        emerald: { primary: "#059669", dark: "#065f46", soft: "#ecfdf5", accent: "#0d9488" },
        rose: { primary: "#e11d48", dark: "#9f1239", soft: "#fff1f2", accent: "#f43f5e" },
        amber: { primary: "#d97706", dark: "#92400e", soft: "#fffbeb", accent: "#f59e0b" }
    };

    let currentProfile = null;
    let pendingAvatarData = "";

    function getElement(id) {
        return document.getElementById(id);
    }

    function normalizeProfile(user) {
        return {
            id: user?.id,
            username: user?.username || "",
            fullName: user?.full_name ?? user?.fullName ?? "",
            phone: user?.phone || "",
            email: user?.email || "",
            avatarData: user?.avatar_data ?? user?.avatarData ?? "",
            role: user?.role || "",
            isActive: user?.is_active ?? user?.isActive ?? false
        };
    }

    function getPreferenceKey() {
        const user = window.getCurrentUser?.();
        return `${PREFERENCE_PREFIX}${user?.id || user?.username || "guest"}`;
    }

    function loadAppearancePreference() {
        try {
            const saved = JSON.parse(localStorage.getItem(getPreferenceKey()) || "{}");
            return {
                theme: ["light", "dark", "system"].includes(saved.theme) ? saved.theme : "system",
                color: palettes[saved.color] ? saved.color : "indigo"
            };
        } catch (_error) {
            return { theme: "system", color: "indigo" };
        }
    }

    function applyAppearance(preference = loadAppearancePreference()) {
        const isSystemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
        const resolvedTheme = preference.theme === "system"
            ? (isSystemDark ? "dark" : "light")
            : preference.theme;
        const palette = palettes[preference.color] || palettes.indigo;
        const root = document.documentElement;

        root.dataset.appTheme = resolvedTheme;
        root.dataset.themePreference = preference.theme;
        root.dataset.primaryColor = preference.color;
        root.style.setProperty("--sm-primary", palette.primary);
        root.style.setProperty("--sm-primary-dark", palette.dark);
        root.style.setProperty("--sm-primary-soft", palette.soft);
        root.style.setProperty("--sm-accent", palette.accent);

        document.querySelectorAll('input[name="account-theme"]').forEach(input => {
            input.checked = input.value === preference.theme;
        });
        document.querySelectorAll(".account-color-option").forEach(button => {
            const active = button.dataset.color === preference.color;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
    }

    function saveAppearance(patch) {
        const preference = { ...loadAppearancePreference(), ...patch };
        localStorage.setItem(getPreferenceKey(), JSON.stringify(preference));
        applyAppearance(preference);
        showMessage("account-appearance-message", "Đã lưu thiết lập giao diện.", "success");
    }

    function updateTopbarDateTime() {
        const now = new Date();
        const weekdayElement = getElement("topbar-current-weekday");
        const dateElement = getElement("topbar-current-date");
        const timeElement = getElement("topbar-current-time");
        const weekday = now.toLocaleDateString("vi-VN", { weekday: "long" });

        if (weekdayElement) {
            weekdayElement.textContent = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        }
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
        }
        if (timeElement) {
            timeElement.textContent = now.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit"
            });
            timeElement.dateTime = now.toISOString();
        }
    }

    function showMessage(id, message, type = "") {
        const element = getElement(id);
        if (!element) return;
        element.textContent = message || "";
        element.className = `account-message${type ? ` ${type}` : ""}`;
    }

    function setAvatar(element, profile) {
        if (!element) return;
        element.innerHTML = "";
        if (profile?.avatarData) {
            const image = document.createElement("img");
            image.src = profile.avatarData;
            image.alt = `Ảnh đại diện của ${profile.fullName || profile.username}`;
            element.appendChild(image);
            return;
        }
        element.textContent = String(
            profile?.fullName || profile?.username || profile?.role || "U"
        ).trim().charAt(0).toUpperCase() || "U";
    }

    function syncAvatarSaveButton() {
        const button = getElement("account-avatar-save");
        if (!button) return;
        button.disabled = pendingAvatarData === (currentProfile?.avatarData || "");
    }

    function updateSessionProfile(profile) {
        const normalized = normalizeProfile(profile);
        localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
        window.loadCurrentUser?.();
        window.updateAuthUI?.();
        window.syncCurrentPermissionUser?.();
        window.dispatchEvent(new CustomEvent("auth:user-updated", { detail: normalized }));
    }

    function fillProfile(profile) {
        currentProfile = normalizeProfile(profile);
        pendingAvatarData = currentProfile.avatarData;

        getElement("account-username").value = currentProfile.username;
        getElement("account-full-name").value = currentProfile.fullName;
        getElement("account-phone").value = currentProfile.phone;
        getElement("account-email").value = currentProfile.email;
        getElement("account-display-name").textContent = currentProfile.fullName || currentProfile.username;
        getElement("account-display-username").textContent = `@${currentProfile.username}`;
        getElement("account-role-value").textContent = roleNames[currentProfile.role] || currentProfile.role;
        getElement("account-status-value").textContent = currentProfile.isActive ? "Đang hoạt động" : "Bị khóa";
        getElement("account-status-value").className = `account-status-value ${currentProfile.isActive ? "active" : "locked"}`;
        setAvatar(getElement("account-avatar-preview"), currentProfile);
        setAvatar(getElement("account-avatar-form-preview"), currentProfile);
        syncAvatarSaveButton();
        applyAppearance();
    }

    async function refreshAccountProfile(options = {}) {
        if (!localStorage.getItem("sales_management_access_token")) return null;
        try {
            const profile = normalizeProfile(await window.salesApi.account.get());
            updateSessionProfile(profile);
            if (options.fillForm) fillProfile(profile);
            return profile;
        } catch (error) {
            if (!options.silent) {
                showMessage("account-profile-message", error.message || "Không thể tải hồ sơ.", "error");
            }
            return null;
        }
    }

    function selectAccountTab(tabName) {
        document.querySelectorAll(".account-tab").forEach(button => {
            const active = button.dataset.accountTab === tabName;
            button.classList.toggle("active", active);
            button.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll(".account-pane").forEach(pane => {
            pane.classList.toggle("active", pane.dataset.accountPane === tabName);
        });
    }

    async function openAccountModal() {
        const user = window.getCurrentUser?.();
        const modal = getElement("account-modal");
        if (!user || !modal) return;

        fillProfile(user);
        selectAccountTab("profile");
        showMessage("account-profile-message", "");
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("account-modal-open");
        await refreshAccountProfile({ fillForm: true });
    }

    function closeAccountModal() {
        const modal = getElement("account-modal");
        modal?.classList.remove("active");
        modal?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("account-modal-open");
        getElement("account-password-form")?.reset();
    }

    async function handleProfileSubmit(event) {
        event.preventDefault();
        const fullName = getElement("account-full-name").value.trim();
        const phone = getElement("account-phone").value.trim();
        const email = getElement("account-email").value.trim();
        const submitButton = event.submitter || event.currentTarget.querySelector('button[type="submit"]');

        if (!fullName) {
            showMessage("account-profile-message", "Vui lòng nhập họ tên.", "error");
            return;
        }
        if (phone && !/^[0-9]{9,11}$/.test(phone)) {
            showMessage("account-profile-message", "Số điện thoại phải gồm từ 9 đến 11 chữ số.", "error");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Đang lưu...";
        try {
            const result = await window.salesApi.account.update({
                fullName,
                phone,
                email,
                avatarData: pendingAvatarData || null
            });
            const profile = normalizeProfile(result);
            updateSessionProfile(profile);
            fillProfile(profile);
            showMessage("account-profile-message", "Đã cập nhật hồ sơ và ảnh đại diện.", "success");
        } catch (error) {
            showMessage("account-profile-message", error.message || "Không thể cập nhật hồ sơ.", "error");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Lưu thay đổi";
        }
    }

    function resizeAvatar(file) {
        return new Promise((resolve, reject) => {
            if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
                reject(new Error("Chỉ hỗ trợ ảnh PNG, JPG hoặc WebP."));
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                reject(new Error("Ảnh đại diện không được lớn hơn 5MB."));
                return;
            }

            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh."));
            reader.onload = () => {
                const image = new Image();
                image.onerror = () => reject(new Error("Tệp ảnh không hợp lệ."));
                image.onload = () => {
                    const size = 320;
                    const canvas = document.createElement("canvas");
                    canvas.width = size;
                    canvas.height = size;
                    const context = canvas.getContext("2d");
                    const sourceSize = Math.min(image.width, image.height);
                    const sourceX = (image.width - sourceSize) / 2;
                    const sourceY = (image.height - sourceSize) / 2;
                    context.fillStyle = "#ffffff";
                    context.fillRect(0, 0, size, size);
                    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
                    resolve(canvas.toDataURL("image/jpeg", 0.84));
                };
                image.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function handleAvatarFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            pendingAvatarData = await resizeAvatar(file);
            setAvatar(getElement("account-avatar-preview"), {
                ...currentProfile,
                avatarData: pendingAvatarData
            });
            setAvatar(getElement("account-avatar-form-preview"), {
                ...currentProfile,
                avatarData: pendingAvatarData
            });
            syncAvatarSaveButton();
            showMessage("account-profile-message", "Ảnh mới đã sẵn sàng. Bấm Lưu ảnh để hiển thị ở góc phải.", "info");
        } catch (error) {
            showMessage("account-profile-message", error.message, "error");
        } finally {
            event.target.value = "";
        }
    }

    function removeAvatar() {
        pendingAvatarData = "";
        setAvatar(getElement("account-avatar-preview"), {
            ...currentProfile,
            avatarData: ""
        });
        setAvatar(getElement("account-avatar-form-preview"), {
            ...currentProfile,
            avatarData: ""
        });
        syncAvatarSaveButton();
        showMessage("account-profile-message", "Bấm Lưu ảnh để xác nhận gỡ ảnh đại diện.", "info");
    }

    async function saveAvatar() {
        const button = getElement("account-avatar-save");
        if (!button || !currentProfile || button.disabled) return;

        button.disabled = true;
        button.textContent = "Đang lưu...";
        try {
            const result = await window.salesApi.account.update({
                fullName: currentProfile.fullName,
                phone: currentProfile.phone,
                email: currentProfile.email,
                avatarData: pendingAvatarData || null
            });
            currentProfile = normalizeProfile(result);
            pendingAvatarData = currentProfile.avatarData;
            updateSessionProfile(currentProfile);
            setAvatar(getElement("account-avatar-preview"), currentProfile);
            setAvatar(getElement("account-avatar-form-preview"), currentProfile);
            showMessage(
                "account-profile-message",
                currentProfile.avatarData
                    ? "Đã lưu ảnh đại diện và cập nhật ảnh ở góc phải."
                    : "Đã gỡ ảnh đại diện. Góc phải đã trở lại chữ cái tài khoản.",
                "success"
            );
        } catch (error) {
            showMessage("account-profile-message", error.message || "Không thể lưu ảnh đại diện.", "error");
        } finally {
            button.textContent = "Lưu ảnh";
            syncAvatarSaveButton();
        }
    }

    function updatePasswordStrength() {
        const password = getElement("account-new-password")?.value || "";
        const bar = getElement("account-password-strength-bar");
        const label = getElement("account-password-strength-label");
        if (!bar || !label) return;
        let score = 0;
        if (password.length >= 6) score += 1;
        if (password.length >= 10) score += 1;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
        if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
        const labels = ["Chưa nhập", "Yếu", "Trung bình", "Tốt", "Mạnh"];
        bar.dataset.score = String(score);
        label.textContent = labels[score];
    }

    async function handlePasswordSubmit(event) {
        event.preventDefault();
        const currentPassword = getElement("account-current-password").value;
        const newPassword = getElement("account-new-password").value;
        const confirmation = getElement("account-confirm-password").value;
        const submitButton = event.submitter || event.currentTarget.querySelector('button[type="submit"]');

        if (newPassword.length < 6) {
            showMessage("account-password-message", "Mật khẩu mới phải có ít nhất 6 ký tự.", "error");
            return;
        }
        if (newPassword !== confirmation) {
            showMessage("account-password-message", "Xác nhận mật khẩu mới chưa khớp.", "error");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Đang đổi...";
        try {
            const result = await window.salesApi.account.changePassword({ currentPassword, newPassword });
            event.currentTarget.reset();
            updatePasswordStrength();
            showMessage("account-password-message", result.message || "Đổi mật khẩu thành công.", "success");
        } catch (error) {
            showMessage("account-password-message", error.message || "Không thể đổi mật khẩu.", "error");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Đổi mật khẩu";
        }
    }

    function setupEvents() {
        getElement("account-menu-button")?.addEventListener("click", openAccountModal);
        getElement("account-modal-close")?.addEventListener("click", closeAccountModal);
        getElement("account-profile-form")?.addEventListener("submit", handleProfileSubmit);
        getElement("account-password-form")?.addEventListener("submit", handlePasswordSubmit);
        getElement("account-avatar-input")?.addEventListener("change", handleAvatarFile);
        getElement("account-avatar-save")?.addEventListener("click", saveAvatar);
        getElement("account-avatar-remove")?.addEventListener("click", removeAvatar);
        getElement("account-new-password")?.addEventListener("input", updatePasswordStrength);

        getElement("account-modal")?.addEventListener("click", event => {
            if (event.target.id === "account-modal") closeAccountModal();
        });
        document.querySelectorAll(".account-tab").forEach(button => {
            button.addEventListener("click", () => selectAccountTab(button.dataset.accountTab));
        });
        document.querySelectorAll('input[name="account-theme"]').forEach(input => {
            input.addEventListener("change", () => saveAppearance({ theme: input.value }));
        });
        document.querySelectorAll(".account-color-option").forEach(button => {
            button.addEventListener("click", () => saveAppearance({ color: button.dataset.color }));
        });
        document.querySelectorAll(".account-password-toggle").forEach(button => {
            button.addEventListener("click", () => {
                const input = getElement(button.dataset.target);
                if (!input) return;
                input.type = input.type === "password" ? "text" : "password";
                button.textContent = input.type === "password" ? "Hiện" : "Ẩn";
            });
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && getElement("account-modal")?.classList.contains("active")) {
                closeAccountModal();
            }
        });
    }

    function initAccount() {
        setupEvents();
        applyAppearance();
        updateTopbarDateTime();
        window.setInterval(updateTopbarDateTime, 60_000);
        refreshAccountProfile({ silent: true });
        window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
            if (loadAppearancePreference().theme === "system") applyAppearance();
        });
    }

    window.addEventListener("auth:login", () => {
        applyAppearance();
        refreshAccountProfile({ silent: true });
    });
    window.addEventListener("auth:logout", () => {
        closeAccountModal();
        applyAppearance({ theme: "system", color: "indigo" });
    });
    window.openAccountModal = openAccountModal;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAccount);
    } else {
        initAccount();
    }
})();
