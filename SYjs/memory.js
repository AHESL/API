"use strict";

/* ================================================================
   1. 常量配置
   ================================================================ */

// 记忆最大存储数量
const MAX_MEMORIES = 30;

// localStorage 存储键名
const STORAGE_MEMORY = 'deepseek_memory_v6';

/* ================================================================
   2. 全局状态变量
   ================================================================ */

// 内存中的记忆数组
var memoryStore = [];

/* ================================================================
   3. 存储函数
   ================================================================ */

// 将 memoryStore 保存到 localStorage
function saveMemory() {
    localStorage.setItem(STORAGE_MEMORY, JSON.stringify(memoryStore));
}

/* ================================================================
   4. 记忆管理函数
   ================================================================ */

/**
 * 添加一条新记忆
 * @param {string} content - 记忆内容
 * @returns {boolean|string} - true: 添加成功, false: 内容为空或已存在, 'full': 已达上限
 */
function addMemory(content) {
    // 内容为空则忽略
    if (!content) return false;

    // 检查是否已存在相同内容，避免重复
    if (memoryStore.some(m => m.content === content)) return false;

    // 生成唯一 ID（时间戳 + 随机字符串）
    memoryStore.push({
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        content,
        timestamp: new Date().toLocaleString()
    });

    // 检查是否超出上限
    if (memoryStore.length >= MAX_MEMORIES) return 'full';

    // 保存到 localStorage
    saveMemory();
    return true;
}

/**
 * 根据关键词删除记忆
 * @param {string} keyword - 要删除的关键词
 * @returns {boolean} - true: 删除了至少一条, false: 未找到匹配
 */
function removeMemoryByKeyword(keyword) {
    const before = memoryStore.length;
    // 过滤掉内容包含关键词的记忆
    memoryStore = memoryStore.filter(m => !m.content.includes(keyword));
    saveMemory();
    return before !== memoryStore.length;
}

// 清空所有记忆
function clearAllMemories() {
    memoryStore = [];
    saveMemory();
}

/* ================================================================
   5. 记忆查询与格式化
   ================================================================ */

/**
 * 将记忆拼接为系统提示文本
 * @returns {string|null} - 格式化后的记忆文本，若无记忆则返回 null
 */
function getMemoriesAsSystemPrompt() {
    if (memoryStore.length === 0) return null;
    const lines = memoryStore.map(m => `- ${m.content}`);
    return `以下是用户明确要求你永久记住的信息，请在回答时始终遵守这些信息：\n${lines.join('\n')}`;
}

/**
 * 格式化记忆列表用于显示
 * @returns {string} - HTML 格式的记忆列表
 */
function formatMemoryList() {
    if (memoryStore.length === 0) return '🧠 当前没有任何记忆。';
    const list = memoryStore.map((m, i) => `${i+1}. ${m.content} (${m.timestamp})`).join('<br>');
    return `🧠 当前记忆 (共 ${memoryStore.length} 条)：<br>${list}`;
}