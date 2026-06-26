var APP_VERSION = '3.5.6.8';

/**
 * 动态信息模块
 * 为 AI 提供实时环境数据（时间、电量等）
 */

// 1. 初始化电量全局变量
var BATTERY = '未知';

// 2. 仅在 AI 指令开启时读取电量
if (localStorage.getItem('ai_instruction') === 'true') {
    if (navigator.getBattery) {
        navigator.getBattery().then(function(battery) {
            function updateBattery() {
                const level = Math.round(battery.level * 100);
                const charging = battery.charging ? '充电中' : '未充电';
                BATTERY = `设备电量${level}%，充电状态${charging}`;
            }
            updateBattery();
            battery.addEventListener('levelchange', updateBattery);
            battery.addEventListener('chargingchange', updateBattery);
        });
    }
}

// 3. 时间函数
function getCurrentTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}年${month}月${date}日 ${hours}:${minutes}:${seconds}`;
}