// dataTransfer.js - 数据导入导出
// 原 /workspace/newclassroom/js/pages/settingsPage.js 的 exportData/importData 迁移而来
// 与原逻辑的区别：导入时直接写入 store 和 Storage，不再走 localStorage 中转

import DB from '../db';
import Storage from '../storage';
import { store } from '../store';
import { UI } from './ui';

/**
 * 仅导出配置类数据（不含学生/历史/快捷回复等业务数据），用于换机构时迁移配置。
 * 包含：style、modules、科目列表、科目专属模板、Prompt 模板库
 * 返回配置对象（同时触发文件下载）。
 */
export function exportConfig() {
  const config = {
    type: 'classroom-feedback-config',
    version: 1,
    exportDate: new Date().toISOString(),
    style: Storage.getStyle(),
    modules: Storage.getModules(),
    subjects: store.getSubjects(),
    subjectTemplates: {},
    promptTemplates: store.getPromptTemplates(),
  };
  // 科目专属模板
  store.getSubjects().forEach(s => {
    const template = store.getSubjectTemplate(s.id);
    if (template) {
      config.subjectTemplates[s.id] = template;
    }
  });

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `classroom-config-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  UI.showToast('配置已导出');
  return config;
}

/**
 * 校验配置文件结构。校验失败抛出带可读信息的 Error。
 */
function validateConfigData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('文件内容不是有效的 JSON 对象');
  }
  if (data.type && data.type !== 'classroom-feedback-config') {
    throw new Error('文件类型不匹配，期望 classroom-feedback-config，实际 ' + data.type);
  }
  // style 必须是对象
  if (Object.prototype.hasOwnProperty.call(data, 'style')) {
    if (typeof data.style !== 'object' || Array.isArray(data.style)) {
      throw new Error('style 字段必须是对象');
    }
  }
  // modules 必须是数组
  if (Object.prototype.hasOwnProperty.call(data, 'modules') && !Array.isArray(data.modules)) {
    throw new Error('modules 字段必须是数组');
  }
  // subjects 必须是数组
  if (Object.prototype.hasOwnProperty.call(data, 'subjects') && !Array.isArray(data.subjects)) {
    throw new Error('subjects 字段必须是数组');
  }
  // subjectTemplates 必须是对象
  if (Object.prototype.hasOwnProperty.call(data, 'subjectTemplates')) {
    if (typeof data.subjectTemplates !== 'object' || Array.isArray(data.subjectTemplates)) {
      throw new Error('subjectTemplates 字段必须是对象');
    }
  }
  // promptTemplates 必须是数组
  if (Object.prototype.hasOwnProperty.call(data, 'promptTemplates') && !Array.isArray(data.promptTemplates)) {
    throw new Error('promptTemplates 字段必须是数组');
  }
}

/**
 * 仅导入配置类数据（覆盖 style/modules/subjects/subjectTemplates/promptTemplates）。
 * 不动学生、反馈历史、快捷回复等业务数据。
 *
 * @param {File} file - 用户选择的 JSON 配置文件
 * @param {object} [options]
 * @param {boolean} [options.replaceSubjects=true] - 是否覆盖科目列表（true=替换，false=保留现有）
 * @returns {Promise<{snapshot: object}>} 导入成功返回应用前快照（用于撤销）
 */
export function importConfig(file, { replaceSubjects = true } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('未选择文件'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      let data;
      try {
        data = JSON.parse(e.target.result);
      } catch {
        UI.showToast('导入失败：文件格式错误，无法解析为 JSON');
        reject(new Error('文件格式错误'));
        return;
      }
      try {
        validateConfigData(data);
      } catch (validationErr) {
        UI.showToast('导入失败：' + validationErr.message);
        reject(validationErr);
        return;
      }

      // 应用前快照（用于撤销）
      const snapshot = {
        style: JSON.parse(JSON.stringify(Storage.getStyle())),
        modules: JSON.parse(JSON.stringify(Storage.getModules())),
        subjects: JSON.parse(JSON.stringify(store.getSubjects())),
        subjectTemplates: JSON.parse(JSON.stringify(store._subjectTemplatesCache || {})),
        promptTemplates: JSON.parse(JSON.stringify(store._promptTemplatesCache || [])),
      };

      try {
        if (data.style) Storage.saveStyle(data.style);
        if (data.modules) Storage.saveModules(data.modules);
        if (replaceSubjects && data.subjects) {
          store._subjects = data.subjects;
          store._saveSubjects();
        }
        if (data.subjectTemplates && typeof data.subjectTemplates === 'object') {
          // 替换模式：先清空缓存再写入
          store._subjectTemplatesCache = {};
          Object.entries(data.subjectTemplates).forEach(([subjectId, template]) => {
            try {
              store._subjectTemplatesCache[subjectId] = template;
              DB.putRecord('subjectTemplates', { subjectId, template });
            } catch (err) {
              console.warn(`导入科目模板失败 (${subjectId}):`, err);
            }
          });
        }
        if (data.promptTemplates && Array.isArray(data.promptTemplates)) {
          store._promptTemplatesCache = data.promptTemplates;
          store._savePromptTemplates();
        }

        UI.showToast('配置已导入，页面即将刷新');
        setTimeout(() => location.reload(), 1500);
        resolve({ snapshot });
      } catch (err) {
        // 导入失败：回滚
        try {
          Storage.saveStyle(snapshot.style);
          Storage.saveModules(snapshot.modules);
          store._subjects = snapshot.subjects;
          store._saveSubjects();
          store._subjectTemplatesCache = snapshot.subjectTemplates;
          store._promptTemplatesCache = snapshot.promptTemplates;
          store._savePromptTemplates();
        } catch (restoreErr) {
          console.error('回滚失败:', restoreErr);
        }
        UI.showToast('导入失败：' + (err.message || '未知错误，已恢复原配置'));
        reject(err);
      }
    };
    reader.onerror = () => {
      UI.showToast('导入失败：文件读取错误');
      reject(new Error('文件读取错误'));
    };
    reader.readAsText(file);
  });
}

/**
 * 导出所有数据为 JSON 文件
 */
export function exportData() {
  const data = {
    students: store.getStudents(),
    subjects: store.getSubjects(),
    studentSubjects: store._studentSubjects,
    settings: {
      apiBaseUrl: Storage.getApiBaseUrl(),
      modules: Storage.getModules(),
      style: Storage.getStyle(),
      speechConfig: Storage.getSpeechConfig()
    },
    exportDate: new Date().toISOString()
  };

  // 导出反馈历史
  data.feedbackHistory = {};
  store.getStudents().forEach(s => {
    const history = store.getFeedbackHistory(s.id, 50);
    if (history.length > 0) {
      data.feedbackHistory[s.id] = history;
    }
  });

  // 导出科目专属模板
  data.subjectTemplates = {};
  store.getSubjects().forEach(s => {
    const template = store.getSubjectTemplate(s.id);
    if (template) {
      data.subjectTemplates[s.id] = template;
    }
  });

  // 导出学生常用点评模板
  data.studentTemplates = {};
  store.getStudents().forEach(s => {
    const templates = store.getStudentTemplates(s.id);
    if (templates.length > 0) {
      data.studentTemplates[s.id] = templates;
    }
  });

  // 导出快捷回复
  data.quickReplies = store.getQuickReplies();

  // 导出 Prompt 模板库
  const promptTemplates = store.getPromptTemplates();
  if (promptTemplates.length > 0) {
    data.promptTemplates = promptTemplates;
  }

  // 用 Blob + createObjectURL 触发下载
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `class-feedback-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Storage.setLastBackupTime();
  UI.showToast('数据已导出');
}

/**
 * 校验导入数据的结构与类型，避免损坏数据覆盖 store 致全应用崩溃。
 * 校验失败抛出带可读信息的 Error。
 */
function validateImportData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('文件内容不是有效的 JSON 对象');
  }
  // students：必须是数组，元素必须是含 id/name 的对象
  if (Object.prototype.hasOwnProperty.call(data, 'students')) {
    if (!Array.isArray(data.students)) throw new Error('students 字段必须是数组');
    for (const s of data.students) {
      if (!s || typeof s !== 'object' || typeof s.id !== 'string' || typeof s.name !== 'string') {
        throw new Error('students 数组中存在无效的学生记录（缺少 id 或 name）');
      }
    }
  }
  // subjects：必须是数组，元素必须是含 id/name 的对象
  if (Object.prototype.hasOwnProperty.call(data, 'subjects')) {
    if (!Array.isArray(data.subjects)) throw new Error('subjects 字段必须是数组');
    for (const s of data.subjects) {
      if (!s || typeof s !== 'object' || typeof s.id !== 'string' || typeof s.name !== 'string') {
        throw new Error('subjects 数组中存在无效的科目记录');
      }
    }
  }
  // studentSubjects：必须是对象（id -> array）
  if (Object.prototype.hasOwnProperty.call(data, 'studentSubjects')) {
    if (typeof data.studentSubjects !== 'object' || Array.isArray(data.studentSubjects)) {
      throw new Error('studentSubjects 字段必须是对象');
    }
  }
  // feedbackHistory / subjectTemplates / studentTemplates：必须是对象
  for (const key of ['feedbackHistory', 'subjectTemplates', 'studentTemplates']) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      if (typeof data[key] !== 'object' || Array.isArray(data[key])) {
        throw new Error(`${key} 字段必须是对象`);
      }
    }
  }
  // quickReplies / promptTemplates：必须是数组
  for (const key of ['quickReplies', 'promptTemplates']) {
    if (Object.prototype.hasOwnProperty.call(data, key) && !Array.isArray(data[key])) {
      throw new Error(`${key} 字段必须是数组`);
    }
  }
  // settings：必须是对象
  if (Object.prototype.hasOwnProperty.call(data, 'settings')) {
    if (typeof data.settings !== 'object' || Array.isArray(data.settings)) {
      throw new Error('settings 字段必须是对象');
    }
  }
}

/**
 * 深拷贝 store 当前状态作为回滚快照（导入失败时恢复，避免半导入不一致状态）
 */
function snapshotStore() {
  return {
    _students: JSON.parse(JSON.stringify(store._students || [])),
    _subjects: JSON.parse(JSON.stringify(store._subjects || [])),
    _studentSubjects: JSON.parse(JSON.stringify(store._studentSubjects || {})),
    _feedbackCache: JSON.parse(JSON.stringify(store._feedbackCache || {})),
    _subjectTemplatesCache: JSON.parse(JSON.stringify(store._subjectTemplatesCache || {})),
    _templatesCache: JSON.parse(JSON.stringify(store._templatesCache || {})),
    _quickRepliesCache: JSON.parse(JSON.stringify(store._quickRepliesCache || [])),
    _promptTemplatesCache: JSON.parse(JSON.stringify(store._promptTemplatesCache || [])),
  };
}

/**
 * 恢复 store 到快照状态（回滚失败的导入）
 */
function restoreStore(snap) {
  store._students = snap._students;
  store._subjects = snap._subjects;
  store._studentSubjects = snap._studentSubjects;
  store._feedbackCache = snap._feedbackCache;
  store._subjectTemplatesCache = snap._subjectTemplatesCache;
  store._templatesCache = snap._templatesCache;
  store._quickRepliesCache = snap._quickRepliesCache;
  store._promptTemplatesCache = snap._promptTemplatesCache;
  store._saveStudents();
  store._saveSubjects();
  store._saveStudentSubjects();
}

/**
 * 从 JSON 文件导入数据
 * @param {File} file - 用户选择的 JSON 文件
 * @returns {Promise<void>}
 */
export function importData(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('未选择文件'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      let data;
      try {
        data = JSON.parse(e.target.result);
      } catch {
        UI.showToast('导入失败：文件格式错误，无法解析为 JSON');
        reject(new Error('文件格式错误'));
        return;
      }

      // 1. 结构校验：不通过则拒绝导入，不触碰 store
      try {
        validateImportData(data);
      } catch (validationErr) {
        UI.showToast('导入失败：' + validationErr.message);
        reject(validationErr);
        return;
      }

      // 2. 备份当前 store 状态，导入中途失败时回滚，避免半导入不一致
      const snapshot = snapshotStore();

      try {
        // 学生：直接写入 store 缓存并持久化
        if (data.students) {
          store._students = data.students;
          store._saveStudents();
        }
        // 科目
        if (data.subjects) {
          store._subjects = data.subjects;
          store._saveSubjects();
        }
        // 学生-科目关联
        if (data.studentSubjects) {
          store._studentSubjects = data.studentSubjects;
          store._saveStudentSubjects();
        }
        // 设置
        if (data.settings) {
          if (Object.prototype.hasOwnProperty.call(data.settings, 'apiBaseUrl')) {
            Storage.setApiBaseUrl(data.settings.apiBaseUrl);
          }
          if (data.settings.modules) Storage.saveModules(data.settings.modules);
          if (data.settings.style) Storage.saveStyle(data.settings.style);
          if (data.settings.speechConfig) Storage.saveSpeechConfig(data.settings.speechConfig);
        }
        // 反馈历史：逐条写入 store 缓存和 IndexedDB
        if (data.feedbackHistory && typeof data.feedbackHistory === 'object') {
          Object.entries(data.feedbackHistory).forEach(([studentId, history]) => {
            try {
              store._feedbackCache[studentId] = history;
              DB.putRecord('feedback', { studentId, history });
            } catch (storageErr) {
              console.warn(`导入反馈历史失败 (${studentId}):`, storageErr);
            }
          });
        }
        // 科目专属模板
        if (data.subjectTemplates && typeof data.subjectTemplates === 'object') {
          Object.entries(data.subjectTemplates).forEach(([subjectId, template]) => {
            try {
              store._subjectTemplatesCache[subjectId] = template;
              DB.putRecord('subjectTemplates', { subjectId, template });
            } catch (storageErr) {
              console.warn(`导入科目模板失败 (${subjectId}):`, storageErr);
            }
          });
        }
        // 学生常用点评模板
        if (data.studentTemplates && typeof data.studentTemplates === 'object') {
          Object.entries(data.studentTemplates).forEach(([studentId, templates]) => {
            try {
              store._templatesCache[studentId] = templates;
              DB.putRecord('templates', { studentId, templates });
            } catch (storageErr) {
              console.warn(`导入学生模板失败 (${studentId}):`, storageErr);
            }
          });
        }
        // 快捷回复
        if (data.quickReplies && Array.isArray(data.quickReplies)) {
          try {
            store._quickRepliesCache = data.quickReplies;
            DB.putRecord('quickReplies', { id: 'main', replies: data.quickReplies });
          } catch (storageErr) {
            console.warn('导入快捷回复失败:', storageErr);
          }
        }
        // Prompt 模板库
        if (data.promptTemplates && Array.isArray(data.promptTemplates)) {
          try {
            store._promptTemplatesCache = data.promptTemplates;
            store._savePromptTemplates();
          } catch (storageErr) {
            console.warn('导入 Prompt 模板失败:', storageErr);
          }
        }

        UI.showToast('数据已导入，页面即将刷新');
        setTimeout(() => location.reload(), 1500);
        resolve();
      } catch (err) {
        // 3. 导入中途失败：回滚到快照，避免 store 处于半导入损坏状态
        try {
          restoreStore(snapshot);
        } catch (restoreErr) {
          console.error('回滚失败:', restoreErr);
        }
        UI.showToast('导入失败：' + (err.message || '未知错误，已恢复原数据'));
        reject(err);
      }
    };
    reader.onerror = () => {
      UI.showToast('导入失败：文件读取错误');
      reject(new Error('文件读取错误'));
    };
    reader.readAsText(file);
  });
}
