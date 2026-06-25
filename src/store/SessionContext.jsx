// SessionContext.jsx - 会话上下文
// 管理当前选中的学生/小组/科目（跨页面共享）

import { createContext, useContext, useState } from 'react';

const SessionContext = createContext();

export function SessionProvider({ children }) {
  const [currentStudent, setCurrentStudent] = useState(null);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [currentSubject, setCurrentSubject] = useState(null);

  const value = {
    currentStudent,
    setCurrentStudent,
    currentGroup,
    setCurrentGroup,
    currentSubject,
    setCurrentSubject,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
