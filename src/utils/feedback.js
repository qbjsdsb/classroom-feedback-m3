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
 * 生成日期字符串
 * - 支持 useCustomDate/customDate（YYYY-MM-DD）
 * - 支持 titleDateFormat：M.D（默认，向后兼容）| MM-DD | X月X日 | YYYY-MM-DD
 *
 * @param {object} style - Storage.getStyle() 返回的风格对象
 * @returns {string} 日期字符串，如 "6.25"
 */
export function getDateStr(style) {
    let date;
    if (style && style.useCustomDate && style.customDate) {
        const parts = style.customDate.split('-');
        if (parts.length === 3) {
            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            return style.customDate;
        }
    } else {
        date = new Date();
    }
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const fmt = style?.titleDateFormat || 'M.D';
    switch (fmt) {
        case 'MM-DD':
            return `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        case 'X月X日':
            return `${m}月${d}日`;
        case 'YYYY-MM-DD':
            return `${date.getFullYear()}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        case 'M.D':
        default:
            return `${m}.${d}`;
    }
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
 * 生成反馈标题（模板化）
 * 默认模板 '{日期}{姓名}{科目}{试听}课堂反馈' 等同于原硬编码行为，保证旧数据兼容。
 *
 * 支持占位符：
 *   {日期} - 根据 titleDateFormat 格式化的日期
 *   {姓名} - 学生姓名（小组模式用顿号连接，受 nameShorten 影响）
 *   {科目} - 科目名
 *   {试听} - 试听标记（试听课为"试听"，否则为空）
 *   {机构} - 机构名（style.institutionName）
 *   {老师} - 老师名（style.teacherName）
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
    const tpl = (style && style.titleTemplate) || '{日期}{姓名}{科目}{试听}课堂反馈';
    const dateStr = getDateStr(style);

    let namePart = '';
    let trialPart = '';

    if (group && group.length > 0) {
        // 小组模式：所有学生姓名用连接符拼接（默认顿号，可配 style.groupNameSeparator）
        const sep = (style && style.groupNameSeparator) || '、';
        const names = group.map(id => {
            const s = getStudentById(id);
            if (!s) return '';
            return getDisplayName(s.name, style);
        }).filter(Boolean);
        namePart = names.join(sep);
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
    const institution = (style && style.institutionName) || '';
    const teacher = (style && style.teacherName) || '';

    // 占位符替换（replaceAll 安全：占位符未出现时无副作用）
    return tpl
        .replaceAll('{日期}', dateStr)
        .replaceAll('{姓名}', namePart)
        .replaceAll('{科目}', subjectPart)
        .replaceAll('{试听}', trialPart)
        .replaceAll('{机构}', institution)
        .replaceAll('{老师}', teacher);
}

/**
 * 解析模块名包裹符号配置为 open/close 一对字符串
 * 支持：'【】' | '[]' | '（）' | '·' | 'none' | 自定义双字符 | 自定义单字符
 * @param {string} wrap - 包裹符号配置
 * @returns {{open:string, close:string}}
 */
export function resolveModuleWrap(wrap) {
    if (!wrap || wrap === '【】') return { open: '【', close: '】' };
    if (wrap === '[]') return { open: '[', close: ']' };
    if (wrap === '（）') return { open: '（', close: '）' };
    if (wrap === '·') return { open: '· ', close: '' };
    if (wrap === 'none') return { open: '', close: '' };
    // 自定义：双字符取首尾，单字符只作前缀
    if (wrap.length >= 2) return { open: wrap[0], close: wrap[wrap.length - 1] };
    if (wrap.length === 1) return { open: wrap, close: '' };
    return { open: '【', close: '】' };
}

/**
 * 模块图标映射
 * 优先级：
 * 1. 用户在 Storage.modules 中为该模块配置的 icon
 * 2. style.moduleIconOverrides 中的覆盖值
 * 3. 按模块名硬编码的默认图标
 */
export function getModuleIcon(moduleName) {
    // feedback.js 顶部已 import Storage，此处直接读取用户配置
    try {
        const modules = Storage.getModules();
        const mod = modules.find(m => m.name === moduleName);
        if (mod && mod.icon) return mod.icon;
    } catch (e) {
        // Storage 未初始化等异常时降级到默认映射
    }
    // 读取 style 中的覆盖表
    try {
        const style = Storage.getStyle();
        if (style && style.moduleIconOverrides && style.moduleIconOverrides[moduleName]) {
            return style.moduleIconOverrides[moduleName];
        }
    } catch (e) {
        // 忽略
    }
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
 * 统一公共模块：可配置的公共模块对所有学生保持一致
 * 提取自原 app.js _unifyCommonModules，正则规则 1:1 保留
 *
 * 策略：取第一位学生的公共模块内容，用 5 条正则把学生姓名替换为集体称谓，
 * 然后统一应用到所有学生的这些模块上。
 *
 * 公共模块列表和称谓均从 style 读取（默认 ['课堂内容','课后作业'] + '同学们'，
 * 向后兼容旧调用）。
 *
 * @param {Array<{studentName: string, feedback: Array<{module: string, content: string}>}>} feedbacks
 * @param {object} [style] - 可选，Storage.getStyle()；不传则用默认值
 * @returns {Array} 统一后的 feedbacks（深拷贝）
 */
export function unifyCommonModules(feedbacks, style) {
    if (!feedbacks || feedbacks.length < 2) return feedbacks;

    // 从 style 读取公共模块和称谓，向后兼容
    const COMMON_MODULES = (style && Array.isArray(style.commonModules))
        ? style.commonModules
        : ['课堂内容', '课后作业'];
    const addressTerm = (style && style.groupAddressTerm) || '同学们';
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
            // 过滤掉公共模块中的学生姓名（兜底处理），替换为集体称谓
            let cleanedContent = mod.content;
            for (const pattern of namePatterns) {
                const p = escapeRegex(pattern);
                // 1. 替换 "请pattern..." 模式
                const regex1 = new RegExp(`请${p}([在需应]|同学|完成|独立|复习|梳理|注意|重点|及时)`, 'g');
                cleanedContent = cleanedContent.replace(regex1, `请${addressTerm}$1`);
                // 2. 替换 "pattern的" 模式（前面不能是汉字，避免"说明的"被"明"误替换）
                const regex2 = new RegExp(`(?<![\\u4e00-\\u9fff])${p}的`, 'g');
                cleanedContent = cleanedContent.replace(regex2, `${addressTerm}的`);
                // 3. 替换 "pattern在..." 模式（pattern在课堂上、pattern在课后）
                const regex3 = new RegExp(`(?<![\\u4e00-\\u9fff])${p}在(课堂|课后|本节课|课堂中)`, 'g');
                cleanedContent = cleanedContent.replace(regex3, `${addressTerm}在$1`);
                // 4. 替换 "pattern表现"、"pattern回答" 等动词搭配
                const regex4 = new RegExp(`(?<![\\u4e00-\\u9fff])${p}(表现|回答|提问|参与|完成|掌握|理解|笔记|专注|积极|安静)`, 'g');
                cleanedContent = cleanedContent.replace(regex4, `${addressTerm}$1`);
                // 5. 替换 "pattern需要"、"pattern应" 模式
                const regex5 = new RegExp(`(?<![\\u4e00-\\u9fff])${p}(需要|应|可以|建议|需)`, 'g');
                cleanedContent = cleanedContent.replace(regex5, `${addressTerm}$1`);
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
 * 格式：[开场白\n\n]标题 + 空行 + 各模块「包裹符号+模块名+包裹符号」\n内容[分隔符 附件提示][\n\n结尾话术]
 *
 * 支持自定义包裹符号（style.moduleWrap）和模块间分隔符（style.moduleSeparator）。
 * 支持开场白（style.useOpening + style.feedbackOpening）和结尾话术（style.useClosing + style.feedbackClosing）。
 * 支持附件提示（style.useAttachmentHint + style.attachmentHint）。
 * 默认值与原硬编码行为一致，保证旧调用方兼容。
 *
 * 开场白/结尾占位符：{家长} {老师} {学生} {科目} {日期} {机构}
 * 占位符替换时若 context 缺失对应字段，替换为空字符串。
 *
 * @param {Array<{module: string, content: string}>} feedback - 反馈数组
 * @param {string} title - 标题
 * @param {object} [style] - 可选，Storage.getStyle() 返回的风格对象
 * @param {object} [context] - 可选，占位符上下文 {student, parent, teacher, subject, date, institution}
 * @returns {string} 拼接后的文本
 */
export function buildFeedbackText(feedback, title, style, context) {
    const wrap = resolveModuleWrap(style?.moduleWrap);
    const sep = style?.moduleSeparator ?? '\n\n';
    const body = (feedback || [])
        .map(f => `${wrap.open}${f.module}${wrap.close}\n${f.content}`)
        .join(sep);

    // 占位符替换辅助函数
    const fillPlaceholders = (tpl) => {
        if (!tpl) return '';
        const ctx = context || {};
        return tpl
            .replaceAll('{家长}', ctx.parent || '')
            .replaceAll('{老师}', ctx.teacher || (style && style.teacherName) || '')
            .replaceAll('{学生}', ctx.student || '')
            .replaceAll('{科目}', ctx.subject || '')
            .replaceAll('{日期}', ctx.date || '')
            .replaceAll('{机构}', ctx.institution || (style && style.institutionName) || '');
    };

    // 开场白（在标题之前）
    let opening = '';
    if (style && style.useOpening && style.feedbackOpening) {
        opening = fillPlaceholders(style.feedbackOpening).trim();
    }

    // 结尾话术（在所有内容之后）
    let closing = '';
    if (style && style.useClosing && style.feedbackClosing) {
        closing = fillPlaceholders(style.feedbackClosing).trim();
    }

    // 附件提示（追加在正文末尾，结尾话术之前）
    let attachmentHint = '';
    if (style && style.useAttachmentHint && style.attachmentHint) {
        attachmentHint = style.attachmentHint;
    }

    // 拼装：[开场白\n\n]标题\n\n正文[附件提示][\n\n结尾]
    let result = '';
    if (opening) result += opening + '\n\n';
    result += `${title}\n\n${body}`;
    if (attachmentHint) result += attachmentHint;
    if (closing) result += '\n\n' + closing;
    return result;
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
