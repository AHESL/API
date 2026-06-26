"use strict";

/* ================================================================
   1. 常量配置
   ================================================================ */

// localStorage 键名常量
const KEYS_PROFILE = {
    USER_PROFILE: 'user_profile',
    AI_AVATAR: 'ai_avatar',
    AVATAR_STYLE: 'avatar_style',
    AVATAR_ENABLED: 'avatar_enabled'
};

/* ================================================================
   2. 全局状态变量
   ================================================================ */

let currentAvatarData = '';                      // 当前编辑中的头像数据（Base64）
let originalProfileEdit = { avatar: '', name: '', bio: '' };  // 编辑前的原始资料
let cropper = null;                             // Cropper.js 实例
let isCropping = false;                         // 是否处于裁剪模式
let editAnimating = false;                      // 编辑覆盖层动画锁
let editToastTimer = null;                      // 编辑页 Toast 计时器
let avatarEnabled = false;                      // 头像是否启用
let avatarStyle = 'circle';                     // 头像样式：circle / square

// 默认个人资料
const DEFAULT_PROFILE = { avatar: '', name: '未命名用户', bio: '与AI相伴的每一天' };

/* ================================================================
   3. 存储工具函数
   ================================================================ */

function getStorage(key) { return localStorage.getItem(key); }
function setStorage(key, value) { localStorage.setItem(key, value); }

/* ================================================================
   4. Toast 提示工具
   ================================================================ */

function showToast(message, duration = 2000) {
    if (typeof window._showToast === 'function') {
        window._showToast(message, duration);
    }
}

function showEditToast(message, duration = 2000) {
    if (typeof els === 'undefined') return;
    if (editToastTimer) clearTimeout(editToastTimer);
    els.editToastEl.textContent = message;
    els.editToastEl.classList.add('show');
    editToastTimer = setTimeout(() => {
        els.editToastEl.classList.remove('show');
        editToastTimer = null;
    }, duration);
}

/* ================================================================
   5. 个人资料加载与 UI 更新
   ================================================================ */

// 从 localStorage 加载个人资料并更新 UI
function loadProfile() {
    try {
        updateProfileUI(JSON.parse(getStorage(KEYS_PROFILE.USER_PROFILE)) || DEFAULT_PROFILE);
    } catch(e) {
        updateProfileUI(DEFAULT_PROFILE);
    }
}

// 更新个人资料 UI（头像、昵称、简介）
function updateProfileUI(p) {
    if (typeof els === 'undefined') return;
    if (els.profileAvatar) {
        els.profileAvatar.innerHTML = p.avatar
            ? `<img src="${p.avatar}" alt="avatar">`
            : `<img src="tx/mr-tx.jpg" alt="默认头像" style="width:100%;height:100%;object-fit:cover;">`;
    }
    if (els.profileNameDisplay) els.profileNameDisplay.textContent = p.name;
    if (els.profileBioDisplay) els.profileBioDisplay.textContent = p.bio;
}

/* ================================================================
   6. 编辑资料加载与变更检测
   ================================================================ */

// 加载个人资料到编辑覆盖层
function loadEditProfile() {
    try {
        const p = JSON.parse(getStorage(KEYS_PROFILE.USER_PROFILE)) || DEFAULT_PROFILE;
        originalProfileEdit = {
            avatar: p.avatar || '',
            name: p.name || '未命名用户',
            bio: p.bio || '与AI相伴的每一天'
        };
        currentAvatarData = originalProfileEdit.avatar;
        if (typeof els === 'undefined') return;
        els.editAvatarPreview.innerHTML = originalProfileEdit.avatar
            ? `<img src="${originalProfileEdit.avatar}" alt="avatar">`
            : `<img src="tx/mr-tx.jpg" alt="默认头像" style="width:100%;height:100%;object-fit:cover;">`;
        els.editNameInput.value = originalProfileEdit.name;
        els.editBioInput.value = originalProfileEdit.bio;
    } catch(e) {}
}

// 检查编辑内容是否有变更
function hasEditChanges() {
    if (typeof els === 'undefined') return false;
    return currentAvatarData !== originalProfileEdit.avatar ||
        els.editNameInput.value.trim() !== originalProfileEdit.name ||
        els.editBioInput.value.trim() !== originalProfileEdit.bio;
}

/* ================================================================
   7. 保存编辑资料
   ================================================================ */

function performEditSave() {
    if (typeof els === 'undefined') return;
    const p = {
        avatar: currentAvatarData,
        name: els.editNameInput.value.trim() || '未命名用户',
        bio: els.editBioInput.value.trim() || '与AI相伴的每一天'
    };
    setStorage(KEYS_PROFILE.USER_PROFILE, JSON.stringify(p));
    loadProfile();
    loadEditProfile();
    updateAvatarStylePreviews();
    if (typeof updateAllAvatarsInUI === 'function') updateAllAvatarsInUI();
}

/* ================================================================
   8. 裁剪模式控制
   ================================================================ */

// 切换裁剪模式（修改顶部按钮样式）
function setCropMode(active) {
    if (typeof els === 'undefined') return;
    isCropping = active;
    if (active) {
        els.editLeftBtn.textContent = '取消';
        els.editLeftBtn.className = 'edit-header-btn edit-crop-cancel-btn';
        els.editRightBtn.textContent = '确定';
        els.editRightBtn.className = 'edit-header-btn edit-crop-confirm-btn';
    } else {
        els.editLeftBtn.textContent = '返回';
        els.editLeftBtn.className = 'edit-header-btn edit-back-btn';
        els.editRightBtn.textContent = '保存';
        els.editRightBtn.className = 'edit-header-btn edit-save-btn';
    }
}

/* ================================================================
   9. 裁剪功能（显示 / 隐藏 / 确认）
   ================================================================ */

// 显示裁剪器
function showCropper(url) {
    if (typeof els === 'undefined') return;
    els.editAvatarSection.classList.add('hidden');
    els.editCropImage.src = url;
    els.editCropSection.classList.add('active');
    setCropMode(true);
    if (cropper) cropper.destroy();
    try {
        cropper = new Cropper(els.editCropImage, {
            aspectRatio: 1,          // 1:1 正方形
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1,
            cropBoxResizable: true,
            cropBoxMovable: true,
            responsive: true,
            touchDragZoom: true,
            zoomable: true,
            background: false,
            modal: false,
            guides: true,
            center: true,
            highlight: true
        });
    } catch(e) {
        showEditToast('❌ 裁剪引擎启动失败');
        hideCropper();
    }
}

// 隐藏裁剪器
function hideCropper() {
    if (typeof els === 'undefined') return;
    els.editAvatarSection.classList.remove('hidden');
    els.editCropSection.classList.remove('active');
    setCropMode(false);
    if (cropper) { cropper.destroy(); cropper = null; }
    els.editCropImage.src = '';
}

// 确认裁剪
function confirmCrop() {
    if (!cropper) return;
    try {
        const c = cropper.getCroppedCanvas({ width: 300, height: 300 });
        if (!c) { showEditToast('❌ 裁剪失败，请重试'); return; }
        currentAvatarData = c.toDataURL('image/png');
        if (typeof els !== 'undefined') {
            els.editAvatarPreview.innerHTML = `<img src="${currentAvatarData}" alt="avatar">`;
        }
        hideCropper();
    } catch(e) {
        showEditToast('❌ 裁剪出错');
        hideCropper();
    }
}

/* ================================================================
   10. 编辑覆盖层（打开 / 关闭）
   ================================================================ */

// 打开编辑覆盖层
function openEditOverlay() {
    if (editAnimating || typeof els === 'undefined') return;
    editAnimating = true;
    loadEditProfile();
    els.editOverlay.classList.add('show');
    history.pushState({ modal: 'my_edit' }, '', location.href);
    els.editOverlay.classList.remove('closing');
    setTimeout(() => { editAnimating = false; }, 350);
}

// 关闭编辑覆盖层
function closeEditOverlay(cb) {
    if (editAnimating || typeof els === 'undefined') return;
    editAnimating = true;
    els.editOverlay.classList.add('closing');
    els.editOverlay.classList.remove('show');
    if (window.history.state && window.history.state.modal === 'my_edit') {
        if (typeof cleaningHistory !== 'undefined') cleaningHistory = true;
        history.back();
    }
    setTimeout(() => {
        els.editOverlay.classList.remove('closing');
        editAnimating = false;
        if (cb) cb();
    }, 350);
}

/* ================================================================
   11. 头像样式管理
   ================================================================ */

// 更新头像样式预览图（圆形预览用 AI 头像，方形预览用用户头像）
function updateAvatarStylePreviews() {
    if (typeof els === 'undefined') return;
    const ai = getStorage(KEYS_PROFILE.AI_AVATAR) || 'tx/AI-tx.jpg';
    let user = 'tx/mr-tx.jpg';
    try {
        const p = JSON.parse(getStorage(KEYS_PROFILE.USER_PROFILE));
        if (p && p.avatar) user = p.avatar;
    } catch(e) {}
    const ci = els.styleCirclePreview?.querySelector('img');
    const si = els.styleSquarePreview?.querySelector('img');
    if (ci) ci.src = ai;
    if (si) si.src = user;
}

// 更新头像显示/隐藏
function updateAvatarStyleVisibility() {
    if (typeof els === 'undefined') return;
    if (els.avatarStyleSection) els.avatarStyleSection.style.display = avatarEnabled ? 'block' : 'none';
    if (els.swapAvatarBtn) els.swapAvatarBtn.style.display = avatarEnabled ? 'flex' : 'none';
}

// 更新头像样式选中状态（圆形/方形高亮）
function updateAvatarStyleSelectionUI() {
    if (typeof els === 'undefined') return;
    if (els.styleCirclePreview) els.styleCirclePreview.classList.toggle('selected', avatarStyle === 'circle');
    if (els.styleSquarePreview) els.styleSquarePreview.classList.toggle('selected', avatarStyle === 'square');
}