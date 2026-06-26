"use strict";

/**
 * AI 控制器 - 解析 AI 回复中的 JSON 指令并执行
 * 只执行白名单内的安全操作
 */

// ========== 白名单指令集 ==========
const COMMAND_WHITELIST = {
    // 切换主题: {"action":"theme","value":"dark"}
    theme: (value) => {
        const valid = ['light', 'dark', 'auto'];
        if (!valid.includes(value)) return false;
        localStorage.setItem('theme_mode', value);
        if (typeof applyTheme === 'function') applyTheme(value);
        return true;
    },
    
    // 刷新页面: {"action":"refresh"}
    refresh: () => {
        setTimeout(() => location.reload(), 300);
        return true;
    },
    
    // 头像显示/隐藏: {"action":"avatar","value":1}
    avatar: (value) => {
        if (value !== 0 && value !== 1) return false;
        localStorage.setItem('avatar_enabled', value === 1 ? 'true' : 'false');
        if (typeof applyAvatarState === 'function') applyAvatarState();
        return true;
    },
    
    // 头像圆形/方形: {"action":"avatarStyle","value":"circle"}
    avatarStyle: (value) => {
        const valid = ['circle', 'square'];
        if (!valid.includes(value)) return false;
        localStorage.setItem('avatar_style', value);
        if (typeof window.updateAvatarStyleUI === 'function') window.updateAvatarStyleUI();
        return true;
    },
    
    // 自动朗读: {"action":"autoSpeech","value":1}
    autoSpeech: (value) => {
        if (value !== 0 && value !== 1) return false;
        localStorage.setItem('auto_speech_enabled', value === 1 ? 'true' : 'false');
        return true;
    },
    
    // 多轮对话: {"action":"multiturn","value":1}
    multiturn: (value) => {
        if (value !== 0 && value !== 1) return false;
        localStorage.setItem('multiturn_enabled', value === 1 ? 'true' : 'false');
        if (typeof updateContextWarning === 'function') updateContextWarning();
        return true;
    },
    
    // 记忆发送: {"action":"memorySend","value":1}
    memorySend: (value) => {
        if (value !== 0 && value !== 1) return false;
        localStorage.setItem('memory_send_enabled', value === 1 ? 'true' : 'false');
        return true;
    },
    
    // 打开页面: {"action":"open","value":"toolbox"}
    open: (value) => {
        const pages = {
            'toolbox': 'GJX/GJ.html',
            'danmaku': 'DM.html'
        };
        if (!pages[value]) return false;
        setTimeout(() => { window.location.href = pages[value]; }, 300);
        return true;
    }
};

// 全局正则预编译（提升性能）
const API_FULL_TAG_REG = /<API>\s*[\s\S]*?\s*<\/API>/g;
const API_BROKEN_TAG_REG = /<\/?API>/g;

/**
 * 从 AI 回复文本中提取 JSON 指令
 * 支持格式: <API>JSON指令</API>
 */
function extractCommand(text) {
    if (!text) return null;
    const tagMatch = text.match(/<API>([\s\S]*?)<\/API>/);
    if (!tagMatch) return null;
    try {
        const rawJson = tagMatch[1].trim();
        return JSON.parse(rawJson);
    } catch (e) {
        // JSON解析失败也返回null，不残留任何标签
        return null;
    }
}

/**
 * 清洗文本，彻底移除所有API控制标签（独立工具函数，可单独调用）
 * @param {string} text 原始AI文本
 * @returns {string} 完全清除标签后的干净展示文本
 */
function cleanApiTags(text) {
    if (!text) return '';
    let res = text;
    // 第一步：清除完整成对标签（包含内部所有指令内容）
    res = res.replace(API_FULL_TAG_REG, '');
    // 第二步：兜底清除残缺孤立标签（<API> 或 </API> 单独残留）
    res = res.replace(API_BROKEN_TAG_REG, '');
    // 去除多余空行、首尾空格
    res = res.replace(/\n\s*\n/g, '\n').trim();
    return res;
}

/**
 * 解析 AI 回复，执行白名单内的指令
 * @param {string} fullContent - AI 的完整回复文本
 * @returns {string} 移除 JSON 指令后的纯文本内容（用于显示）
 */
function extractCommand(text) {
    if (!text) return null;
    
    // 匹配 <API>...</API> 标签内的 JSON
    const tagMatch = text.match(/<API>\s*(\{[\s\S]*?\})\s*<\/API>/);
    if (tagMatch) {
        try { return JSON.parse(tagMatch[1]); } catch(e) {}
    }
    
    return null;
}

function processAICommand(fullContent) {
    // 1. 提取所有指令
    const commands = [];
    const regex = /<API>([\s\S]*?)<\/API>/g;
    let match;
    while ((match = regex.exec(fullContent)) !== null) {
        try {
            const cmd = JSON.parse(match[1].trim());
            if (cmd.action) commands.push(cmd);
        } catch (e) {}
    }

    // 2. 按顺序执行所有指令
    if (commands.length > 0) {
        const delayActions = ['avatar', 'avatarStyle', 'autoSpeech', 'multiturn', 'memorySend'];
        let delay = 0;
        commands.forEach((cmd, index) => {
            const handler = COMMAND_WHITELIST[cmd.action];
            if (handler) {
                if (delayActions.includes(cmd.action)) {
                    setTimeout(() => {
                        handler(cmd.value);
                        if (index === commands.length - 1 && typeof showToast === 'function') {
                            showToast('✅ 已执行全部指令', 2000);
                        }
                    }, delay);
                    delay += 500;
                } else {
                    handler(cmd.value);
                }
            }
        });
        if (!delay && typeof showToast === 'function') {
            showToast('✅ 已执行全部指令', 2000);
        }
    }

    // 3. 清理所有指令标签
    return cleanApiTags(fullContent);
}