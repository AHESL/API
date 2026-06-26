"use strict";

/* ================================================================
   1. 常量配置
   ================================================================ */

// localStorage 键名常量
const STORAGE_AI_PERSONA = 'ai_persona';
const STORAGE_AI_AVATAR = 'ai_avatar';
const STORAGE_AVATAR_STYLE = 'avatar_style';

/* ================================================================
   2. 全局状态变量
   ================================================================ */

let aiEditAnimating = false;              // 编辑覆盖层动画锁
let originalAIPersona = {};               // 编辑前的原始 AI 角色数据
let currentAIAvatarData = '';             // 当前编辑中的 AI 头像数据（Base64）
let personaEnabled = false;               // 角色扮演是否启用
let cropper = null;                       // Cropper.js 实例
let isCropping = false;                   // 是否处于裁剪模式

/* ================================================================
   3. DOM 元素引用
   ================================================================ */

const aiEditOverlay = document.getElementById('aiEditOverlay');
const aiEditBackBtn = document.getElementById('aiEditBackBtn');
const aiEditSaveBtn = document.getElementById('aiEditSaveBtn');
const aiAvatarPreview = document.getElementById('aiAvatarPreview');
const aiAvatarSection = document.getElementById('aiAvatarSection');
const aiCropSection = document.getElementById('aiCropSection');
const aiCropImage = document.getElementById('aiCropImage');
const aiFileInput = document.getElementById('aiFileInput');
const personaToggleBtn = document.getElementById('personaToggleBtn');
const aiNicknameInput = document.getElementById('aiNicknameInput');
const aiBackgroundInput = document.getElementById('aiBackgroundInput');
const aiStyleInput = document.getElementById('aiStyleInput');
const aiPersonalityInput = document.getElementById('aiPersonalityInput');
const aiAvatarHint = document.getElementById('aiAvatarHint');

/* ================================================================
   4. 获取存储数据的工具函数
   ================================================================ */

// 获取 AI 头像地址
function getAIAvatar() {
    return localStorage.getItem(STORAGE_AI_AVATAR) || 'tx/AI-tx.jpg';
}

// 获取用户头像地址
function getUserAvatar() {
    try {
        const p = JSON.parse(localStorage.getItem('user_profile'));
        return p && p.avatar ? p.avatar : 'tx/mr-tx.jpg';
    } catch(e) {
        return 'tx/mr-tx.jpg';
    }
}

// 获取头像样式（圆形/方形）
function getAvatarStyle() {
    return localStorage.getItem(STORAGE_AVATAR_STYLE) || 'circle';
}

/* ================================================================
   5. 加载 AI 角色数据
   ================================================================ */

function loadAIPersona() {
    // 从 localStorage 加载 AI 角色配置
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_AI_PERSONA));
        if (saved) {
            originalAIPersona = { ...saved };
            personaEnabled = saved.enabled || false;
            aiNicknameInput.value = saved.nickname || '';
            aiBackgroundInput.value = saved.background || '';
            aiStyleInput.value = saved.style || '';
            aiPersonalityInput.value = saved.personality || '';
        }
    } catch(e) {
        originalAIPersona = {};
    }

    // 加载 AI 头像
    currentAIAvatarData = getAIAvatar();

    // 更新 UI
    updatePersonaToggleUI();
    updateInputsDisabled();
    updateAIAvatarPreview();
}

/* ================================================================
   6. UI 更新函数
   ================================================================ */

// 更新角色开关按钮样式
function updatePersonaToggleUI() {
    personaToggleBtn.textContent = personaEnabled ? '开' : '关';
    personaToggleBtn.classList.toggle('active', personaEnabled);
}

// 更新输入框禁用状态（角色关闭时不可编辑）
function updateInputsDisabled() {
    const d = !personaEnabled;
    aiNicknameInput.disabled = d;
    aiBackgroundInput.disabled = d;
    aiStyleInput.disabled = d;
    aiPersonalityInput.disabled = d;
}

// 更新 AI 头像预览
function updateAIAvatarPreview() {
    aiAvatarPreview.innerHTML = `<img src="${currentAIAvatarData}" alt="AI头像" style="width:100%;height:100%;object-fit:cover;">`;
}

/* ================================================================
   7. 变更检测与保存
   ================================================================ */

// 检查 AI 编辑内容是否有变更
function hasAIEditChanges() {
    return currentAIAvatarData !== getAIAvatar() ||
        personaEnabled !== (originalAIPersona.enabled || false) ||
        aiNicknameInput.value.trim() !== (originalAIPersona.nickname || '') ||
        aiBackgroundInput.value.trim() !== (originalAIPersona.background || '') ||
        aiStyleInput.value.trim() !== (originalAIPersona.style || '') ||
        aiPersonalityInput.value.trim() !== (originalAIPersona.personality || '');
}

// 保存 AI 角色配置
function saveAIPersona() {
    const persona = {
        enabled: personaEnabled,
        nickname: aiNicknameInput.value.trim(),
        background: aiBackgroundInput.value.trim(),
        style: aiStyleInput.value.trim(),
        personality: aiPersonalityInput.value.trim()
    };

    localStorage.setItem(STORAGE_AI_PERSONA, JSON.stringify(persona));
    localStorage.setItem(STORAGE_AI_AVATAR, currentAIAvatarData);
    originalAIPersona = { ...persona };

    // 如果角色开启，同步开启多轮对话
    if (personaEnabled) localStorage.setItem('multiturn_enabled', 'true');

    // 更新所有消息头像
    updateAllAvatarsInUI();
}

/* ================================================================
   8. 更新所有消息头像（同步到聊天界面）
   ================================================================ */

function updateAllAvatarsInUI() {
    const aiSrc = getAIAvatar();
    const userSrc = getUserAvatar();
    const shape = getAvatarStyle();

    // 更新所有 AI 消息头像
    document.querySelectorAll('.message-row.ai .avatar-img').forEach(img => {
        img.src = aiSrc;
        img.className = 'avatar-img';
        if (shape === 'square') img.classList.add('rounded-square');
    });

    // 更新所有用户消息头像
    document.querySelectorAll('.message-row.user .avatar-img').forEach(img => {
        img.src = userSrc;
        img.className = 'avatar-img';
        if (shape === 'square') img.classList.add('rounded-square');
    });
}

/* ================================================================
   9. 编辑覆盖层（打开 / 关闭）
   ================================================================ */

// 打开 AI 编辑覆盖层
function openAIEditOverlay() {
    if (aiEditAnimating) return;
    aiEditAnimating = true;
    loadAIPersona();
    aiEditOverlay.classList.add('show');
    history.pushState({modal: 'in_aiEdit'}, '', location.href);
    aiEditOverlay.classList.remove('closing');
    setTimeout(() => { aiEditAnimating = false; }, 350);
}

// 关闭 AI 编辑覆盖层
function closeAIEditOverlay(callback) {
    if (aiEditAnimating) return;
    aiEditAnimating = true;
    aiEditOverlay.classList.add('closing');
    aiEditOverlay.classList.remove('show');

    // 清理浏览器历史记录
    if (window.history.state && window.history.state.modal === 'in_aiEdit') {
        if (typeof cleaningHistory !== 'undefined') cleaningHistory = true;
        history.back();
    }

    setTimeout(() => {
        aiEditOverlay.classList.remove('closing');
        aiEditAnimating = false;
        if (callback) callback();
    }, 350);
}

/* ================================================================
   10. 裁剪功能（显示 / 隐藏 / 确认）
   ================================================================ */

// 显示裁剪器
function showCropper(imageDataUrl) {
    // 隐藏头像预览，显示裁剪区域
    aiAvatarSection.style.display = 'none';
    aiCropImage.src = imageDataUrl;
    aiCropSection.classList.add('active');

    // 销毁旧实例
    if (cropper) cropper.destroy();

    // 初始化 Cropper
    cropper = new Cropper(aiCropImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        cropBoxResizable: true,
        cropBoxMovable: true,
        responsive: true,
        background: false,
        modal: false,
        guides: true,
        center: true,
        highlight: true
    });

    isCropping = true;
    aiEditBackBtn.textContent = '取消';
    aiEditSaveBtn.textContent = '裁剪';
}

// 隐藏裁剪器（返回编辑状态）
function hideCropper() {
    aiAvatarSection.style.display = 'flex';
    aiCropSection.classList.remove('active');

    if (cropper) { cropper.destroy(); cropper = null; }
    aiCropImage.src = '';

    isCropping = false;
    aiEditBackBtn.textContent = '返回';
    aiEditSaveBtn.textContent = '保存';
}

// 确认裁剪并保存头像
function confirmCrop() {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 300, height: 300 });
    currentAIAvatarData = canvas.toDataURL('image/png');
    updateAIAvatarPreview();
    hideCropper();
}

/* ================================================================
   11. 事件绑定 - 文件上传（头像选择）
   ================================================================ */

// 头像文件上传 - 支持图片格式限制
aiFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 检查文件格式
    const fileName = file.name;
    const ext = fileName.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
        const hint = aiAvatarHint;
        const originalHint = hint.textContent;
        hint.textContent = '仅支持JPG,JPEG,PNG格式的图片文件';
        aiFileInput.value = '';
        setTimeout(() => {
            if (hint) hint.textContent = originalHint;
        }, 3000);
        return;
    }

    // 读取并显示裁剪器
    const reader = new FileReader();
    reader.onload = (ev) => showCropper(ev.target.result);
    reader.readAsDataURL(file);
    aiFileInput.value = '';
});

/* ================================================================
   12. 事件绑定 - 保存按钮
   ================================================================ */

aiEditSaveBtn.addEventListener('click', () => {
    // 裁剪模式：确认裁剪
    if (isCropping) { confirmCrop(); return; }

    // 无变更：直接关闭
    if (!hasAIEditChanges()) {
        closeAIEditOverlay(() => {
            if (typeof showToast === 'function') showToast('没有任何修改');
        });
    } else {
        // 有变更：保存并关闭
        saveAIPersona();
        closeAIEditOverlay(() => {
            if (typeof showToast === 'function') showToast('AI 资料已保存');
        });
    }
});

/* ================================================================
   13. 事件绑定 - 返回按钮
   ================================================================ */

aiEditBackBtn.addEventListener('click', () => {
    // 裁剪模式：取消裁剪
    if (isCropping) { hideCropper(); return; }

    // 无变更：直接关闭
    if (!hasAIEditChanges()) {
        closeAIEditOverlay();
    } else {
        // 有变更：弹出确认对话框
        if (typeof showModal === 'function') {
            showModal({
                title: '⚠️ 未保存的更改',
                message: '您有未保存的更改，是否保存后再返回？',
                confirmText: '保存',
                cancelText: '取消',
                onConfirm: () => {
                    saveAIPersona();
                    if (typeof hideModal === 'function') hideModal();
                    closeAIEditOverlay(() => {
                        if (typeof showToast === 'function') showToast('AI 资料已保存');
                    });
                },
                onCancel: () => {
                    if (typeof hideModal === 'function') hideModal();
                    closeAIEditOverlay();
                }
            });
        }
    }
});

/* ================================================================
   14. 事件绑定 - 头像预览点击触发上传
   ================================================================ */

aiAvatarPreview.addEventListener('click', () => aiFileInput.click());
aiAvatarPreview.addEventListener('dblclick', () => aiFileInput.click());

// 移动端长按触发
let longPressTimer;
aiAvatarPreview.addEventListener('touchstart', () => {
    longPressTimer = setTimeout(() => aiFileInput.click(), 1500);
});
aiAvatarPreview.addEventListener('touchend', () => clearTimeout(longPressTimer));

/* ================================================================
   15. 事件绑定 - 角色开关
   ================================================================ */

personaToggleBtn.addEventListener('click', () => {
    // 关闭角色：直接关闭，同时关闭多轮对话
    if (personaEnabled) {
        personaEnabled = false;
        localStorage.setItem('multiturn_enabled', 'false');
        updatePersonaToggleUI();
        updateInputsDisabled();
        if (typeof updateContextWarning === 'function') updateContextWarning();
        if (typeof showToast === 'function') showToast('角色扮演已关闭，多轮对话已同步关闭');
    } else {
        // 开启角色：弹出确认警告
        if (typeof showModal === 'function') {
            showModal({
                title: '⚠️ 确定要开启吗',
                message: '开启后，AI 将按照您设定的身份、背景和风格进行回复。所需 Token 消耗约为仅开启携带上下文功能的 2 倍以上。建议在需要特定角色对话时开启，日常聊天时可关闭以节省费用。',
                confirmText: '开启',
                cancelText: '取消',
                onConfirm: () => {
                    personaEnabled = true;
                    localStorage.setItem('multiturn_enabled', 'true');
                    updatePersonaToggleUI();
                    updateInputsDisabled();
                    if (typeof updateContextWarning === 'function') updateContextWarning();
                    if (typeof showToast === 'function') showToast('角色扮演已开启，多轮对话已同步开启');
                },
                onCancel: () => {
                    personaEnabled = false;
                    localStorage.setItem('multiturn_enabled', 'false');
                    updatePersonaToggleUI();
                    updateInputsDisabled();
                }
            });
        }
    }
});