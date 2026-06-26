"use strict";

/**
 * 环境检测 - 检测是否在微信浏览器中打开
 * 如果是微信浏览器，则提示用户使用系统浏览器
 */
(function() {
    var ua = navigator.userAgent || '';
    var isWeChat = ua.indexOf('MicroMessenger') > -1;

    if (isWeChat) {
        // 覆盖整个页面，提示用户用系统浏览器打开
        document.write('<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#f0f2f5;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;"><div style="background:white;border-radius:20px;padding:30px 24px;max-width:340px;width:85%;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.1);"><div style="font-size:48px;margin-bottom:16px;">⚠️</div><div style="font-size:18px;font-weight:600;color:#1e293b;margin-bottom:8px;">请使用系统浏览器打开</div><div style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:20px;">微信内置浏览器可能无法完整支持本应用的全部功能。<br>请点击右上角「···」选择<strong>「在默认浏览器中打开」</strong></div><div style="font-size:12px;color:#94a3b8;">感谢你的理解与支持 🍀</div></div></div>');
        throw new Error('请在系统浏览器中打开本应用');
    }
})();