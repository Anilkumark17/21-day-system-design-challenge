import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getProfile, loginUser, registerUser } from "../api/auth.api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  const persistAuth = (token, nextUser) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const login = async (credentials) => {
    const { data } = await loginUser(credentials);
    persistAuth(data.token, data.user);
    return data;
  };

  const register = async (payload) => {
    const { data } = await registerUser(payload);
    persistAuth(data.token, data.user);
    return data;
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await getProfile();
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
