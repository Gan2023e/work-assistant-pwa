import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BackgroundTask } from '../components/BackgroundTaskManager';

interface TaskContextType {
  tasks: BackgroundTask[];
  addTask: (task: Omit<BackgroundTask, 'id' | 'startTime'>) => string;
  updateTask: (taskId: string, updates: Partial<BackgroundTask>) => void;
  removeTask: (taskId: string) => void;
  getRunningTasks: () => BackgroundTask[];
  hasRunningTasks: () => boolean;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

interface TaskProviderProps {
  children: ReactNode;
}

export const TaskProvider: React.FC<TaskProviderProps> = ({ children }) => {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);

  // 从 localStorage 恢复任务状态
  useEffect(() => {
    const savedTasks = localStorage.getItem('backgroundTasks');
    if (savedTasks) {
      try {
        const parsedTasks = JSON.parse(savedTasks);
        // 将所有运行中的任务标记为错误状态（因为页面刷新中断了它们）
        const restoredTasks = parsedTasks.map((task: BackgroundTask) => 
          task.status === 'running' 
            ? { 
                ...task, 
                status: 'error' as const, 
                errorMessage: '页面刷新导致任务中断',
                endTime: Date.now()
              }
            : task
        );
        setTasks(restoredTasks);
      } catch (error) {
        console.error('恢复任务状态失败:', error);
      }
    }
  }, []);

  // 保存任务状态到 localStorage
  useEffect(() => {
    localStorage.setItem('backgroundTasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (task: Omit<BackgroundTask, 'id' | 'startTime'>) => {
    const newTask: BackgroundTask = {
      ...task,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      startTime: Date.now()
    };
    setTasks(prev => [...prev, newTask]);
    return newTask.id;
  };

  const updateTask = (taskId: string, updates: Partial<BackgroundTask>) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              ...updates, 
              endTime: (updates.status === 'completed' || updates.status === 'error') ? Date.now() : task.endTime 
            }
          : task
      )
    );
  };

  const removeTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const getRunningTasks = () => {
    return tasks.filter(task => task.status === 'running');
  };

  const hasRunningTasks = () => {
    return tasks.some(task => task.status === 'running');
  };

  // 全局页面卸载保护和状态清理
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const runningTasks = tasks.filter(task => task.status === 'running');
      
      // 如果有运行中的任务，显示警告
      if (runningTasks.length > 0) {
        const message = `您有 ${runningTasks.length} 个正在运行的后台任务，离开页面将会中断任务。确定要离开吗？`;
        e.preventDefault();
        e.returnValue = message;
        
        // 同时更新任务状态为中断
        const updatedTasks = tasks.map(task => 
          task.status === 'running' 
            ? { 
                ...task, 
                status: 'error' as const, 
                errorMessage: '用户离开页面导致任务中断',
                endTime: Date.now()
              }
            : task
        );
        localStorage.setItem('backgroundTasks', JSON.stringify(updatedTasks));
        
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tasks]);

  const value = {
    tasks,
    addTask,
    updateTask,
    removeTask,
    getRunningTasks,
    hasRunningTasks
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
};

export default TaskContext; 