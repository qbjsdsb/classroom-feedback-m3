// dataTransfer.js - 数据导入导出
// 原 /workspace/newclassroom/js/pages/settingsPage.js 的 exportData/importData 迁移而来
// 与原逻辑的区别：导入时直接写入 store 和 Storage，不再走 localStorage 中转

import DB from '../db';
import Storage from '../storage';
import { store } from '../store';
import { UI } from './ui';

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
        UI.showToast('导入失败：文件格式错误');
        reject(new Error('文件格式错误'));
        return;
      }

      if (!data || typeof data !== 'object') {
        UI.showToast('导入失败：文件格式错误');
        reject(new Error('文件格式错误'));
        return;
      }

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
        UI.showToast('导入失败：' + (err.message || '未知错误'));
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
