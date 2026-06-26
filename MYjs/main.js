"use strict";

/* ================================================================
   1. 全局变量与状态
   ================================================================ */

// 系统主题媒体查询
let systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentThemeMode = 'auto';
let toastTimer = null;
let pendingConfirmCallback = null, pendingCancelCallback = null;
let multiturnEnabled = false;
let memorySendEnabled = false;
let lastApiKeyValue = '';
let customColorBeforeOpen = '';

// DOM 快捷函数
const $ = (id) => document.getElementById(id);
const els = {};

/* ================================================================
   2. 初始化 DOM 元素引用
   ================================================================ */

function initEls() {
    els.conversationCount = $('conversationCount'); els.memoryCount = $('memoryCount');
    els.memoryListContainer = $('memoryListContainer'); els.refreshMemoryBtn = $('refreshMemoryBtn');
    els.clearAllMemoryBtn = $('clearAllMemoryBtn'); els.storageUsage = $('storageUsage');
    els.resetToDefaultBtn = $('resetToDefaultBtn'); els.totalBalance = $('totalBalance');
    els.grantedBalance = $('grantedBalance'); els.usedBalance = $('usedBalance'); els.resetStatsBtn = $('resetStatsBtn');
    els.feedbackLink = $('feedbackLink');
    els.microsoftSpeedValue = $('microsoftSpeedValue'); els.microsoftSpeedMinusBtn = $('microsoftSpeedMinusBtn'); els.microsoftSpeedPlusBtn = $('microsoftSpeedPlusBtn');
    els.voiceSelect = $('voiceSelect');
    els.microsoftTestBtn = $('microsoftTestBtn');
    els.modalOverlay = $('modalOverlay'); els.modalTitle = $('modalTitle');
    els.modalMessage = $('modalMessage'); els.modalConfirmBtn = $('modalConfirmBtn'); els.modalCancelBtn = $('modalCancelBtn');
    els.resetOptionsList = $('resetOptionsList'); els.apiKeyToggleBtn = $('apiKeyToggleBtn');
    els.apiKeySection = $('apiKeySection'); els.apiKeyArrow = $('apiKeyArrow'); els.apiKeyInput = $('apiKeyInput');
    els.toggleApiKeyVisibility = $('toggleApiKeyVisibility');
    els.profileAvatar = $('profileAvatar'); els.profileNameDisplay = $('profileNameDisplay'); els.profileBioDisplay = $('profileBioDisplay');
    els.themeLight = $('themeLight'); els.themeDark = $('themeDark'); els.themeAuto = $('themeAuto');
    els.toastEl = $('toastMessage'); els.headerArea = $('headerArea'); els.headerTitleEl = $('headerTitle'); els.headerSubtitleEl = $('headerSubtitle');
    els.editProfileBtn = $('editProfileBtn'); els.myNavBtn = $('myNavBtn'); els.balanceTitleText = $('balanceTitleText');
    els.exportChatBtn = $('exportChatText'); els.exportChatSection = $('exportChatSection');
    els.exportChatArrow = $('exportChatArrow'); els.exportChatLinkInput = $('exportChatLinkInput');
    els.copyExportLinkBtn = $('copyExportLinkBtn'); els.copyExportTextBtn = $('copyExportTextBtn');
    els.exportLinkHint = $('exportLinkHint'); els.exportChatText = $('exportChatText');
    els.importChatBtn = $('importChatBtn'); els.importFileInput = $('importFileInput');
    els.colorDots = document.querySelectorAll('.color-dot'); els.colorDotCustom = $('colorDotCustom');
    els.colorModalOverlay = $('colorModalOverlay'); els.colorPreview = $('colorPreview');
    els.colorCustomInput = $('colorCustomInput'); els.colorRandomBtn = $('colorRandomBtn');
    els.colorCancelBtn = $('colorCancelBtn'); els.colorSaveBtn = $('colorSaveBtn');
    els.editOverlay = $('editOverlay'); els.editLeftBtn = $('editLeftBtn'); els.editRightBtn = $('editRightBtn');
    els.editAvatarSection = $('editAvatarSection'); els.editAvatarPreview = $('editAvatarPreview');
    els.editFileInput = $('editFileInput'); els.editNameInput = $('editNameInput'); els.editBioInput = $('editBioInput');
    els.editCropSection = $('editCropSection'); els.editCropImage = $('editCropImage'); els.editToastEl = $('editToastMessage');
    els.avatarStyleSection = $('avatarStyleSection'); els.styleCircleItem = $('styleCircleItem');
    els.styleSquareItem = $('styleSquareItem'); els.styleCirclePreview = $('styleCirclePreview');
    els.styleSquarePreview = $('styleSquarePreview'); els.swapAvatarBtn = $('swapAvatarBtn');
    els.switchStyleToggle = $('switchStyleToggle'); els.exportSchemeMenuItem = $('exportSchemeMenuItem');
    els.exportSchemeSwitch = $('exportSchemeSwitch'); els.speechCard = $('speechCard');
    els.appVersionDisplay = $('appVersionDisplay');
}

/* ================================================================
   3. Toast 提示功能
   ================================================================ */

// 暴露给全局使用
window._showToast = function(message, duration = 2000) {
    if (!els.toastEl) return;
    if (toastTimer) clearTimeout(toastTimer);
    els.toastEl.textContent = message;
    els.toastEl.classList.add('show');
    toastTimer = setTimeout(() => {
        els.toastEl.classList.remove('show');
        toastTimer = null;
    }, duration);
};

function showToast(message, duration = 2000) {
    window._showToast(message, duration);
}

/* ================================================================
   4. 模态框管理
   ================================================================ */

// 隐藏主模态框
function hideModal() {
    els.modalOverlay.classList.remove('show');
    if (window.history.state && window.history.state.modal === 'my_modal') {
        cleaningHistory = true;
        history.back();
    }
    if (exportCountdownTimer) { clearInterval(exportCountdownTimer); exportCountdownTimer = null; }
    pendingConfirmCallback = null;
    pendingCancelCallback = null;
}

// 显示主模态框
function showModal(opt) {
    els.modalConfirmBtn.disabled = false;
    els.modalConfirmBtn.style.background = '#3B82F6';
    els.modalConfirmBtn.style.color = 'white';
    els.modalConfirmBtn.textContent = opt.confirmText || '确定';
    els.modalCancelBtn.textContent = opt.cancelText || '取消';
    els.modalTitle.textContent = opt.title || '提示';
    els.modalMessage.innerHTML = opt.message || '';
    els.resetOptionsList.style.display = 'none';
    els.modalOverlay.classList.add('show');
    history.pushState({ modal: 'my_modal' }, '', location.href);
    pendingConfirmCallback = opt.onConfirm || null;
    pendingCancelCallback = opt.onCancel || null;
}

/* ================================================================
   5. 重置确认对话框
   ================================================================ */

const resetEls = { overlay: null, okBtn: null, cancelBtn: null, list: null, sel: [], cb: null };

function initReset() {
    resetEls.overlay = $('resetConfirmOverlay');
    resetEls.okBtn = $('resetConfirmOkBtn');
    resetEls.cancelBtn = $('resetConfirmCancelBtn');
    resetEls.list = $('resetConfirmList');
    resetEls.okBtn.addEventListener('click', () => {
        const k = [];
        resetEls.sel.forEach((s, i) => { if (s) k.push(...RESET_OPTIONS[i].keys); });
        if (!k.length) { showToast('未选择任何清除项'); return; }
        if (resetEls.cb) resetEls.cb(k);
        hideReset();
    });
    resetEls.cancelBtn.addEventListener('click', () => hideReset());
}

function showReset(cb) {
    if (!resetEls.overlay) initReset();
    resetEls.sel = new Array(RESET_OPTIONS.length).fill(true);
    resetEls.cb = cb;
    resetEls.list.innerHTML = RESET_OPTIONS.map((o, i) =>
        `<div class="reset-option-item selected" data-index="${i}"><div class="reset-option-check">✓</div><div class="reset-option-text">${o.text}</div></div>`
    ).join('');
    resetEls.list.querySelectorAll('.reset-option-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index);
            if (resetEls.sel[idx] && resetEls.sel.filter(s => s).length <= 1) {
                showToast('至少保留一个选项！');
                return;
            }
            resetEls.sel[idx] = !resetEls.sel[idx];
            item.classList.toggle('selected');
        });
    });
    resetEls.overlay.classList.add('show');
    history.pushState({ modal: 'resetConfirm' }, '', location.href);
}

function hideReset() {
    if (!resetEls.overlay) return;
    resetEls.overlay.classList.remove('show');
    if (window.history.state && window.history.state.modal === 'resetConfirm') {
        cleaningHistory = true;
        history.back();
    }
    resetEls.sel = [];
    resetEls.cb = null;
}

/* ================================================================
   6. 编辑确认对话框
   ================================================================ */

const editConfirmEls = { overlay: null, okBtn: null, cancelBtn: null, onOk: null, onCancel: null };

function initEditConfirm() {
    editConfirmEls.overlay = $('editConfirmOverlay');
    editConfirmEls.okBtn = $('editConfirmOkBtn');
    editConfirmEls.cancelBtn = $('editConfirmCancelBtn');
    editConfirmEls.okBtn.addEventListener('click', () => {
        const cb = editConfirmEls.onOk;
        hideEditConfirm();
        if (cb) cb();
    });
    editConfirmEls.cancelBtn.addEventListener('click', () => {
        const cb = editConfirmEls.onCancel;
        hideEditConfirm();
        if (cb) cb();
    });
}

function showEditConfirm(o) {
    if (!editConfirmEls.overlay) initEditConfirm();
    editConfirmEls.onOk = o.onOk || null;
    editConfirmEls.onCancel = o.onCancel || null;
    editConfirmEls.overlay.classList.add('show');
    history.pushState({ modal: 'editConfirm' }, '', location.href);
}

function hideEditConfirm() {
    if (!editConfirmEls.overlay) return;
    editConfirmEls.overlay.classList.remove('show');
    if (window.history.state && window.history.state.modal === 'editConfirm') {
        cleaningHistory = true;
        history.back();
    }
    editConfirmEls.onOk = null;
    editConfirmEls.onCancel = null;
}

/* ================================================================
   7. 主题管理
   ================================================================ */

function applyTheme(mode) {
    const isDark = (mode === 'dark') || (mode === 'auto' && systemDarkQuery.matches);
    document.body.classList.toggle('dark-mode', isDark);
    if (els.themeLight) els.themeLight.classList.toggle('active', mode === 'light');
    if (els.themeDark) els.themeDark.classList.toggle('active', mode === 'dark');
    if (els.themeAuto) els.themeAuto.classList.toggle('active', mode === 'auto');
}

function saveThemeMode(mode) {
    currentThemeMode = mode;
    setStorage('theme_mode', mode);
    applyTheme(mode);
}

function loadTheme() {
    currentThemeMode = getStorage('theme_mode') || 'auto';
    applyTheme(currentThemeMode);
}

systemDarkQuery.addEventListener('change', () => {
    if (currentThemeMode === 'auto') applyTheme('auto');
});

/* ================================================================
   8. 头部颜色管理
   ================================================================ */

function getHeaderGradient() {
    return getStorage('header_gradient') || 'linear-gradient(145deg, #667eea 0%, #764ba2 100%)';
}

function isLightColor(hex) {
    const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 150;
}

function applyHeaderColor() {
    if (els.headerArea) els.headerArea.style.background = getHeaderGradient();
    updateHeaderTextColor();
}

function updateHeaderTextColor() {
    const g = getHeaderGradient();
    let c = '#667eea';
    const m = g.match(/#[0-9a-fA-F]{6}/);
    if (m) c = m[0];
    const l = isLightColor(c);
    const h1 = els.headerArea.querySelector('h1'), p = els.headerArea.querySelector('p');
    if (h1) h1.style.color = l ? '#1a1a1a' : '#ffffff';
    if (p) p.style.color = l ? '#1a1a1a' : '#ffffff';
}

function applyHeaderGradient(g) {
    setStorage('header_gradient', g);
    applyHeaderColor();
}

function extractColorFromGradient(g) {
    const m = g.match(/#[0-9a-fA-F]{6}/);
    return m ? m[0] : '#667eea';
}

function updateColorDotSelection() {
    const cur = getHeaderGradient();
    let pre = false;
    if (els.colorDots) {
        els.colorDots.forEach(d => {
            if (d.getAttribute('data-gradient') === cur) { d.classList.add('active'); pre = true; }
            else d.classList.remove('active');
        });
    }
    if (pre) {
        els.colorDotCustom.classList.remove('active');
        els.colorDotCustom.style.background = '#cbd5e1';
        els.colorDotCustom.querySelector('.plus-icon').style.color = '#fff';
    } else {
        els.colorDotCustom.classList.add('active');
        const c = extractColorFromGradient(cur);
        els.colorDotCustom.style.background = c;
        els.colorDotCustom.querySelector('.plus-icon').style.color = isLightColor(c) ? '#1a1a1a' : '#ffffff';
    }
}

/* ================================================================
   9. 开关组件
   ================================================================ */

function getSwitchStyle() { return getStorage('switch_style') || 'classic'; } // minimal是精简，classic是经典

function applySwitchStyle(style) {
    document.querySelectorAll('.toggle-switch-wrap').forEach(wrap => {
        wrap.classList.remove('style-classic', 'style-minimal');
        wrap.classList.add('style-' + style);
    });
}

function saveSwitchStyle(style) {
    setStorage('switch_style', style);
    applySwitchStyle(style);
}

function updateSwitchStyleText() {
    const wrap = els.switchStyleToggle;
    if (!wrap) return;
    const style = getSwitchStyle();
    const labels = wrap.querySelectorAll('.switch-label');
    if (labels.length >= 2) {
        labels[0].textContent = style === 'classic' ? '精简' : '经典';
        labels[1].textContent = style === 'classic' ? '经典' : '精简';
    }
}

// 绑定单个开关点击
function bindToggleSwitch(wrap) {
    if (!wrap || wrap.dataset.bound === 'true') return;
    wrap.dataset.bound = 'true';
    wrap.addEventListener('click', () => {
        const key = wrap.dataset.key;
        const offValue = wrap.dataset.offValue || 'false';
        const onValue = wrap.dataset.onValue || 'true';
        const defaultOn = wrap.dataset.defaultOn === 'true';
        const allowEmpty = wrap.dataset.allowEmpty === 'true';
        let current = getStorage(key);
        let isOn;
        if (allowEmpty) { isOn = current === onValue; }
        else { if (current === null) current = defaultOn ? 'true' : 'false'; isOn = current === 'true'; }
        const newIsOn = !isOn;
        const newValue = allowEmpty ? (newIsOn ? onValue : (offValue || 'local')) : (newIsOn ? 'true' : 'false');
        setStorage(key, newValue);
        updateToggleSwitchUI(wrap);
        handleSwitchChange(key, newValue, newIsOn);
    });
}

// 更新单个开关UI
function updateToggleSwitchUI(wrap) {
    const key = wrap.dataset.key;
    const offValue = wrap.dataset.offValue || 'false';
    const onValue = wrap.dataset.onValue || 'true';
    const defaultOn = wrap.dataset.defaultOn === 'true';
    const allowEmpty = wrap.dataset.allowEmpty === 'true';
    let current = getStorage(key);
    let isOn;
    if (allowEmpty) { isOn = current === onValue; }
    else { if (current === null) current = defaultOn ? 'true' : 'false'; isOn = current === 'true'; }
    if (isOn) { wrap.classList.add('on'); } else { wrap.classList.remove('on'); }
}

// 处理开关变化
function handleSwitchChange(key, value, isOn) {
    switch (key) {
        case 'multiturn_enabled': multiturnEnabled = isOn; showToast(isOn ? '✅ 多轮对话已开启' : '❎ 多轮对话已关闭'); break;
        case 'memory_send_enabled': memorySendEnabled = isOn; showToast(isOn ? '✅ 记忆已开启，AI 将读取记忆' : '❎ 记忆已关闭，AI 不会读取记忆'); break;
        case 'avatar_enabled': avatarEnabled = isOn; updateAvatarStyleVisibility(); showToast(isOn ? '✅ 头像已显示' : '❎ 头像已隐藏'); break;
        case 'auto_speech_enabled': autoSpeechEnabled = isOn; showToast(isOn ? '✅ 自动朗读已开启' : '❎ 自动朗读已关闭'); break;
        case 'pause_on_focus': showToast(isOn ? '✅ 点击输入框将暂停朗读' : '❎ 点击输入框不再暂停朗读'); break;
        case 'compact_view': showToast(isOn ? '✅ 精简模式已开启' : '❎ 精简模式已关闭'); break;
        case 'tell_ai_nickname': showToast(isOn ? '✅ 已开启，AI 会知道你的昵称' : '❎ 已关闭，AI 不会知道你的昵称'); break;
        case 'tell_ai_bio': showToast(isOn ? '✅ 已开启，AI 会知道你的简介' : '❎ 已关闭，AI 不会知道你的简介'); break;
        case 'local_model': showToast(isOn ? '✅ 本地指令已开启' : '❎ 本地指令已关闭'); break;
        case 'ai_instruction': showToast(isOn ? '✅ AI指令已开启' : '❎ AI指令已关闭'); break;
        case 'export_scheme': break;
        case 'switch_style':
            saveSwitchStyle(value);
            updateSwitchStyleText();
            showToast(value === 'classic' ? '已切换至经典样式' : '已切换至精简样式');
            break;
    }
}

// 加载所有开关状态
function loadAllSwitchStates() {
    document.querySelectorAll('.toggle-switch-wrap[data-key]').forEach(wrap => {
        updateToggleSwitchUI(wrap);
        if (wrap === els.exportSchemeSwitch || wrap === els.switchStyleToggle) return;
        bindToggleSwitch(wrap);
    });
    multiturnEnabled = getStorage('multiturn_enabled') === 'true';
    memorySendEnabled = getStorage('memory_send_enabled') === 'true';
    avatarEnabled = getStorage('avatar_enabled') === 'true';
    avatarStyle = getStorage('avatar_style') || 'circle';
    autoSpeechEnabled = getStorage('auto_speech_enabled') !== 'false';
    updateSwitchStyleText();
}

/* ================================================================
   10. API Key 管理
   ================================================================ */

function loadApiKeys() {
    let key = getStorage('deepseek_api_key');
    if (key === null) { key = ''; setStorage('deepseek_api_key', ''); }
    els.apiKeyInput.value = key;
    els.apiKeyInput.type = 'password';
    els.toggleApiKeyVisibility.textContent = '显示';
    lastApiKeyValue = key;
}

/* ================================================================
   11. 导出方案 UI 更新
   ================================================================ */

function updateExportSchemeUI() {
    const s = getExportScheme();
    if (els.exportSchemeMenuItem) els.exportSchemeMenuItem.style.display = s ? 'flex' : 'none';
    if (els.exportSchemeSwitch) updateToggleSwitchUI(els.exportSchemeSwitch);
}

/* ================================================================
   12. 导出区域折叠切换
   ================================================================ */

function toggleExportSection() {
    if (els.exportChatSection.style.display === 'block') {
        els.exportChatSection.style.display = 'none';
        const emojis = ['🪅', '🌟'];
        els.exportChatArrow.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        els.exportChatArrow.style.transform = 'rotate(0deg)';
        resetExportHint();
        if (typeof exportLinkData !== 'undefined' && exportLinkData.isActive && exportLinkData.remainingSeconds > 0 && exportLinkData.url) {
            updateHeaderWithLink(exportLinkData.url, exportLinkData.remainingSeconds);
        }
        return;
    }
    updateExportChatWordCount();
    const scheme = getExportScheme();
    if (scheme === 'local') {
        clearExportLinkState();
        setHeaderToDefault();
        els.exportChatSection.style.display = 'block';
        els.exportChatArrow.textContent = '🌸';
        els.exportChatArrow.style.transform = 'rotate(360deg)';
        els.exportChatLinkInput.value = '点击右侧复制按钮即可复制全文';
        els.exportChatLinkInput.readOnly = true;
        els.copyExportLinkBtn.style.display = 'none';
        els.copyExportTextBtn.style.display = 'inline-block';
        els.exportLinkHint.textContent = '✨ 本地导出模式：点击右侧按钮复制全文';
        return;
    }
    if (scheme === 'cloud') {
        els.exportChatSection.style.display = 'block';
        els.exportChatArrow.textContent = '🍤';
        els.exportChatArrow.style.transform = 'rotate(360deg)';
        els.copyExportLinkBtn.style.display = 'inline-block';
        els.copyExportTextBtn.style.display = 'inline-block';
        performExport();
        return;
    }
    showModal({
        title: '⚠️温馨提示⚠️（该提示仅显示一次）',
        message: `导出聊天记录功能会将您的<strong>聊天记录</strong>上传至<strong>第三方服务器(textdb.online)</strong>，由第三方提供服务。<strong style="color:red;">我们将在您获取下载链接后的30秒内，尝试对链接的内容进行清除</strong><br><b如果您点击「取消」后我们不会将您的<strong>聊天记录</strong>上传至<strong>第三方服务器(textdb.online)</strong>进行处理，你可以点击提示旁的「复制全文」按钮进行聊天记录的导出<br>如果您点击「确定」后我们会将您的<strong>聊天记录</strong>上传至<strong>第三方服务器(textdb.online)</strong>进行处理。<strong style="color:red;">在您获取下载链接后的30秒内，尝试对链接的内容进行清除</strong><br><br>后续您可以在「聊天记录导出设置」进行对导出方式进行设置<strong>「本地」</strong>为复制纯文本<strong>「云端」</strong>为将聊天记录上传至<strong>第三方服务器(textdb.online)</strong><br><br><h3>⚠️再次提示：该警告仅提示一次⚠️</h3>`,
        confirmText: '确定', cancelText: '取消',
        onConfirm: () => {
            saveCloudWarningState();
            setExportScheme('cloud');
            els.exportChatSection.style.display = 'block';
            els.exportChatArrow.textContent = '🏵️';
            els.exportChatArrow.style.transform = 'rotate(360deg)';
            els.copyExportLinkBtn.style.display = 'inline-block';
            els.copyExportTextBtn.style.display = 'inline-block';
            performExport();
        },
        onCancel: () => {
            setExportScheme('local');
            els.exportChatSection.style.display = 'block';
            els.exportChatArrow.textContent = '🌺';
            els.exportChatArrow.style.transform = 'rotate(360deg)';
            els.exportChatLinkInput.value = '点击右侧复制按钮即可复制全文';
            els.exportChatLinkInput.readOnly = true;
            els.copyExportLinkBtn.style.display = 'none';
            els.copyExportTextBtn.style.display = 'inline-block';
            els.exportLinkHint.textContent = '本地导出模式：点击右侧按钮复制全文';
        }
    });
    els.modalConfirmBtn.style.background = '#ef4444';
}

/* ================================================================
   13. 绑定所有 UI 交互事件
   ================================================================ */

function bindUIActions() {
    // 模态框按钮
    if (els.modalCancelBtn) els.modalCancelBtn.addEventListener('click', () => { if (pendingCancelCallback) pendingCancelCallback(); hideModal(); });
    if (els.modalConfirmBtn) els.modalConfirmBtn.addEventListener('click', () => { if (pendingConfirmCallback) pendingConfirmCallback(); hideModal(); });

    // 主题切换
    if (els.themeLight) els.themeLight.addEventListener('click', () => {
        saveThemeMode('light');
        localStorage.setItem('toolbox_theme', 'milk');
    });
    if (els.themeDark) els.themeDark.addEventListener('click', () => {
        saveThemeMode('dark');
        localStorage.setItem('toolbox_theme', 'glass');
    });
    if (els.themeAuto) els.themeAuto.addEventListener('click', () => {
        saveThemeMode('auto');
    localStorage.setItem('toolbox_theme', 'auto');
    });

    // 微软语速控制
    if (els.microsoftSpeedMinusBtn) els.microsoftSpeedMinusBtn.addEventListener('click', () => {
        let speed = getMicrosoftSpeechSpeed();
        speed = Math.max(0.5, speed - 0.1);
        speed = Math.round(speed * 10) / 10;
        saveMicrosoftSpeechSpeed(speed);
    });
    if (els.microsoftSpeedPlusBtn) els.microsoftSpeedPlusBtn.addEventListener('click', () => {
        let speed = getMicrosoftSpeechSpeed();
        speed = Math.min(2.0, speed + 0.1);
        speed = Math.round(speed * 10) / 10;
        saveMicrosoftSpeechSpeed(speed);
    });
    if (els.voiceSelect) els.voiceSelect.addEventListener('change', () => {
            setStorage('microsoft_voice', els.voiceSelect.value);
            const selectedText = els.voiceSelect.options[els.voiceSelect.selectedIndex].text;
            const voiceName = selectedText.split('(')[0].trim();
            showToast('音色已切换' + voiceName);
    });
    if (els.microsoftTestBtn) els.microsoftTestBtn.addEventListener('click', doMicrosoftTest);

    // API Key 显示/隐藏
    if (els.toggleApiKeyVisibility) els.toggleApiKeyVisibility.addEventListener('click', () => {
        if (els.apiKeyInput.type === 'password') { els.apiKeyInput.type = 'text'; els.toggleApiKeyVisibility.textContent = '隐藏'; }
        else { els.apiKeyInput.type = 'password'; els.toggleApiKeyVisibility.textContent = '显示'; }
    });

    // API Key 折叠
if (els.apiKeyToggleBtn) els.apiKeyToggleBtn.addEventListener('click', () => {
        const v = els.apiKeySection.style.display === 'block';
        els.apiKeySection.style.display = v ? 'none' : 'block';
        els.apiKeyArrow.textContent = v ? '🔒' : '🔑';
        if (v) {
            els.apiKeyArrow.style.transform = 'rotate(0deg)';
        } else {
            els.apiKeyArrow.style.transform = 'rotate(360deg)';
        }
    });

    // API Key 输入
    if (els.apiKeyInput) els.apiKeyInput.addEventListener('blur', () => {
        const nk = els.apiKeyInput.value.trim();
        if (nk !== lastApiKeyValue) {
            lastApiKeyValue = nk;
            setStorage('deepseek_api_key', nk);
            showToast(nk.startsWith('sk-') && nk.length >= 30 ? '🔑 API Key 已保存' : nk === '' ? '⚠️ API Key 已清空' : '❌ API Key 格式错误');
            if (nk.startsWith('sk-')) fetchBalance();
        }
    });
    if (els.apiKeyInput) els.apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            els.apiKeyInput.blur();
        }
    });

    // 开关绑定（排除特殊开关）
    document.querySelectorAll('.toggle-switch-wrap[data-key]').forEach(wrap => {
        if (wrap === els.exportSchemeSwitch) {
            wrap.addEventListener('click', () => {
                const currentScheme = getExportScheme();
                if (currentScheme === 'local') {
                    if (!cloudWarningAccepted) {
                        showModal({
                            title: '⚠️温馨提示⚠️（该提示仅提示一次）',
                            message: `云端导出聊天记录功能会将您的<strong>聊天记录</strong>上传至<strong>第三方服务器(textdb.online)</strong>，由第三方提供服务。我们将在<strong style="color:red;">您获取下载链接后的30秒内，尝试对链接的内容进行清除</strong><br><br><h3>⚠️再次提示：该警告仅提示一次⚠️</h3>`,
                            confirmText: '确定', cancelText: '取消',
                            onConfirm: () => { saveCloudWarningState(); setExportScheme('cloud'); showToast('已切换为云端导出'); },
                            onCancel: () => {}
                        });
                        els.modalConfirmBtn.style.background = '#ef4444';
                    } else { setExportScheme('cloud'); showToast('已切换为云端导出'); }
                } else { setExportScheme('local'); showToast('已切换为本地导出'); }
            });
            return;
        }
        if (wrap === els.switchStyleToggle) {
            wrap.addEventListener('click', () => {
                const current = getSwitchStyle();
                const newStyle = current === 'classic' ? 'minimal' : 'classic';
                saveSwitchStyle(newStyle);
                updateToggleSwitchUI(els.switchStyleToggle);
                updateSwitchStyleText();
                showToast(newStyle === 'classic' ? '已切换至经典样式' : '已切换至精简样式');
            });
            return;
        }
        bindToggleSwitch(wrap);
    });

    // 颜色点选择
    if (els.colorDots) els.colorDots.forEach(d => d.addEventListener('click', () => {
        applyHeaderGradient(d.getAttribute('data-gradient'));
        updateColorDotSelection();
        showToast('✅ 颜色应用成功');
    }));
    if (els.colorDotCustom) els.colorDotCustom.addEventListener('click', () => {
        customColorBeforeOpen = getHeaderGradient();
        els.colorCustomInput.value = '#3CA6F1';
        updateColorPreview(els.colorCustomInput.value);
        els.colorModalOverlay.classList.add('show');
        history.pushState({ modal: 'my_colorModal' }, '', location.href);
    });

    // 颜色预览更新
    function updateColorPreview(h) { els.colorPreview.style.background = /^#[0-9a-fA-F]{6}$/.test(h) ? h : '#cccccc'; }
    if (els.colorCustomInput) els.colorCustomInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            els.colorCustomInput.blur();
        }
    });
    if (els.colorCustomInput) els.colorCustomInput.addEventListener('blur', () => {
        let v = els.colorCustomInput.value.trim();
        if (v === '') {
            v = Math.random() < 0.5 ? '#60a5fa' : '#3CA6F1';
        } else if (!v.startsWith('#')) {
            v = '#' + v;
        }
        els.colorCustomInput.value = v;
        updateColorPreview(v);
    });
    if (els.colorRandomBtn) els.colorRandomBtn.addEventListener('click', () => {
        let h = '#';
        for (let i = 0; i < 6; i++) h += '0123456789ABCDEFabcdef'.charAt(Math.floor(Math.random() * 16));
        els.colorCustomInput.value = h;
        updateColorPreview(h);
    });
    if (els.colorCancelBtn) els.colorCancelBtn.addEventListener('click', () => {
        els.colorModalOverlay.classList.remove('show');
        if (window.history.state && window.history.state.modal === 'my_colorModal') { cleaningHistory = true; history.back(); }
        applyHeaderGradient(customColorBeforeOpen);
        updateColorDotSelection();
    });
    if (els.colorSaveBtn) els.colorSaveBtn.addEventListener('click', () => {
        let v = els.colorCustomInput.value.trim();
        if (!v.startsWith('#')) v = '#' + v;
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) { showToast('颜色代码错误'); return; }
        applyHeaderGradient(`linear-gradient(145deg, ${v} 0%, ${v} 100%)`);
        updateColorDotSelection();
        els.colorModalOverlay.classList.remove('show');
        if (window.history.state && window.history.state.modal === 'my_colorModal') { cleaningHistory = true; history.back(); }
        showToast('✅ 颜色应用成功');
    });

    // 头像样式切换
    if (els.styleCircleItem) els.styleCircleItem.addEventListener('click', () => {
        avatarStyle = 'circle';
        setStorage('avatar_style', 'circle');
        updateAvatarStyleSelectionUI();
        showToast('🟠已切换圆形头像');
    });
    if (els.styleSquareItem) els.styleSquareItem.addEventListener('click', () => {
        avatarStyle = 'square';
        setStorage('avatar_style', 'square');
        updateAvatarStyleSelectionUI();
        showToast('🟧已切换方形头像');
    });
    if (els.swapAvatarBtn) els.swapAvatarBtn.addEventListener('click', function() {
    const ci = els.styleCirclePreview?.querySelector('img'), si = els.styleSquarePreview?.querySelector('img');
    if (ci && si) { const t = ci.src; ci.src = si.src; si.src = t; }
    const svg = this.querySelector('svg');
    if (svg) {
        let currentAngle = parseInt(svg.dataset.angle) || 0;
        currentAngle += 360;
        svg.style.transform = `rotate(${currentAngle}deg)`;
        svg.dataset.angle = currentAngle;
    }
    showToast('🔄头像位置已切换');
    });

    // 编辑资料
    if (els.editProfileBtn) els.editProfileBtn.addEventListener('click', openEditOverlay);
    if (els.profileAvatar) els.profileAvatar.addEventListener('click', openEditOverlay);
    if (els.editNameInput) els.editNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); els.editNameInput.blur(); }
    });
    if (els.editBioInput) els.editBioInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); els.editBioInput.blur(); }
    });
    els.editFileInput?.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (!f.type.startsWith('image/')) { showEditToast('⚠️ 请选择图片文件'); els.editFileInput.value = ''; return; }
        const r = new FileReader();
        r.onload = ev => showCropper(ev.target.result);
        r.readAsDataURL(f);
        els.editFileInput.value = '';
    });
    els.editRightBtn?.addEventListener('click', () => {
        if (isCropping) { confirmCrop(); return; }
        if (!hasEditChanges()) { closeEditOverlay(() => showToast('没有任何修改')); return; }
        performEditSave();
        closeEditOverlay(() => showToast('资料已保存'));
    });
    els.editLeftBtn?.addEventListener('click', () => {
        if (isCropping) { hideCropper(); return; }
        if (!hasEditChanges()) { closeEditOverlay(); return; }
        showEditConfirm({
            onOk: () => { performEditSave(); closeEditOverlay(() => showToast('资料已保存')); },
            onCancel: () => { closeEditOverlay(); }
        });
    });

    // 导出相关
if (els.exportChatBtn) {
    const menuItem = els.exportChatBtn.closest('.menu-item');
    if (menuItem) {
        menuItem.addEventListener('click', toggleExportSection);
    } else {
        els.exportChatBtn.addEventListener('click', toggleExportSection);
    }
}
    if (els.importChatBtn) els.importChatBtn.addEventListener('click', () => {
        els.importFileInput.value = '';
        els.importFileInput.click();
    });
    if (els.importFileInput) els.importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleImportFile(file);
    });
    if (els.copyExportLinkBtn) els.copyExportLinkBtn.addEventListener('click', () => {
        const l = els.exportChatLinkInput.value;
        if (!l || l === '正在上传...') { showToast('请先生成导出链接'); return; }
        copyTextToClipboard(l).then(s => {
            if (s) { showToast('✅ 链接已复制到剪贴板'); }
            else {
                els.exportLinkHint.textContent = '⚠️ 复制失败，请手动选中链接复制';
                showToast('⚠️ 复制失败，请手动复制');
                els.exportChatLinkInput.focus();
            }
        });
    });
    if (els.copyExportTextBtn) els.copyExportTextBtn.addEventListener('click', () => {
        const h = getStorage('deepseek_history_v6');
        if (!h) { showToast('暂无聊天记录可复制'); return; }
        let ht;
        try { ht = JSON.parse(h); } catch(e) { showToast('聊天记录数据异常'); return; }
        copyTextToClipboard(buildExportText(ht)).then(s => showToast(s ? '✅ 全文已复制到剪贴板' : '⚠️ 复制失败'));
    });
    if (els.exportChatLinkInput) els.exportChatLinkInput.addEventListener('dblclick', () => els.exportChatLinkInput.select());

    // 重置、记忆、余额等
    if (els.resetToDefaultBtn) els.resetToDefaultBtn.addEventListener('click', () => {
        showReset((keys) => { if (!keys.length) return; performResetToDefault(keys); });
    });
    if (els.refreshMemoryBtn) els.refreshMemoryBtn.addEventListener('click', () => { loadMemory(); renderMemoryList(); updateStats(); showToast('🔄 记忆列表已刷新'); });
    if (els.clearAllMemoryBtn) els.clearAllMemoryBtn.addEventListener('click', () => {
        if (!memoryStore.length) return showToast('当前没有任何记忆可清空');
        showModal({
            title: '⚠️ 确认清空', message: '确定要清空所有记忆吗？',
            onConfirm: () => { memoryStore = []; setStorage('deepseek_memory_v6', '[]'); renderMemoryList(); updateStats(); showToast('✅ 所有记忆已清空'); }
        });
        els.modalConfirmBtn.style.background = '#ef4444';
    });
    if (els.resetStatsBtn) els.resetStatsBtn.addEventListener('click', () => {
        removeStorage('oldest_balance');
        balanceRetryCount = 0;
        if (balanceRetryTimer) { clearTimeout(balanceRetryTimer); balanceRetryTimer = null; }
        fetchBalance().then(() => showToast('✅ 余额统计已重置'));
    });
    if (els.feedbackLink) els.feedbackLink.addEventListener('click', () => {
        window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('API 调用工具 - 意见/问题反馈')}&body=${encodeURIComponent('【应用版本：' + (getStorage('app_version') || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '')) + '】请在下方描述您的问题或建议：')}`;
    });
    if (els.myNavBtn && window.location.href.includes('My.html')) els.myNavBtn.addEventListener('click', (e) => { e.preventDefault(); location.reload(); });

    // 标题栏点击复制链接
    if (els.headerArea) {
        els.headerArea.addEventListener('click', (e) => {
            if (e.target.closest('.toast-container')) return;
            if (typeof exportLinkData !== 'undefined' && exportLinkData.isActive) {
                if (typeof handleHeaderClick === 'function') handleHeaderClick();
            }
        });
    }

    // 跨标签页数据同步
    window.addEventListener('storage', (e) => {
        if (e.key === 'ai_avatar') {
            const ai = localStorage.getItem('ai_avatar') || 'AI-tx.jpg';
            const circleImg = document.querySelector('#styleCirclePreview img');
            if (circleImg) circleImg.src = ai;
        }
        if (e.key === 'user_profile') {
            updateAvatarStylePreviews();
        }
    });
}

/* ================================================================
   14. 初始化入口
   ================================================================ */

function init() {
    initEls();
    if (getStorage('auto_speech_enabled') === null) setStorage('auto_speech_enabled', 'true');
    if (getStorage('local_model') === null) setStorage('local_model', 'true');
    if (getStorage('ai_instruction') === null) setStorage('ai_instruction', 'true');
    loadTheme();
    loadProfile();
    updateAvatarStylePreviews();
    loadApiKeys();
    loadMemory();
    renderMemoryList();
    updateStats();
    if (els.appVersionDisplay) {
        els.appVersionDisplay.textContent = getStorage('app_version') || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '—');
    }
    checkPendingToast();
    loadAllSwitchStates();
    updateAvatarStyleVisibility();
    updateAvatarStyleSelectionUI();
    loadSpeechSettings();
    fetchBalance();
    applyHeaderColor();
    updateColorDotSelection();
    checkAndCleanupResidual();
    updateExportChatWordCount();
    updateExportSchemeUI();
    loadCloudWarningState();
    setHeaderToDefault();
    applySwitchStyle(getSwitchStyle());
    bindUIActions();
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('show'));
}

// 启动
init();