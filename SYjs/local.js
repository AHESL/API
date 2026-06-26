// syjs/local.js - 本地命令指令处理
"use strict";

const LOCAL_COMMANDS = [
    // ========== 记忆开关 ==========
    { keywords: ['打开记忆', '开启记忆', '记忆打开', '记忆开启'], action: () => {
        localStorage.setItem('memory_send_enabled', 'true');
        return '记忆开关已打开，AI 将读取你的记忆';
    }},
    { keywords: ['关闭记忆', '记忆关闭'], action: () => {
        localStorage.setItem('memory_send_enabled', 'false');
        return '记忆开关已关闭，AI 不会读取你的记忆';
    }},

    // ========== 多轮对话开关 ==========
    { keywords: ['打开多轮对话', '开启多轮对话', '多轮对话打开'], action: () => {
        localStorage.setItem('multiturn_enabled', 'true');
        return '多轮对话已开启，AI 将携带历史记录';
    }},
    { keywords: ['关闭多轮对话', '多轮对话关闭'], action: () => {
        localStorage.setItem('multiturn_enabled', 'false');
        return '多轮对话已关闭';
    }},

    // ========== 自动朗读开关 ==========
    { keywords: ['打开自动朗读', '开启自动朗读', '自动朗读打开'], action: () => {
        localStorage.setItem('auto_speech_enabled', 'true');
        return '自动朗读已开启';
    }},
    { keywords: ['关闭自动朗读', '自动朗读关闭'], action: () => {
        localStorage.setItem('auto_speech_enabled', 'false');
        return '自动朗读已关闭';
    }},

    // ========== 头像显示开关 ==========
    { keywords: ['打开头像', '显示头像', '头像显示'], action: () => {
        localStorage.setItem('avatar_enabled', 'true');
        return '点击首页刷新后头像将显示';
    }},
    { keywords: ['关闭头像', '隐藏头像', '头像隐藏'], action: () => {
        localStorage.setItem('avatar_enabled', 'false');
        return '点击首页刷新后头像将隐藏';
    }},

    // ========== 精简显示模式 ==========
    { keywords: ['打开精简模式', '精简模式打开', '精简显示'], action: () => {
        localStorage.setItem('compact_view', 'true');
        return '精简显示模式已开启，仅展示最近对话';
    }},
    { keywords: ['关闭精简模式', '精简模式关闭'], action: () => {
        localStorage.setItem('compact_view', 'false');
        return '精简显示模式已关闭';
    }},

    // ========== 本地基础模型（自引用） ==========
    { keywords: ['关闭本地模型', '本地模型关闭'], action: () => {
        localStorage.setItem('local_model', 'false');
        return '本地指令已关闭，后续消息将发送给 AI';
    }},

    // ========== 主题切换 ==========
    { keywords: ['切换深色', '深色模式', '打开深色', '深色'], action: () => {
        localStorage.setItem('theme_mode', 'dark');
        document.body.classList.add('dark-mode');
        return '🌑 已切换到深色模式';
    }},
    { keywords: ['切换浅色', '浅色模式', '打开浅色', '浅色'], action: () => {
        localStorage.setItem('theme_mode', 'light');
        document.body.classList.remove('dark-mode');
        return '🌕 已切换到浅色模式';
    }},
    { keywords: ['自动模式', '切换自动', '自动'], action: () => {
        localStorage.setItem('theme_mode', 'auto');
        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('dark-mode', isDark);
        return '🌓 已切换到自动模式，将跟随系统主题';
    }},

    // ========== 查询类 ==========
    { keywords: ['应用版本', '版本号', '当前版本'], action: () => {
        const v = localStorage.getItem('APP_VERSION') || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '读取失败,请前往我的页面查看');
        return `📱 当前应用版本：${v}`;
    }},
    { keywords: ['存储空间', '存储使用', '用了多少空间', '存储'], action: () => {
        let b = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            const v = localStorage.getItem(k);
            b += k.length * 2 + v.length * 2;
        }
        return `💾 当前存储使用：${(b / 1024).toFixed(2)} KB`;
    }},

    // ========== 语音设置 ==========
    { keywords: ['切换音色'], action: (input) => {
        if (input.includes('晓晓')) { localStorage.setItem('microsoft_voice', 'zh-CN-XiaoxiaoNeural'); return '音色已切换为晓晓（女声）'; }
        if (input.includes('晓伊')) { localStorage.setItem('microsoft_voice', 'zh-CN-XiaoyiNeural'); return '音色已切换为晓伊（女声）'; }
        if (input.includes('云希')) { localStorage.setItem('microsoft_voice', 'zh-CN-YunxiNeural'); return '音色已切换为云希（男声）'; }
        if (input.includes('云健')) { localStorage.setItem('microsoft_voice', 'zh-CN-YunjianNeural'); return '音色已切换为云健（男声）'; }
        return '可选音色：晓晓、晓伊、云希、云健。<br>请说“切换音色为xxx”';
    }},
    { keywords: ['首选语音', '语音选择'], action: (input) => {
        if (input.includes('百度')) { localStorage.setItem('preferred_voice', 'baidu'); return '首选语音已切换为百度'; }
        if (input.includes('微软')) { localStorage.setItem('preferred_voice', 'microsoft'); return '首选语音已切换为微软'; }
        if (input.includes('自动')) { localStorage.setItem('preferred_voice', 'auto'); return '首选语音已切换为自动'; }
        return '可选：自动、百度、微软。<br>请说“首选语音切换为xxx”';
    }},

    // ========== 联系 ==========
    { keywords: ['联系我们', '反馈', '联系作者'], action: () => {
        setTimeout(() => {
            window.location.href = `mailto:abc082576@163.com?subject=API 调用工具 - 意见反馈`;
        }, 500);
        return '📨 正在为你打开邮件客户端...';
    }},

    // ========== 工具箱入口 ==========
    { keywords: ['打开工具箱', '万能工具箱', '工具箱'], action: () => {
        setTimeout(() => { window.location.href = 'GJX/GJ.html'; }, 300);
        return '🛠️ 正在为你打开万能工具箱...';
    }},
    { keywords: ['打开手持弹幕', '手持弹幕'], action: () => {
        setTimeout(() => { window.location.href = 'DM.html'; }, 300);
        return '📜 正在为你打开手持弹幕...';
    }},

    // ========== 头像样式切换 ==========
    { keywords: ['圆形头像', '切成圆形', '头像变圆', '圆形'], action: () => {
        localStorage.setItem('avatar_style', 'circle');
        return '请点击首页进行刷新刷新后头像将变为圆形';
    }},
    { keywords: ['方形头像', '切成方形', '头像变方', '方形'], action: () => {
        localStorage.setItem('avatar_style', 'square');
        return '请点击首页进行刷新刷新后头像将变为方形';
    }},

    // ========== 帮助 ==========
    { keywords: ['本地指令', '指令列表', '你能做什么', '帮助'], action: () => {
        return `🤖 本地命令支持的指令(部分功能需要刷新后才可生效「点击首页即可刷新」)：
<br>• 打开/关闭记忆
<br>• 打开/关闭多轮对话
<br>• 打开/关闭自动朗读
<br>• 显示/隐藏头像
<br>• 方形/圆形头像
<br>• 切换深色/浅色/自动模式
<br>• 查询版本号、存储空间
<br>• 切换音色（晓晓/晓伊/云希/云健）
<br>• 切换首选语音（百度/微软/自动）
<br>• 打开工具箱、手持弹幕
<br>• 联系我们
<br>• 首页这个按钮可以刷新页面，一键回到最底部这两个操作`;
    }},
];

// ========== 匹配函数 ==========
function matchLocalCommand(input) {
    const trimmed = input.trim().toLowerCase();
    for (const cmd of LOCAL_COMMANDS) {
        for (const kw of cmd.keywords) {
            const lowerKw = kw.toLowerCase();
            if (trimmed === lowerKw) {
                return cmd;
            }
        }
    }
    return null;
}

// ========== 入口函数（被 main.js 调用） ==========
function handleLocalInstruction(input) {
    const cmd = matchLocalCommand(input);
    if (cmd) {
        return { handled: true, response: cmd.action(input) };
    }
    return { handled: false, response: '' };
}