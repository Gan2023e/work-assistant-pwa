import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE_URL } from '../config/api';
import { diagnoseAndFixStorage } from '../utils/storageUtils';

interface User {
  id: number;
  username: string;
  email?: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // 验证token
  const verifyToken = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        return result.user;
      } else {
        // 如果token无效，清理存储
        console.log('❌ Token验证失败，状态码:', response.status);
        if (response.status === 401 || response.status === 403) {
          console.log('🧹 清理无效的认证数据');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
        throw new Error('Token invalid');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      // 网络错误或其他错误时也清理存储
      if (error instanceof Error && 
          (error.message.includes('Failed to fetch') || 
           error.message.includes('NetworkError') || 
           error.message.includes('user_id'))) {
        console.log('🧹 检测到认证错误，清理存储数据');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      return null;
    }
  };

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      // 首先运行localStorage诊断和修复
      console.log('🏃‍♂️ 启动localStorage诊断...');
      const diagnosisResult = diagnoseAndFixStorage();
      if (diagnosisResult.hasProblems) {
        console.warn('⚠️ 发现并修复了localStorage问题:', diagnosisResult.message);
      }

      // 设置全局storage错误处理
      try {
        const { setupGlobalStorageErrorHandling } = await import('../utils/storageUtils');
        setupGlobalStorageErrorHandling();
        console.log('✅ 全局storage错误处理已设置');
      } catch (error) {
        console.warn('⚠️ 设置全局storage错误处理失败:', error);
      }

      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      console.log('🔍 初始化认证状态...');
      console.log('保存的 token:', savedToken ? '存在' : '不存在');
      console.log('保存的 user:', savedUser);

      if (savedToken && savedUser) {
        try {
          // 先尝试解析保存的用户信息
          let parsedUser;
          try {
            parsedUser = JSON.parse(savedUser);
          } catch (parseError) {
            console.error('用户信息 JSON 解析失败:', parseError);
            console.error('原始用户数据:', savedUser);
            // 清除损坏的数据
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setLoading(false);
            return;
          }

          // 验证token是否仍然有效
          const verifiedUser = await verifyToken(savedToken);
          if (verifiedUser) {
            setToken(savedToken);
            setUser(verifiedUser);
            console.log('✅ 用户认证成功:', verifiedUser);
          } else {
            // Token无效，清除本地存储
            console.log('❌ Token 验证失败，清除本地存储');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        } catch (error) {
          console.error('❌ 认证初始化失败:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } else {
        console.log('🔍 无保存的认证信息');
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    try {
      // 验证参数类型
      if (typeof newToken !== 'string' || !newToken) {
        throw new Error('Invalid token: must be a non-empty string');
      }
      
      if (!newUser || typeof newUser !== 'object') {
        throw new Error('Invalid user: must be a valid user object');
      }

      setToken(newToken);
      setUser(newUser);
      
      // 安全地存储token
      localStorage.setItem('token', newToken);
      
      // 安全地序列化和存储用户信息
      const userJson = JSON.stringify(newUser);
      if (userJson === '[object Object]') {
        throw new Error('User object serialization failed');
      }
      localStorage.setItem('user', userJson);
      
      console.log('✅ 用户登录成功，数据已保存:', newUser);
    } catch (error) {
      console.error('❌ 保存用户信息失败:', error);
      // 清理可能的损坏数据
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      throw error; // 重新抛出错误以便调用者处理
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 