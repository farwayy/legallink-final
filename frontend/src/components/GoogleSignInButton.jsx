import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigate } from "react-router-dom";

const GoogleSignInButton = ({ 
  role = "user", 
  onSuccessRedirect = "/user/dashboard", 
  onError,
  text = "continue_with",
  shape = "pill"
}) => {
  const { googleLogin } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      if (onError) onError("No credential received from Google.");
      return;
    }

    setLoading(true);
    try {
      const result = await googleLogin(credentialResponse.credential, role);
      if (result.success) {
        navigate(onSuccessRedirect);
      } else {
        if (onError) onError(result.error || "Google authentication failed. Please try again.");
      }
    } catch (err) {
      if (onError) onError(err.message || "An unexpected error occurred during Google sign-in.");
    } finally {
      setLoading(false);
    }
  };

  const handleError = () => {
    if (onError) {
      onError("Google sign-in popup was cancelled or failed to load. Please verify your connection.");
    }
  };

  return (
    <div 
      className="google-signin-wrapper"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        opacity: loading ? 0.6 : 1,
        pointerEvents: loading ? "none" : "auto",
        transition: "opacity 0.2s ease"
      }}
    >
      <div 
        style={{
          borderRadius: "9999px",
          overflow: "hidden",
          display: "inline-flex",
          justifyContent: "center",
          boxShadow: isDark ? "0 4px 14px rgba(0, 0, 0, 0.4)" : "0 2px 8px rgba(15, 23, 42, 0.08)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease"
        }}
        className="google-curvy-pill"
      >
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          theme={isDark ? "filled_black" : "outline"}
          size="large"
          shape={shape}
          text={text}
          locale="en"
        />
      </div>
      {loading && (
        <span style={{ fontSize: "12px", color: isDark ? "#94A3B8" : "#64748B", marginTop: "6px" }}>
          Authenticating with LegalLink...
        </span>
      )}
    </div>
  );
};

export default GoogleSignInButton;
