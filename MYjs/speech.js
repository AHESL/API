"use strict";

/* ================================================================
   1. 常量配置
   ================================================================ */

// 默认微软语音语速
const DEFAULT_MICROSOFT_SPEECH_SPEED = 1.2;

// 语音测试超时时间（毫秒）
const TEST_TIMEOUT = 15000;

// 微软 TTS 服务端点列表（用于故障切换）
const MS_ENDPOINTS = [
    "https://tts.wangwangit.com/v1/audio/speech",
    "https://tts.babelllll.com/v1/audio/speech"
];

// 当前使用的端点索引（用于轮换）
let msEpIdx = 0;

// localStorage 键名常量
const KEYS = {
    MICROSOFT_SPEECH_SPEED: 'microsoft_speech_speed',
    AUTO_SPEECH: 'auto_speech_enabled',
    VOICE: 'microsoft_voice',
};

/* ================================================================
   2. 全局状态
   ================================================================ */

let autoSpeechEnabled = false;   // 自动朗读是否启用

/* ================================================================
   3. 存储工具函数
   ================================================================ */

function getStorage(key) { return localStorage.getItem(key); }
function setStorage(key, value) { localStorage.setItem(key, value); }

/* ================================================================
   4. 微软语音语速管理
   ================================================================ */

// 获取微软语音语速（默认 1.2）
function getMicrosoftSpeechSpeed() {
    const v = getStorage(KEYS.MICROSOFT_SPEECH_SPEED);
    return v !== null ? parseFloat(v) : DEFAULT_MICROSOFT_SPEECH_SPEED;
}

// 保存微软语音语速并更新 UI
function saveMicrosoftSpeechSpeed(speed) {
    setStorage(KEYS.MICROSOFT_SPEECH_SPEED, speed.toString());
    if (typeof els !== 'undefined' && els.microsoftSpeedValue) {
        els.microsoftSpeedValue.textContent = speed.toFixed(1);
    }
}

/* ================================================================
   5. 工具函数
   ================================================================ */

// 检查网络连接状态
function isOnline() { return navigator.onLine; }

// 禁用/启用所有测试按钮（排除指定按钮）
function setTestButtonsDisabled(disable, excludeBtn = null) {
    if (typeof els === 'undefined') return;
    if (els.microsoftTestBtn && els.microsoftTestBtn !== excludeBtn) els.microsoftTestBtn.disabled = disable;
}

// Toast 提示（调用全局 Toast）
function showToast(message, duration = 2000) {
    if (typeof window._showToast === 'function') {
        window._showToast(message, duration);
    }
}

/* ================================================================
   6. 微软语音测试
   ================================================================ */

function doMicrosoftTest() {
    if (typeof els === 'undefined') return;
    const btn = els.microsoftTestBtn;
    if (!btn || btn.disabled) return;

    // 检查网络
    if (!isOnline()) { showToast('当前无网络，无法测试'); return; }

    // 保存原始按钮文本，进入加载状态
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⌛️正在加载...';
    setTestButtonsDisabled(true, btn);

    // 获取当前语音设置
    const speed = getMicrosoftSpeechSpeed();
    const voice = els.voiceSelect ? els.voiceSelect.value : 'zh-CN-XiaoxiaoNeural';
    const testText = `这是一段微软语音朗读测试，当前语速为${speed.toFixed(1)}。The quick brown fox jumps over the lazy dog`;

    // 发起 TTS 请求（带超时控制）
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT);

    fetch(MS_ENDPOINTS[msEpIdx], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "tts-1",
            input: testText,
            voice: voice,
            speed: speed,
            pitch: 1.0,
            volume: 1.0,
            response_format: "mp3"
        }),
        signal: controller.signal
    })
    .then(res => {
        clearTimeout(timeout);
        if (!res.ok) throw new Error("接口错误");
        return res.blob();
    })
    .then(blob => {
        // 创建音频并播放
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        btn.textContent = '⏸️正在播放...';
        audio.play().then(() => showToast('⏸️正在播放微软测试语音'))
                    .catch(() => {
                        btn.disabled = false;
                        btn.textContent = originalText;
                        setTestButtonsDisabled(false);
                        showToast('❌ 播放失败');
                    });
        audio.onended = () => {
            btn.disabled = false;
            btn.textContent = originalText;
            setTestButtonsDisabled(false);
        };
        audio.onerror = () => {
            btn.disabled = false;
            btn.textContent = originalText;
            setTestButtonsDisabled(false);
            showToast('❌ 播放失败');
        };
    })
    .catch(err => {
        // 出错时切换到备用端点
        clearTimeout(timeout);
        msEpIdx = (msEpIdx + 1) % MS_ENDPOINTS.length;
        btn.disabled = false;
        btn.textContent = originalText;
        setTestButtonsDisabled(false);
        showToast('❌ 语音合成失败，已切换备用端点');
    });
}

/* ================================================================
   7. 加载语音设置
   ================================================================ */

function loadSpeechSettings() {
    // 加载自动朗读设置（默认开启）
    autoSpeechEnabled = getStorage(KEYS.AUTO_SPEECH) !== null ? getStorage(KEYS.AUTO_SPEECH) === 'true' : true;

    if (typeof els === 'undefined') return;

    // 显示当前语速
    if (els.microsoftSpeedValue) {
        els.microsoftSpeedValue.textContent = getMicrosoftSpeechSpeed().toFixed(1);
    }

    // 加载已保存的音色
    if (els.voiceSelect) {
        const savedVoice = getStorage(KEYS.VOICE) || 'zh-CN-XiaoxiaoNeural';
        els.voiceSelect.value = savedVoice;
    }
}