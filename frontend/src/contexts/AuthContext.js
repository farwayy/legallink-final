import React, { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    const userRole = localStorage.getItem("userRole");

    if (token && savedUser && userRole) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = async (credentials, role) => {
    try {
      let response;
      if (role === "user") {
        response = await authAPI.userLogin(credentials);
        const { token, user } = response.data;
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify({ ...user, role: "user" }));
        localStorage.setItem("userRole", "user");
        setUser({ ...user, role: "user" });
        setIsAuthenticated(true);
        return { success: true };
      } else if (role === "lawyer") {
        response = await authAPI.lawyerLogin(credentials);
        const { token, lawyer } = response.data;
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({ ...lawyer, role: "lawyer" }),
        );
        localStorage.setItem("userRole", "lawyer");
        setUser({ ...lawyer, role: "lawyer" });
        setIsAuthenticated(true);
        return { success: true };
      } else if (role === "admin") {
        response = await authAPI.adminLogin(credentials);
        const { token, admin } = response.data;
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({ ...admin, role: "admin" }),
        );
        localStorage.setItem("userRole", "admin");
        setUser({ ...admin, role: "admin" });
        setIsAuthenticated(true);
        return { success: true };
      } else if (role === "ngo") {
        const { ngoAPI } = await import('../services/api');
        response = await ngoAPI.login(credentials);
        const { token, ngo } = response.data;
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({ ...ngo, role: "ngo" }),
        );
        localStorage.setItem("userRole", "ngo");
        setUser({ ...ngo, role: "ngo" });
        setIsAuthenticated(true);
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Login failed",
      };
    }
  };

  const signup = async (userData, role) => {
    try {
      let response;
      if (role === "user") {
        response = await authAPI.userSignup(userData);
        const { token, user } = response.data;
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify({ ...user, role: "user" }));
        localStorage.setItem("userRole", "user");
        setUser({ ...user, role: "user" });
        setIsAuthenticated(true);
        return { success: true };
      } else if (role === "lawyer") {
        response = await authAPI.lawyerSignup(userData);
        const { token, lawyer } = response.data;
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({ ...lawyer, role: "lawyer" }),
        );
        localStorage.setItem("userRole", "lawyer");
        setUser({ ...lawyer, role: "lawyer" });
        setIsAuthenticated(true);
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Signup failed",
      };
    }
  };

  const googleLogin = async (credential, role = "user") => {
    try {
      const response = await authAPI.googleLogin({ credential, role });
      const { token, user } = response.data;
      const userRole = user.role || role || "user";
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify({ ...user, role: userRole }));
      localStorage.setItem("userRole", userRole);
      setUser({ ...user, role: userRole });
      setIsAuthenticated(true);
      return { success: true, user: { ...user, role: userRole } };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Google sign in failed. Please try again.",
      };
    }
  };

  const logout = (redirectUrl = "/login") => {
    const savedTheme = localStorage.getItem("theme") || localStorage.getItem("legallink_theme");
    localStorage.clear();
    if (savedTheme === "dark" || savedTheme === "light") {
      localStorage.setItem("theme", savedTheme);
      localStorage.setItem("legallink_theme", savedTheme);
    }
    setUser(null);
    setIsAuthenticated(false);

    // Redirect cleanly to login page
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getMe();
      if (response.data.user) {
        const updatedUser = { ...response.data.user, role: response.data.role };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        googleLogin,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
