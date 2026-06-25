// feedback.js - 反馈相关共享工具函数
// 提取自原 /workspace/newclassroom/js/app.js，供 FeedbackResultDialog / RecordPage / HistoryPage 共用
//
// 提取原因：原项目在 recordPage.js、app.js（4 处）、_showGroupStudent、_persistFeedbackEdit
// 中重复实现了"按学生姓名模糊匹配"和"标题生成"逻辑，本次迁移统一为 pure function。

import Storage from '../storage';

/**
 * 按学生姓名模糊匹配学生对象
 * 策略：先精确匹配 name === query；失败再用双向 endsWith（仅允许AI省略姓氏，
 * 禁止短名匹配长名，避免"张三"误匹配"三"）
 *
 * @param {Array} students - 学生对象数组（store.getStudentById 的返回值集合）
 * @param {string} name - 待匹配的姓名（可能为全名或省略姓氏的短名）
 * @returns {Object|null} 匹配到的学生对象，未匹配返回 null
 */
export function matchStudentByName(students, name) {
    if (!students || !name) return null;
    // 精确匹配
    let matched = students.find(s => s && s.name === name);
    if (matched) return matched;
    // 模糊匹配：双向 endsWith（仅允许AI省略姓氏）
    matched = students.find(s => s && (
        s.name.endsWith(name) || name.endsWith(s.name)
    ));
    return matched || null;
}

/**
 * 生成日期字符串（M.D 格式）
 * - 支持自定义日期（YYYY-MM-DD → M.D，用 parseInt 去前导零）
 * - 默认使用当天日期
 *
 * @param {object} style - Storage.getStyle() 返回的风格对象
 * @returns {string} 日期字符串，如 "6.25"
 */
export function getDateStr(style) {
    if (style && style.useCustomDate && style.customDate) {
        const parts = style.customDate.split('-');
        if (parts.length === 3) return `${parseInt(parts[1])}.${parseInt(parts[2])}`;
        return style.customDate;
    }
    const now = new Date();
    return `${now.getMonth() + 1}.${now.getDate()}`;
}

/**
 * 姓名缩写处理
 * - style.nameShorten !== false 且姓名长度 >= 3 → 取后两字（"王小明"→"小明"）
 * - 否则使用全名
 *
 * @param {string} name - 学生全名
 * @param {object} style - Storage.getStyle() 返回的风格对象
 * @returns {string} 显示用的姓名
 */
export function getDisplayName(name, style) {
    if (!name) return '';
    if (style && style.nameShorten !== false && name.length >= 3) {
        return name.slice(-2);
    }
    return name;
}

/**
 * 生成反馈标题
 * 顺序：[日期, 姓名, 科目+试听标记, '课堂反馈']，过滤空值，无分隔符直接拼接
 *
 * @param {object} options
 * @param {object} options.student - 当前学生（单学生模式）
 * @param {Array<string>} options.group - 学生ID数组（小组模式）
 * @param {object} options.subject - 当前科目
 * @param {Function} options.getStudentById - store.getStudentById 引用
 * @param {object} options.style - Storage.getStyle() 返回的风格对象
 * @returns {string} 标题，如 "6.25小明数学试听课堂反馈"
 */
export function generateFeedbackTitle({ student, group, subject, getStudentById, style }) {
    const dateStr = getDateStr(style);

    let namePart = '';
    let trialPart = '';

    if (group && group.length > 0) {
        // 小组模式：所有学生姓名用顿号连接
        const names = group.map(id => {
            const s = getStudentById(id);
            if (!s) return '';
            return getDisplayName(s.name, style);
        }).filter(Boolean);
        namePart = names.join('、');
        // 多人时只要有任一学生是试听生，标记"试听"
        const hasTrial = group.some(id => {
            const s = getStudentById(id);
            return s && s.isTrial;
        });
        if (hasTrial) trialPart = '试听';
    } else if (student) {
        // 单学生模式
        namePart = getDisplayName(student.name, style);
        if (student.isTrial) trialPart = '试听';
    }

    const subjectPart = subject ? subject.name : '';
    const subjectFull = trialPart ? `${subjectPart}${trialPart}` : subjectPart;

    const parts = [dateStr, namePart, subjectFull, '课堂反馈'].filter(p => p);
    return parts.join('');
}

/**
 * 模块图标映射
 */
export function getModuleIcon(moduleName) {
    const iconMap = {
        '课堂内容': '📖',
        '课堂表现': '🌟',
        '薄弱环节': '⚠️',
        '课后作业': '📝',
        '后续计划': '🎯',
        '家长建议': '👨‍👩‍👧',
        '学习计划': '📋'
    };
    return iconMap[moduleName] || '📌';
}

/**
 * 统一公共模块：课堂内容和课后作业对所有学生保持一致
 * 提取自原 app.js _unifyCommonModules，正则规则 1:1 保留
 *
 * 策略：取第一位学生的"课堂内容"和"课后作业"，用 5 条正则把学生姓名替换为"同学们"，
 * 然后统一应用到所有学生的这两个模块上。
 *
 * @param {Array<{studentName: string, feedback: Array<{module: string, content: string}>}>} feedbacks
 * @returns {Array} 统一后的 feedbacks（深拷贝）
 */
export function unifyCommonModules(feedbacks) {
    if (!feedbacks || feedbacks.length < 2) return feedbacks;

    const COMMON_MODULES = ['课堂内容', '课后作业'];
    const first = feedbacks[0];

    // 收集所有学生姓名及其可能的变体（全名、后两个字）
    const allStudentNames = feedbacks.map(fb => fb.studentName).filter(Boolean);
    const namePatterns = [];
    for (const name of allStudentNames) {
        namePatterns.push(name);
        if (name.length >= 3) {
            namePatterns.push(name.slice(-2));
        }
    }

    // 转义正则特殊字符
    const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const commonContents = {};
    for (const modName of COMMON_MODULES) {
        const mod = first.feedback.find(f => f.module === modName);
        if (mod) {
            // 过滤掉公共模块中的学生姓名（兜底处理）
            let cleanedContent = mod.content;
            for (const pattern of namePatterns) {
                const p = escapeRegex(pattern);
                // 1. 替换 "请pattern..." 模式
                const regex1 = new RegExp(`请${p}([在需应]|同学|完成|独立|复习|梳理|注意|重点|及时)`, 'g');
                cleanedContent = cleanedContent.replace(regex1, '请同学们$1');
                // 2. 替换 "pattern的" 模式（前面不能是汉字，避免"说明的"被"明"误替换）
                const regex2 = new RegExp(`(?<![\\u4e00-\\u9fff])${p}的`, 'g');
                cleanedContent = cleanedContent.replace(regex2, '同学们的');
                // 3. 替换 "pattern在..." 模式（pattern在课堂上、pattern在课后）
                const regex3 = new RegExp(`(?<![\\u4e00-\\u9fff])${p}在(课堂|课后|本节课|课堂中)`, 'g');
                cleanedContent = cleanedContent.replace(regex3, '同学们在$1');
                // 4. 替换 "pattern表现"、"pattern回答" 等动词搭配
                const regex4 = new RegExp(`(?<![\\u4e00-\\u9fff])${p}(表现|回答|提问|参与|完成|掌握|理解|笔记|专注|积极|安静)`, 'g');
                cleanedContent = cleanedContent.replace(regex4, '同学们$1');
                // 5. 替换 "pattern需要"、"pattern应" 模式
                const regex5 = new RegExp(`(?<![\\u4e00-\\u9fff])${p}(需要|应|可以|建议|需)`, 'g');
                cleanedContent = cleanedContent.replace(regex5, '同学们$1');
            }
            commonContents[modName] = cleanedContent;
        }
    }

    return feedbacks.map(fb => ({
        studentName: fb.studentName,
        feedback: fb.feedback.map(item => {
            if (COMMON_MODULES.includes(item.module) && commonContents[item.module]) {
                return { ...item, content: commonContents[item.module] };
            }
            return item;
        })
    }));
}

/**
 * 复制反馈文本到剪贴板
 * - 优先使用 navigator.clipboard.writeText
 * - 降级到 textarea + execCommand('copy')
 *
 * @param {string} text - 待复制的文本
 * @returns {Promise<boolean>} 是否复制成功
 */
export async function copyToClipboard(text) {
    const trimmed = text.trim();
    // 优先使用 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(trimmed);
            return true;
        } catch {
            // 降级到 execCommand
        }
    }
    // 降级方案：动态创建隐藏 textarea + execCommand
    try {
        const textarea = document.createElement('textarea');
        textarea.value = trimmed;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
}

/**
 * 拼接反馈为纯文本（用于复制/导出）
 * 格式：标题 + 空行 + 各模块【模块名】\n内容，模块间用空行分隔
 *
 * @param {Array<{module: string, content: string}>} feedback - 反馈数组
 * @param {string} title - 标题
 * @returns {string} 拼接后的文本
 */
export function buildFeedbackText(feedback, title) {
    const body = (feedback || []).map(f => `【${f.module}】\n${f.content}`).join('\n\n');
    return `${title}\n\n${body}`;
}

/**
 * 转录文本超长截断（用于 store.addFeedback 时保存 transcript）
 * - 超过 10000 字符：保留头 5000 + 尾 3000 + 省略标记
 *
 * @param {string} transcript - 原始转录文本
 * @returns {string} 截断后的文本
 */
export function truncateTranscriptForStore(transcript) {
    const MAX_STORED_TRANSCRIPT = 10000;
    if (transcript.length > MAX_STORED_TRANSCRIPT) {
        return transcript.substring(0, 5000)
            + '\n\n[... 中间内容省略 ...]\n\n'
            + transcript.substring(transcript.length - 3000);
    }
    return transcript;
}
