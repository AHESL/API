"use strict";

/* ================================================================
   1. 常量配置
   ================================================================ */

// 微软语音文本字节数限制（4096 字节）
const MS_BYTE_LIMIT = 4096;

// 语音合成请求超时时间（毫秒）
const MS_TIMEOUT = 15000;

// 微软 TTS 服务端点列表（用于故障切换）
const MS_ENDPOINTS = [
    "https://tts.wangwangit.com/v1/audio/speech",
    "https://tts.babelllll.com/v1/audio/speech"
];

// 当前使用的端点索引（用于轮换）
let msEpIdx = 0;

/* ================================================================
   2. 全局状态变量
   ================================================================ */

// 当前正在播放的音频实例
let globalSpeechAudio = null;

// 当前触发朗读的按钮元素
let globalSpeechBtn = null;

/* ================================================================
   3. 语音配置读取函数
   ================================================================ */

// 检查自动朗读是否开启（默认开启）
function isAutoSpeechEnabled() {
    return localStorage.getItem('auto_speech_enabled') !== 'false';
}

// 获取微软语音音色（默认晓晓）
function getMicrosoftVoice() {
    return localStorage.getItem('microsoft_voice') || 'zh-CN-XiaoxiaoNeural';
}

// 获取微软语音语速（默认 1.2）
function getMicrosoftSpeechSpeed() {
    const v = localStorage.getItem('microsoft_speech_speed');
    if (v !== null) {
        const n = parseFloat(v);
        if (n >= 0.5 && n <= 2.0) return n;
    }
    return 1.2;
}

/* ================================================================
   4. 文本处理工具函数
   ================================================================ */

// 统计文本中的中文字符数（含 CJK 扩展符号）
function countChineseChars(text) {
    if (!text) return 0;
    let count = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (/[\u4e00-\u9fff]/.test(ch)) { count++; continue; }
        if (/[\u3000-\u303f\uff00-\uffef]/.test(ch)) { count++; continue; }
    }
    return count;
}

// 获取文本的字节数（UTF-8 编码）
function getByteLength(text) {
    return new TextEncoder().encode(text).length;
}

// 根据文本字节数判断适用于哪种语音引擎（目前仅支持微软）
function getSpeechType(text) {
    const byteCount = getByteLength(text);
    return byteCount <= MS_BYTE_LIMIT ? 'microsoft' : null;
}

/* ================================================================
   5. Toast 辅助函数
   ================================================================ */

// 复制成功反馈
function setCopySuccessFeedback() {
    if (typeof showToast === 'function') {
        showToast('✅ 输出内容已拷贝至剪贴板');
    }
}

/* ================================================================
   6. 语音播放控制
   ================================================================ */

// 停止所有正在播放的语音
function stopAllSpeech() {
    if (globalSpeechAudio) {
        globalSpeechAudio.pause();
        globalSpeechAudio.currentTime = 0;
        globalSpeechAudio = null;
    }
    if (globalSpeechBtn) {
        globalSpeechBtn.textContent = '朗读';
        globalSpeechBtn = null;
    }
}

/**
 * 处理语音按钮点击（朗读/暂停/继续）
 * @param {Element} btn - 触发点击的按钮元素
 * @param {Element} bubble - 对应的气泡元素
 */
function handleSpeechClick(btn, bubble) {
    const text = btn.dataset.speechText || (bubble ? bubble.textContent || '' : '');
    if (!text) return;

    // 如果这个按钮正在播放 → 暂停
    if (globalSpeechAudio && globalSpeechBtn === btn && !globalSpeechAudio.paused) {
        globalSpeechAudio.pause();
        btn.textContent = '继续';
        if (bubble) bubble.setAttribute('data-speech-state', 'paused');
        return;
    }

    // 如果这个按钮处于暂停状态 → 恢复播放
    if (globalSpeechAudio && globalSpeechBtn === btn && globalSpeechAudio.paused) {
        globalSpeechAudio.play();
        btn.textContent = '暂停';
        return;
    }

    // 停止之前的音频，开始新播放
    stopAllSpeech();
    document.querySelectorAll('.bubble[data-speech-state]').forEach(b => b.removeAttribute('data-speech-state'));
    globalSpeechBtn = btn;

    const speechType = btn.dataset.speechType || getSpeechType(text);
    if (speechType === 'microsoft') {
        if (bubble) bubble.setAttribute('data-speech-state', 'loading');
        startMicrosoftSpeech(btn, text, bubble);
    }
    if (bubble) bubble.setAttribute('data-speech-state', 'playing');
}

/* ================================================================
   7. 微软 TTS 请求
   ================================================================ */

// 向微软 TTS 端点请求语音合成
async function fetchMicrosoftTTSBlob(text) {
    const voice = getMicrosoftVoice();
    const speed = getMicrosoftSpeechSpeed();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MS_TIMEOUT);

    try {
        const res = await fetch(MS_ENDPOINTS[msEpIdx], {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "tts-1",
                input: text,
                voice: voice,
                speed: speed,
                pitch: 1.0,
                volume: 1.0,
                response_format: "mp3"
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) throw new Error("接口错误");
        return await res.blob();
    } catch (err) {
        clearTimeout(timeout);
        // 切换到下一个可用端点
        msEpIdx = (msEpIdx + 1) % MS_ENDPOINTS.length;
        throw err;
    }
}

/**
 * 启动微软语音播放
 * @param {Element} btn - 触发按钮
 * @param {string} text - 要朗读的文本
 * @param {Element} bubble - 对应的气泡元素
 */
function startMicrosoftSpeech(btn, text, bubble) {
    // 检查网络连接
    if (!navigator.onLine) {
        stopAllSpeech();
        if (typeof showToast === 'function') showToast('❌ 播放失败：网络未连接');
        return;
    }

    btn.textContent = '加载中...';
    btn.disabled = true;

    fetchMicrosoftTTSBlob(text)
        .then(blob => {
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            globalSpeechAudio = audio;
            globalSpeechBtn = btn;
            btn.textContent = '暂停';
            btn.disabled = false;
            if (bubble) bubble.setAttribute('data-speech-state', 'playing');

            audio.play().catch(() => {
                stopAllSpeech();
                if (bubble) bubble.removeAttribute('data-speech-state');
                if (typeof showToast === 'function') showToast('❌ 播放失败');
            });
            audio.onended = () => {
                btn.textContent = '朗读';
                globalSpeechAudio = null;
                globalSpeechBtn = null;
                if (bubble) bubble.removeAttribute('data-speech-state');
            };
            audio.onerror = () => {
                stopAllSpeech();
                if (bubble) bubble.removeAttribute('data-speech-state');
                if (typeof showToast === 'function') showToast('❌ 播放失败');
            };
        })
        .catch(err => {
            btn.textContent = '朗读';
            btn.disabled = false;
            stopAllSpeech();
            if (typeof showToast === 'function') showToast('❌ 语音合成失败：' + (err.message || 'API错误'));
        });
}

/* ================================================================
   8. 自动朗读
   ================================================================ */

/**
 * 自动朗读气泡内容（在 AI 回复完成后调用）
 * @param {Element} bubble - 要朗读的气泡元素
 */
function autoPlaySpeech(bubble) {
    if (!isAutoSpeechEnabled()) return;
    const text = getBubblePlainText(bubble);
    if (!text) return;
    const speechType = getSpeechType(text);
    if (!speechType) return;

    // 通过标题栏提示用户正在加载
    if (typeof showToast === 'function') {
        showToast('正在加载…', 1500);
    }

    // 使用虚拟按钮触发播放
    const virtualBtn = document.createElement('div');
    virtualBtn.dataset.speechType = speechType;
    virtualBtn.dataset.speechText = text;
    handleSpeechClick(virtualBtn, bubble);
}

/* ================================================================
   9. 气泡文本提取
   ================================================================ */

// 获取气泡中的纯文本内容（移除代码块等干扰元素）
function getBubblePlainText(bubble) {
    const clone = bubble.cloneNode(true);
    // 移除所有代码块
    clone.querySelectorAll('.code-block-wrapper, pre.code-block, .code-block-unclosed').forEach(el => el.remove());
    return clone.textContent || '';
}

/* ================================================================
   10. 气泡操作按钮（复制 / 朗读 / 删除）
   ================================================================ */

/**
 * 为气泡添加操作按钮（复制、朗读、删除）
 * @param {Element} column - 气泡所在的列容器
 * @param {Element} bubble - 气泡元素
 * @param {string} plainText - 气泡的纯文本内容
 */
function addActionButtons(column, bubble, plainText) {
    // 避免重复添加
    if (bubble.querySelector('.action-btn-row')) return;

    const row = document.createElement('div');
    row.className = 'action-btn-row';

    // 复制按钮
    const copyBtn = document.createElement('div');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = '复制';
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(plainText).then(() => {
            setCopySuccessFeedback();
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = plainText;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopySuccessFeedback();
        });
    });
    row.appendChild(copyBtn);

    // 朗读按钮（仅当文本长度在可朗读范围内）
    const speechType = getSpeechType(plainText);
    if (speechType) {
        const speechBtn = document.createElement('div');
        speechBtn.className = 'speech-btn';
        speechBtn.textContent = '朗读';
        speechBtn.dataset.speechType = speechType;
        speechBtn.dataset.speechText = plainText;
        speechBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleSpeechClick(speechBtn, bubble);
        });
        row.appendChild(speechBtn);
    }

    // 删除按钮
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof showDeleteConfirmBubble === 'function') {
            showDeleteConfirmBubble(bubble);
        }
    });
    row.appendChild(deleteBtn);

    bubble.appendChild(row);
}