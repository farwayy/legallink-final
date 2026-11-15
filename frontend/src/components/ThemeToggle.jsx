import React from "react";
import { useTheme } from "../contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

/**
 * ThemeToggle
 * The single light/dark switch for the whole app. It is only rendered inside
 * navigation bars (public Navbar, Lawyer/NGO navbars, Admin header, auth header)
 * so every portal has exactly one, identically styled, theme control.
 */
const ThemeToggle = ({ className = "", style = {} }) => {
  const { toggleTheme, isDark } = useTheme();
  const label = `Switch to ${isDark ? "light" : "dark"} mode`;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`ll-theme-toggle ${className}`}
      style={style}
      title={label}
      aria-label={label}
    >
      {isDark ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
    </button>
  );
};

export default ThemeToggle;
