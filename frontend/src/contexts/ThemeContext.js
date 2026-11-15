import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem("theme") || localStorage.getItem("legallink_theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        return savedTheme;
      }
      // Check system preference if no saved preference
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch (e) {
      console.warn("Could not read theme from localStorage", e);
    }
    return "light";
  });

  useEffect(() => {
    try {
      localStorage.setItem("theme", theme);
      localStorage.setItem("legallink_theme", theme);
    } catch (e) {
      console.warn("Could not save theme to localStorage", e);
    }

    const root = document.documentElement;
    const body = document.body;

    root.setAttribute("data-theme", theme);
    // Keep Bootstrap components (forms, modals, dropdowns, tables) in sync
    root.setAttribute("data-bs-theme", theme);
    if (body) {
      body.setAttribute("data-theme", theme);
    }

    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      if (body) {
        body.classList.add("dark");
        body.classList.remove("light");
      }
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      if (body) {
        body.classList.remove("dark");
        body.classList.add("light");
      }
      root.style.colorScheme = "light";
    }

    // Broadcast custom event so any non-react listeners can also respond
    try {
      window.dispatchEvent(new CustomEvent("legallink-theme-change", { detail: { theme } }));
    } catch (e) {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const isDark = theme === "dark";

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: "light",
      toggleTheme: () => {},
      isDark: false,
      setTheme: () => {},
    };
  }
  return context;
};

export default ThemeContext;
