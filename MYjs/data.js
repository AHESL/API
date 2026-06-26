"use strict";

/* ================================================================
   1. 常量配置
   ================================================================ */

// 反馈邮箱
const FEEDBACK_EMAIL = 'abc082576@163.com';

// 导入文件大小限制 1.5MB
const MAX_IMPORT_FILE_SIZE = 1.5 * 1024 * 1024;

// TextDB 服务地址
const TEXTDB_UPDATE_URL = 'https://api.textdb.online/update/';
const TEXTDB_BASE_URL = 'https://textdb.online/';

// 导出链接有效期（秒）
const EXPORT_EXPIRE_SECONDS = 30;

// 重置选项配置：每个选项包含显示文本和需要清除的 localStorage key 列表
const RESET_OPTIONS = [
    { text: '资料信息（个人资料/AI资料）', keys: ['user_profile', 'ai_avatar', 'ai_persona'] },
    { text: 'API Key', keys: ['deepseek_api_key'] },
    { text: '所有聊天记录与记忆', keys: ['deepseek_history_v6', 'deepseek_memory_v6'] },
    { text: '主题设置', keys: ['theme_mode', 'header_gradient', 'switch_style'] },
    { text: '开关设置', keys: ['multiturn_enabled', 'avatar_style', 'avatar_enabled', 'memory_send_enabled', 'microsoft_speech_speed', 'auto_speech_enabled', 'export_scheme', 'cloud_warning_accepted', 'pause_on_focus', 'compact_view', 'tell_ai_nickname', 'tell_ai_bio', 'local_model', 'ai_instruction'] },
    { text: '工具箱设置', keys: ['toolbox_theme', 'toolbox_avatar_style', 'toolbox_loading_animation', 'toolbox_avatar', 'toolbox_nickname'] },
    { text: '其他缓存数据', keys: ['pending_toast_message', 'app_version', 'custom_app_icon', 'export_warning_accepted', 'export_pending_cleanup'] }
];

// 所有 localStorage key 的常量映射，便于统一管理
const KEYS_DATA = {
    API_KEY: 'deepseek_api_key',
    HISTORY: 'deepseek_history_v6',
    MEMORY: 'deepseek_memory_v6',
    USER_PROFILE: 'user_profile',
    MULTITURN: 'multiturn_enabled',
    THEME_MODE: 'theme_mode',
    HEADER_GRADIENT: 'header_gradient',
    AVATAR_STYLE: 'avatar_style',
    AVATAR_ENABLED: 'avatar_enabled',
    MEMORY_SEND: 'memory_send_enabled',
    MICROSOFT_SPEECH_SPEED: 'microsoft_speech_speed',
    AUTO_SPEECH: 'auto_speech_enabled',
    AI_AVATAR: 'ai_avatar',
    AI_PERSONA: 'ai_persona',
    EXPORT_SCHEME: 'export_scheme',
    CLOUD_WARNING: 'cloud_warning_accepted',
    PENDING_TOAST: 'pending_toast_message',
    APP_VERSION: 'app_version',
    EXPORT_WARNING: 'export_warning_accepted',
    EXPORT_CLEANUP: 'export_pending_cleanup',
    CUSTOM_ICON: 'custom_app_icon',
    OLDEST_BALANCE: 'oldest_balance',
    SWITCH_STYLE: 'switch_style',
    VOICE: 'microsoft_voice',
};

/* ================================================================
   2. 全局状态变量
   ================================================================ */

let memoryStore = [];                    // 记忆列表数据
let balanceRetryTimer = null;            // 余额查询重试计时器
let exportCountdownTimer = null;         // 导出倒计时
let hintCountdownTimer = null;           // 提示倒计时
let exportCleanupTimeout = null;         // 导出清理超时
let cloudWarningAccepted = false;        // 云端警告是否已接受
let cleaningHistory = false;             // 清理历史标志（用于页面回退）

// 导出链接状态管理
let exportLinkData = {
    url: '',
    remainingSeconds: 0,
    timer: null,
    bigTitleTimer: null,
    isActive: false
};

/* ================================================================
   3. 存储工具函数
   ================================================================ */

/** 从 localStorage 读取数据（简写） */
function getStorage(key) {
    return localStorage.getItem(key);
}

/** 写入 localStorage（简写） */
function setStorage(key, value) {
    localStorage.setItem(key, value);
}

/** 从 localStorage 删除数据（简写） */
function removeStorage(key) {
    localStorage.removeItem(key);
}

/* ================================================================
   4. Toast 提示工具
   ================================================================ */

/**
 * 显示 Toast 提示
 * @param {string} message - 提示内容
 * @param {number} duration - 显示时长（毫秒），默认 2000ms
 */
function showToast(message, duration = 2000) {
    if (typeof window._showToast === 'function') {
        window._showToast(message, duration);
    }
}

/* ================================================================
   5. 文本处理工具
   ================================================================ */

/** 去除 HTML 标签（用于导入记录安全） */
function stripHtmlTags(str) {
    return str.replace(/<[^>]*>/g, '');
}

/** 导入内容消毒（去除 HTML 标签） */
function sanitizeImportContent(text) {
    return stripHtmlTags(text);
}

/* ================================================================
   6. 记忆管理
   ================================================================ */

/** 从 localStorage 加载记忆数据到内存 */
function loadMemory() {
    try {
        memoryStore = JSON.parse(getStorage(KEYS_DATA.MEMORY)) || [];
    } catch (e) {
        memoryStore = [];
    }
}

/**
 * 渲染记忆列表到页面
 * 依赖全局 els 对象（在 HTML 中定义）
 */
function renderMemoryList() {
    if (typeof els === 'undefined') return;
    if (!els.memoryListContainer) return;

    if (!memoryStore.length) {
        els.memoryListContainer.innerHTML = '<div class="empty-memory">✨ 还没有记忆,去首页对话中让AI记住你吧!</div>';
        return;
    }

    // 倒序显示（最新在上）
    els.memoryListContainer.innerHTML = memoryStore.slice().reverse().map(m =>
        `<div class="memory-item"><span>${m.content}</span><span class="memory-delete" data-id="${m.id}">删除</span></div>`
    ).join('');

    // 绑定删除事件
    els.memoryListContainer.querySelectorAll('.memory-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            memoryStore = memoryStore.filter(m => m.id !== btn.dataset.id);
            setStorage(KEYS_DATA.MEMORY, JSON.stringify(memoryStore));
            renderMemoryList();
            updateStats();
            showToast('✅ 已删除一条记忆');
        });
    });
}

/* ================================================================
   7. 统计信息更新
   ================================================================ */

/** 更新对话次数、记忆数量、存储用量等 */
function updateStats() {
    if (typeof els === 'undefined') return;

    // 计算对话次数（仅 user 消息）
    let history = [];
    try {
        history = JSON.parse(getStorage(KEYS_DATA.HISTORY) || '[]');
    } catch (e) {}
    if (els.conversationCount) {
        els.conversationCount.textContent = history.filter(m => m.role === 'user').length;
    }

    // 记忆数量
    if (els.memoryCount) {
        els.memoryCount.textContent = memoryStore.length;
    }

    // 存储用量（估算）
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        bytes += key.length * 2 + val.length * 2;
    }
    if (els.storageUsage) {
        els.storageUsage.textContent = (bytes / 1024).toFixed(2) + ' KB';
    }
}

/* ================================================================
   8. 余额查询（DeepSeek API）
   ================================================================ */

let balanceRetryCount = 0;          // 重试计数器
const MAX_BALANCE_RETRIES = 6;      // 最大重试次数

/**
 * 获取 DeepSeek 账户余额
 * 成功时更新显示，失败时根据错误类型显示友好提示并自动重试
 */
async function fetchBalance() {
    if (typeof els === 'undefined') return;

    const key = getStorage(KEYS_DATA.API_KEY);

    // 如果没有有效的 API Key，显示提示
    if (!key || !key.startsWith('sk-') || key.length < 30) {
        if (els.balanceTitleText) els.balanceTitleText.textContent = '余额查询（没有设置API key）';
        if (els.totalBalance) els.totalBalance.textContent = '—';
        if (els.grantedBalance) els.grantedBalance.textContent = '—';
        if (els.usedBalance) els.usedBalance.textContent = '—';
        return;
    }

    try {
        const response = await fetch('https://api.deepseek.com/user/balance', {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${key}`
            }
        });

        if (!response.ok) {
            throw new Error(response.status === 401 ? 'API Key 填写错误或已过期' : `网络错误 (${response.status})`);
        }

        const data = await response.json();
        const info = data.balance_infos[0];
        const currentBalance = parseFloat(info.total_balance);

        // 更新 UI
        if (els.balanceTitleText) els.balanceTitleText.textContent = '余额查询';
        if (els.totalBalance) els.totalBalance.textContent = info.total_balance + ' 元';
        if (els.grantedBalance) els.grantedBalance.textContent = info.granted_balance + ' 元';

        // 计算已用余额（与最旧余额比较）
        const oldest = getStorage(KEYS_DATA.OLDEST_BALANCE);
        if (oldest === null) {
            setStorage(KEYS_DATA.OLDEST_BALANCE, currentBalance.toString());
            if (els.usedBalance) els.usedBalance.textContent = '0.00 元';
        } else if (els.usedBalance) {
            const used = Math.max(0, parseFloat(oldest) - currentBalance);
            els.usedBalance.textContent = used.toFixed(2) + ' 元';
        }

        balanceRetryCount = 0; // 重置重试计数
    } catch (error) {
        // 根据错误类型生成提示
        let hintText = '余额查询（没有网络连接）';
        let shouldRetry = true;
        const errMsg = (error.message || '').toLowerCase();

        // 各类错误识别
        if (errMsg.includes('authentication_error') ||
            errMsg.includes('invalid_request_error') ||
            errMsg.includes('is invalid') ||
            errMsg.includes('密钥无效') ||
            errMsg.includes('api key 填写错误') ||
            errMsg.includes('已过期')) {
            hintText = '余额查询（API密钥无效或已失效）';
            shouldRetry = false;
        } else if (errMsg.includes('401') || errMsg.includes('unauthorized')) {
            hintText = '余额查询（API密钥无效或未填写）';
            shouldRetry = false;
        } else if (errMsg.includes('403') || errMsg.includes('forbidden') || errMsg.includes('key_disabled')) {
            hintText = '余额查询（API密钥权限被封禁）';
            shouldRetry = false;
        } else if (errMsg.includes('429') || errMsg.includes('rate_limit')) {
            hintText = '余额查询（查询过于频繁，请稍后再试）';
        } else if (errMsg.includes('402') || errMsg.includes('insufficient_balance')) {
            hintText = '余额查询（账户可用余额不足）';
        } else if (errMsg.includes('failed to fetch') || errMsg.includes('network')) {
            hintText = '余额查询（没有网络连接）';
        } else {
            hintText = '余额查询（服务暂不可用）';
        }

        // 更新 UI 为错误状态
        if (els.balanceTitleText) els.balanceTitleText.textContent = hintText;
        if (els.totalBalance) els.totalBalance.textContent = '—';
        if (els.grantedBalance) els.grantedBalance.textContent = '—';
        if (els.usedBalance) els.usedBalance.textContent = '—';

        // 需要重试时，启动定时重试
        if (shouldRetry) {
            balanceRetryCount++;
            if (balanceRetryCount < MAX_BALANCE_RETRIES) {
                balanceRetryTimer = setTimeout(fetchBalance, 2500);
            } else if (balanceRetryCount === MAX_BALANCE_RETRIES) {
                showToast('余额查询失败,已停止重试');
            }
        }
    }
}

/* ================================================================
   9. 导出聊天记录
   ================================================================ */

/** 获取导出方案（本地/云端） */
function getExportScheme() {
    return getStorage(KEYS_DATA.EXPORT_SCHEME) || null;
}

/** 设置导出方案 */
function setExportScheme(scheme) {
    setStorage(KEYS_DATA.EXPORT_SCHEME, scheme);
    if (typeof updateExportSchemeUI === 'function') updateExportSchemeUI();
}

/** 加载云端警告状态 */
function loadCloudWarningState() {
    cloudWarningAccepted = getStorage(KEYS_DATA.CLOUD_WARNING) === 'true';
}

/** 保存云端警告状态 */
function saveCloudWarningState() {
    setStorage(KEYS_DATA.CLOUD_WARNING, 'true');
    cloudWarningAccepted = true;
}

/** 更新导出聊天记录按钮的文字，显示总字数 */
function updateExportChatWordCount() {
    if (typeof els === 'undefined') return;
    const str = getStorage(KEYS_DATA.HISTORY);
    let count = 0;
    if (str) {
        try {
            JSON.parse(str).forEach(m => {
                if (m.content) count += m.content.length;
            });
        } catch (e) {}
    }
    if (els.exportChatText) {
        els.exportChatText.textContent = `导出聊天记录（共 ${count} 字）`;
    }
}

/**
 * 构建导出文本格式
 * 格式：每条消息用 "---===###===---" 分隔，第一行是角色，第二行是内容
 * 错误消息会标记 "[error]"
 */
function buildExportText(history) {
    const lines = [];
    history.forEach(m => {
        lines.push('---===###===---');
        if (m.isError) {
            lines.push(m.role + ' [error]');
        } else {
            lines.push(m.role);
        }
        lines.push('---===###===---');
        lines.push(m.content);
    });
    return lines.join('\n');
}

/** 生成随机字符串作为导出 Key */
function generateRandomKey(length = 24) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
    let key = '';
    for (let i = 0; i < length; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

/**
 * 上传文本数据到 TextDB
 * @param {string} key - 存储键
 * @param {string} value - 存储内容
 */
async function uploadToTextDB(key, value) {
    const formData = new URLSearchParams();
    formData.append('key', key);
    formData.append('value', value);

    const response = await fetch(TEXTDB_UPDATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error('上传失败');
    const data = await response.json();
    if (data.status !== 1) throw new Error('TextDB 返回错误');
}

/** 从 TextDB 删除数据（通过传空值） */
async function deleteFromTextDB(key) {
    const formData = new URLSearchParams({ key: key, value: '' });
    await fetch(TEXTDB_UPDATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: formData.toString()
    });
}

/**
 * 调度清理任务：在 EXPORT_EXPIRE_SECONDS 秒后删除云端数据
 */
function scheduleCleanup(key) {
    const expireAt = Date.now() + EXPORT_EXPIRE_SECONDS * 1000;
    setStorage(KEYS_DATA.EXPORT_CLEANUP, JSON.stringify({ key, expireAt }));

    if (exportCleanupTimeout) clearTimeout(exportCleanupTimeout);
    exportCleanupTimeout = setTimeout(() => {
        deleteFromTextDB(key);
        removeStorage(KEYS_DATA.EXPORT_CLEANUP);
    }, EXPORT_EXPIRE_SECONDS * 1000);
}

/** 检查并清理残留的过期导出数据（页面加载时调用） */
function checkAndCleanupResidual() {
    const stored = getStorage(KEYS_DATA.EXPORT_CLEANUP);
    if (!stored) return;

    try {
        const obj = JSON.parse(stored);
        if (Date.now() >= obj.expireAt) {
            deleteFromTextDB(obj.key);
            removeStorage(KEYS_DATA.EXPORT_CLEANUP);
        } else {
            const remaining = obj.expireAt - Date.now();
            if (exportCleanupTimeout) clearTimeout(exportCleanupTimeout);
            exportCleanupTimeout = setTimeout(() => {
                deleteFromTextDB(obj.key);
                removeStorage(KEYS_DATA.EXPORT_CLEANUP);
            }, remaining);
        }
    } catch (e) {
        removeStorage(KEYS_DATA.EXPORT_CLEANUP);
    }
}

/** 清除导出链接状态（计时器、URL 等） */
function clearExportLinkState() {
    if (exportLinkData.timer) {
        clearInterval(exportLinkData.timer);
        exportLinkData.timer = null;
    }
    if (exportLinkData.bigTitleTimer) {
        clearTimeout(exportLinkData.bigTitleTimer);
        exportLinkData.bigTitleTimer = null;
    }
    exportLinkData.url = '';
    exportLinkData.remainingSeconds = 0;
    exportLinkData.isActive = false;
}

/** 重置头部标题为默认状态 */
function setHeaderToDefault() {
    if (typeof els === 'undefined') return;
    els.headerTitleEl.textContent = '我的';
    els.headerSubtitleEl.textContent = '个人中心 · 记忆管理 · 设置';
    els.headerArea.style.cursor = 'pointer';
}

/** 停止提示倒计时 */
function stopHintCountdown() {
    if (hintCountdownTimer) {
        clearInterval(hintCountdownTimer);
        hintCountdownTimer = null;
    }
}

/** 重置导出提示信息 */
function resetExportHint() {
    if (typeof els === 'undefined') return;
    stopHintCountdown();
    els.exportLinkHint.textContent = '✨ 点击上方"导出聊天记录"生成下载链接，30秒内有效';
}

/**
 * 执行导出操作（生成链接并上传）
 * 如果已有有效链接，点击后会使其失效并重新生成
 */
function performExport() {
    if (typeof els === 'undefined') return;

    // 如果当前有有效链接，先失效旧链接
    if (exportLinkData.isActive && exportLinkData.url) {
        const oldKey = exportLinkData.url.replace(TEXTDB_BASE_URL, '').replace('?download=1', '');
        deleteFromTextDB(oldKey);
        if (exportCleanupTimeout) {
            clearTimeout(exportCleanupTimeout);
            exportCleanupTimeout = null;
        }
        clearExportLinkState();
        setHeaderToDefault();
        showToast('❌链接已失效');
    }

    // 读取历史记录
    const historyStr = getStorage(KEYS_DATA.HISTORY);
    if (!historyStr) {
        showToast('暂无聊天记录可导出');
        return;
    }

    let history;
    try {
        history = JSON.parse(historyStr);
    } catch (e) {
        showToast('聊天记录数据异常');
        return;
    }

    if (!history.length) {
        showToast('暂无聊天记录可导出');
        return;
    }

    // 构建文本
    const exportText = buildExportText(history);

    // 限制大小（TextDB 单条记录限制约 190KB）
    if (exportText.length > 190000) {
        showToast('聊天记录过长，超出服务限制，无法导出');
        return;
    }
    if (!exportText.trim()) {
        showToast('聊天记录内容为空，无法导出');
        return;
    }

    // 生成随机 Key 和下载链接
    const key = generateRandomKey();
    const downloadUrl = TEXTDB_BASE_URL + key + '?download=1';

    // 更新 UI 为上传中
    els.exportChatLinkInput.value = '正在上传...';
    els.exportLinkHint.textContent = '⏳ 正在上传至服务器，请稍候...';

    // 上传到 TextDB
    uploadToTextDB(key, exportText)
        .then(() => {
            els.exportChatLinkInput.value = downloadUrl;

            // 启动倒计时提示
            stopHintCountdown();
            let remaining = EXPORT_EXPIRE_SECONDS;
            els.exportLinkHint.textContent = `✅ 链接已生成，「${remaining}」秒内有！也可直接复制全文保存`;
            hintCountdownTimer = setInterval(() => {
                remaining--;
                if (remaining > 0) {
                    els.exportLinkHint.textContent = `✅ 链接已生成，「${remaining}」秒内有效！也可直接复制全文保存`;
                } else {
                    clearInterval(hintCountdownTimer);
                    hintCountdownTimer = null;
                    els.exportLinkHint.textContent = '❌此链接已失效，如需重新获取，请重新点击导出聊天记录按钮';
                }
            }, 1000);

            // 在新窗口打开链接
            window.open(downloadUrl, '_blank');

            // 复制链接到剪贴板
            copyTextToClipboard(downloadUrl).then(success => {
                showToast(success ? '✅ 下载链接已复制，若未跳转请手动粘贴到浏览器' : '⚠️ 复制失败，请手动复制输入框中的链接');
            });

            // 调度清理任务
            scheduleCleanup(key);

            // 更新全局链接状态
            clearExportLinkState();
            exportLinkData.url = downloadUrl;
            exportLinkData.remainingSeconds = EXPORT_EXPIRE_SECONDS;
            exportLinkData.isActive = true;
            exportLinkData.bigTitleTimer = null;

            // 启动全局倒计时更新（更新头部提示）
            if (exportLinkData.timer) clearInterval(exportLinkData.timer);
            exportLinkData.timer = setInterval(() => {
                exportLinkData.remainingSeconds--;
                if (exportLinkData.remainingSeconds <= 0) {
                    clearInterval(exportLinkData.timer);
                    exportLinkData.timer = null;
                    exportLinkData.isActive = false;
                    if (els.headerSubtitleEl.textContent.includes(exportLinkData.url)) {
                        els.headerTitleEl.textContent = '我的';
                        els.headerSubtitleEl.textContent = '链接已失效！';
                        els.headerArea.style.cursor = 'default';
                        if (exportLinkData.bigTitleTimer) {
                            clearTimeout(exportLinkData.bigTitleTimer);
                            exportLinkData.bigTitleTimer = null;
                        }
                        setTimeout(() => {
                            if (!exportLinkData.isActive) setHeaderToDefault();
                        }, 2000);
                    }
                }
            }, 1000);
        })
        .catch(() => {
            els.exportChatLinkInput.value = '';
            resetExportHint();
            showToast('❌ 上传失败，请尝试使用复制全文');
        });
}

/**
 * 复制文本到剪贴板（兼容降级方案）
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} 是否成功
 */
function copyTextToClipboard(text) {
    return new Promise(resolve => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => resolve(true))
                .catch(() => fallbackCopy(text, resolve));
        } else {
            fallbackCopy(text, resolve);
        }
    });
}

/** 降级复制方案（使用 textarea） */
function fallbackCopy(text, resolve) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        document.execCommand('copy');
        document.body.removeChild(textarea);
        resolve(true);
    } catch (e) {
        resolve(false);
    }
}

/* ================================================================
   10. 导入聊天记录
   ================================================================ */

/**
 * 处理导入文件
 * @param {File} file - 用户选择的文件
 */
function handleImportFile(file) {
    // 检查文件扩展名
    if (!file.name.toLowerCase().endsWith('.txt')) {
        showToast('❌ 仅支持导入 TXT 文件');
        return;
    }

    // 检查文件大小
    if (file.size > MAX_IMPORT_FILE_SIZE) {
        showToast('❌ 仅支持导入1.5MB以内的TXT文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        const text = event.target.result;

        // 验证格式是否包含分隔符
        if (!text.includes('---===###===---')) {
            showToast('❌ 文件内容格式错误,无法导入');
            return;
        }

        // 解析内容：按分隔符拆分，每两项为一组（role 和 content）
        const parts = text.split('---===###===---').filter(s => s.trim() !== '');
        const history = [];

        for (let i = 0; i < parts.length - 1; i += 2) {
            const rawRole = parts[i].trim();
            const content = parts[i + 1].trim();

            // 解析角色和错误标记
            let role, isError = false;
            if (rawRole.startsWith('system')) {
                role = 'system';
            } else if (rawRole.startsWith('user')) {
                role = 'user';
            } else {
                role = 'assistant';
            }
            if (rawRole.includes('[error]')) {
                isError = true;
            }

            if ((role === 'user' || role === 'assistant' || role === 'system') && content) {
                const newMsg = { role: role, content: sanitizeImportContent(content) };
                if (isError) newMsg.isError = true;
                history.push(newMsg);
            }
        }

        if (history.length === 0) {
            showToast('❌ 文件格式错误,无法导入');
            return;
        }

        // 弹出确认对话框
        if (typeof showModal === 'function') {
            showModal({
                title: '⚠️ 导入聊天记录',
                message: `即将导入 ${history.length} 条聊天记录，当前的所有聊天记录将被替换，此操作不可撤销。`,
                confirmText: '确定',
                cancelText: '取消',
                onConfirm: () => {
                    setStorage(KEYS_DATA.HISTORY, JSON.stringify(history));
                    updateStats();
                    updateExportChatWordCount();
                    showToast(`✅ 成功导入 ${history.length} 条聊天记录`);
                },
                onCancel: () => {}
            });
            // 强制确认按钮为红色（危险操作）
            els.modalConfirmBtn.style.background = '#ef4444';
        }
    };

    reader.onerror = function () {
        showToast('❌ 文件读取失败');
    };

    reader.readAsText(file, 'UTF-8');
}

/* ================================================================
   11. 恢复默认设置
   ================================================================ */

/**
 * 执行恢复默认设置：删除指定的 keys，并重置为默认值
 * @param {string[]} keys - 要重置的 key 列表
 */
function performResetToDefault(keys) {
    // 1. 删除指定的 keys
    keys.forEach(key => removeStorage(key));

    // 2. 对一些关键设置设置默认值（如果被删除的话）
    if (!getStorage(KEYS_DATA.THEME_MODE)) {
        setStorage(KEYS_DATA.THEME_MODE, 'auto');
    }
    if (keys.includes(KEYS_DATA.API_KEY)) {
        setStorage(KEYS_DATA.API_KEY, '');
    }
    if (keys.includes(KEYS_DATA.USER_PROFILE)) {
        setStorage(KEYS_DATA.USER_PROFILE, JSON.stringify({ avatar: '', name: '未命名用户', bio: '与AI相伴的每一天' }));
    }
    if (keys.includes(KEYS_DATA.MULTITURN)) {
        setStorage(KEYS_DATA.MULTITURN, 'false');
    }
    if (keys.includes(KEYS_DATA.HEADER_GRADIENT)) {
        setStorage(KEYS_DATA.HEADER_GRADIENT, 'linear-gradient(145deg, #667eea 0%, #764ba2 100%)');
        if (typeof applyHeaderColor === 'function') applyHeaderColor();
        if (typeof updateColorDotSelection === 'function') updateColorDotSelection();
    }
    if (keys.includes(KEYS_DATA.AI_AVATAR)) {
        removeStorage(KEYS_DATA.AI_AVATAR);
    }
    if (keys.includes(KEYS_DATA.AVATAR_STYLE)) {
        setStorage(KEYS_DATA.AVATAR_STYLE, 'circle');
    }
    if (keys.includes(KEYS_DATA.AVATAR_ENABLED)) {
        setStorage(KEYS_DATA.AVATAR_ENABLED, 'false');
    }
    if (keys.includes(KEYS_DATA.MEMORY_SEND)) {
        setStorage(KEYS_DATA.MEMORY_SEND, 'false');
    }
    if (keys.includes(KEYS_DATA.AI_PERSONA)) {
        removeStorage(KEYS_DATA.AI_PERSONA);
    }
    if (keys.includes(KEYS_DATA.MICROSOFT_SPEECH_SPEED)) {
        setStorage(KEYS_DATA.MICROSOFT_SPEECH_SPEED, '1.2');
    }
    if (keys.includes(KEYS_DATA.AUTO_SPEECH)) {
        setStorage(KEYS_DATA.AUTO_SPEECH, 'true');
    }
    if (keys.includes(KEYS_DATA.EXPORT_WARNING)) {
        removeStorage(KEYS_DATA.EXPORT_WARNING);
    }
    if (keys.includes(KEYS_DATA.EXPORT_CLEANUP)) {
        removeStorage(KEYS_DATA.EXPORT_CLEANUP);
    }
    if (keys.includes(KEYS_DATA.EXPORT_SCHEME)) {
        removeStorage(KEYS_DATA.EXPORT_SCHEME);
    }
    if (keys.includes(KEYS_DATA.CLOUD_WARNING)) {
        removeStorage(KEYS_DATA.CLOUD_WARNING);
    }
    if (keys.includes(KEYS_DATA.SWITCH_STYLE)) {
        setStorage(KEYS_DATA.SWITCH_STYLE, 'classic');
    }
    if (keys.includes(KEYS_DATA.VOICE)) {
        removeStorage(KEYS_DATA.VOICE);
    }

    // 3. 触发 UI 更新
    if (typeof loadTheme === 'function') loadTheme();
    if (typeof loadProfile === 'function') loadProfile();
    loadMemory();
    renderMemoryList();
    updateStats();
    if (typeof loadAllSwitchStates === 'function') loadAllSwitchStates();
    if (typeof updateAvatarStyleVisibility === 'function') updateAvatarStyleVisibility();
    if (typeof loadSpeechSettings === 'function') loadSpeechSettings();
    fetchBalance();
    if (typeof updateExportSchemeUI === 'function') updateExportSchemeUI();
    loadCloudWarningState();
    if (typeof applySwitchStyle === 'function') applySwitchStyle(getStorage(KEYS_DATA.SWITCH_STYLE) || 'classic');
    if (typeof updateSwitchStyleText === 'function') updateSwitchStyleText();

    showToast('✅ 清理成功！页面即将刷新');
    setTimeout(() => {
        location.reload();
    }, 2100);
}

/* ================================================================
   12. 待处理 Toast 检查（页面加载时显示）
   ================================================================ */

/** 检查是否有暂存的 Toast 消息（用于跨页面传递提示） */
function checkPendingToast() {
    const msg = getStorage(KEYS_DATA.PENDING_TOAST);
    if (msg) {
        showToast(msg);
        removeStorage(KEYS_DATA.PENDING_TOAST);
    }
}

/* ================================================================
   13. 标题栏链接状态管理（用于导出时显示链接和倒计时）
   ================================================================ */

/**
 * 更新标题栏以显示导出链接和倒计时
 * @param {string} url - 下载链接
 * @param {number} seconds - 剩余有效秒数
 */
function updateHeaderWithLink(url, seconds) {
    if (typeof els === 'undefined') return;
    if (!url || seconds <= 0) {
        clearExportLinkState();
        setHeaderToDefault();
        return;
    }

    exportLinkData.url = url;
    exportLinkData.remainingSeconds = seconds;
    exportLinkData.isActive = true;

    // 临时改变标题提示可点击复制
    els.headerTitleEl.textContent = '点击此处复制链接';
    els.headerArea.style.cursor = 'pointer';

    if (exportLinkData.bigTitleTimer) {
        clearTimeout(exportLinkData.bigTitleTimer);
    }
    exportLinkData.bigTitleTimer = setTimeout(() => {
        if (exportLinkData.isActive && exportLinkData.remainingSeconds > 0) {
            els.headerTitleEl.textContent = '我的';
        }
        exportLinkData.bigTitleTimer = null;
    }, 2000);

    // 启动倒计时更新
    if (exportLinkData.timer) clearInterval(exportLinkData.timer);
    exportLinkData.timer = setInterval(() => {
        exportLinkData.remainingSeconds--;
        if (exportLinkData.remainingSeconds <= 0) {
            clearInterval(exportLinkData.timer);
            exportLinkData.timer = null;
            exportLinkData.isActive = false;
            els.headerTitleEl.textContent = '我的';
            els.headerSubtitleEl.textContent = '链接已失效！';
            els.headerArea.style.cursor = 'default';
            if (exportLinkData.bigTitleTimer) {
                clearTimeout(exportLinkData.bigTitleTimer);
                exportLinkData.bigTitleTimer = null;
            }
            setTimeout(() => {
                if (!exportLinkData.isActive) setHeaderToDefault();
            }, 2000);
        } else {
            els.headerSubtitleEl.textContent = `${exportLinkData.url} 将在「${exportLinkData.remainingSeconds}」秒后失效`;
        }
    }, 1000);
}

/** 处理标题栏点击事件（复制链接） */
function handleHeaderClick() {
    if (!exportLinkData.isActive || !exportLinkData.url) return;
    copyTextToClipboard(exportLinkData.url).then(success => {
        if (typeof showToast === 'function') {
            showToast(success ? '✅ 链接已复制到剪贴板' : '⚠️ 复制失败，请重试');
        }
    });
}

/* ================================================================
   14. 导出（仅导出模块，可供外部调用）
   ================================================================ */
