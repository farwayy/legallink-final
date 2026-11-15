import React from 'react';

const MovingBanner = () => {
  const words = [
    "FAMILY", "VIOLENCE", "JUSTICE", "ACCIDENT", 
    "BUSINESS", "PROPERTY", "DIVORCE", "CRIMINAL"
    , "CORPORATE", "INSURANCE"
  ];

  // Triple the words for smoother loop
  const allWords = [...words, ...words, ...words];

  return (
    <div style={{
      backgroundColor: "#070A10",
      padding: "50px 0",
      overflow: "hidden",
      position: "relative",
      borderTop: "1px solid rgba(212, 175, 55, 0.25)",
      borderBottom: "1px solid rgba(212, 175, 55, 0.25)",
      boxShadow: "inset 0 0 30px rgba(0, 0, 0, 0.8)"
    }}>
      <div
        style={{
          display: "flex",
          gap: "50px",
          whiteSpace: "nowrap",
          animation: "scrollBanner 35s linear infinite",
          width: "fit-content",
          alignItems: "center"
        }}
        className="moving-banner-content"
      >
        {allWords.map((word, index) => (
          <React.Fragment key={index}>
            <span
              style={{
                color: "#E2E8F0",
                fontSize: "36px",
                fontWeight: "600",
                fontFamily: "Marcellus, serif",
                letterSpacing: "3px",
                display: "inline-block",
                whiteSpace: "nowrap",
                flexShrink: 0,
                textShadow: "0 0 20px rgba(212, 175, 55, 0.15)"
              }}
            >
              {word}
            </span>
            <span style={{ color: "#D4AF37", fontSize: "20px", opacity: 0.7 }}>✦</span>
          </React.Fragment>
        ))}
      </div>

      {/* Add CSS animation */}
      <style>
        {`
          @keyframes scrollBanner {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-33.33%);
            }
          }
          .moving-banner-content {
            animation: scrollBanner 20s linear infinite;
          }
          .moving-banner-content:hover {
            animation-play-state: paused;
          }
        `}
      </style>
    </div>
  );
};

export default MovingBanner;