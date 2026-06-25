// DataContext.jsx - 应用数据上下文
// 在应用启动时初始化 DB、Storage 和 store，并提供刷新机制

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Storage from '../storage';
import { store } from '../store';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    (async () => {
      await Storage.init();
      await store.init();
      Storage.initTheme();
      setReady(true);
    })();
  }, []);

  // 触发重新渲染（数据变更后调用）
  const refresh = useCallback(() => setRefreshCounter(c => c + 1), []);

  const value = { ready, store, Storage, refresh, refreshCounter };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
