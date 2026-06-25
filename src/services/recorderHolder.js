// recorderHolder.js - 录音引擎实例的全局持有者
// 原 /workspace/newclassroom 项目中 recorder 是全局单例，SettingsPage 通过 `typeof recorder !== 'undefined'` 访问。
// React 项目中 RecorderEngine 在 useRecorder hook 中实例化（RecordPage 挂载时），
// SettingsPage 需要访问 engine 的 getLogs/exportLogs/clearLogs/preloadWhisper 方法，
// 因此用模块级 holder 注册 engine 引用。

let _engine = null;

export function setRecorderEngine(engine) {
  _engine = engine;
}

export function getRecorderEngine() {
  return _engine;
}
