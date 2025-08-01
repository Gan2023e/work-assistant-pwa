import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE_URL } from '../config/api';

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
        throw new Error('Token invalid');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  };

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
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
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      console.log('✅ 用户登录成功，数据已保存:', newUser);
    } catch (error) {
      console.error('❌ 保存用户信息失败:', error);
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