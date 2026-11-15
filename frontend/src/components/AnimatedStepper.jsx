import React, { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import "./AnimatedStepper.css";

/**
 * AnimatedStepper Component
 * 
 * Reusable animated horizontal progress stepper for LegalLink.
 * Matches 21st.dev Stepper-03 design with spring lines, pulse ring on active step,
 * and morphing checkmarks for completed milestones.
 *
 * @param {Array} steps - Array of { title: string, subtitle?: string, icon?: LucideIcon, content?: ReactNode }
 * @param {number} activeStep - Current active step index (0-based)
 * @param {function} onStepChange - Callback when step changes (index) => void
 * @param {boolean} allowClickNavigation - Allow clicking on step circles to navigate
 * @param {string} nextLabel - Label for the continue button (default "Continue")
 * @param {string} backLabel - Label for the back button (default "Back")
 * @param {string} completeLabel - Label on final step (default "Submit")
 * @param {function} onComplete - Callback when clicking submit on final step
 * @param {boolean} showFooter - Whether to show footer Back/Continue buttons (default true)
 * @param {ReactNode} children - Optional custom content override for active step
 */
export default function AnimatedStepper({
  steps = [],
  activeStep: controlledActiveStep,
  onStepChange,
  allowClickNavigation = true,
  nextLabel = "Continue",
  backLabel = "Back",
  completeLabel = "Submit",
  onComplete,
  showFooter = true,
  children
}) {
  const [internalStep, setInternalStep] = useState(0);

  const isControlled = typeof controlledActiveStep === "number";
  const currentStep = isControlled ? controlledActiveStep : internalStep;

  const totalSteps = steps.length;
  if (totalSteps === 0) return null;

  const setStep = (newIndex) => {
    const clamped = Math.max(0, Math.min(newIndex, totalSteps - 1));
    if (!isControlled) {
      setInternalStep(clamped);
    }
    if (onStepChange) {
      onStepChange(clamped);
    }
  };

  const handleNext = () => {
    if (currentStep === totalSteps - 1) {
      if (onComplete) onComplete();
    } else {
      setStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setStep(currentStep - 1);
  };

  // Math for exact circle center alignment across N steps
  const trackLeftPercent = 100 / (2 * totalSteps);
  const trackSpanPercent = ((totalSteps - 1) / totalSteps) * 100;
  const progressRatio = totalSteps > 1 ? currentStep / (totalSteps - 1) : 1;
  const fillWidthPercent = progressRatio * trackSpanPercent;
  const pointerPositionPercent = trackLeftPercent + fillWidthPercent;

  const activeStepData = steps[currentStep] || {};

  return (
    <div className="animated-stepper-container">
      {/* ── Progress Track & Nodes Header ── */}
      <div className="stepper-track-wrapper">
        {/* Base Track Line */}
        <div
          className="stepper-base-line"
          style={{
            left: `${trackLeftPercent}%`,
            width: `${trackSpanPercent}%`
          }}
        />

        {/* Animated Filled Progress Line */}
        <div
          className="stepper-progress-fill"
          style={{
            left: `${trackLeftPercent}%`,
            width: `${fillWidthPercent}%`
          }}
        />

        {/* Leading Tip Pointer */}
        <div
          className="stepper-progress-pointer"
          style={{
            left: `${pointerPositionPercent}%`
          }}
        />

        {/* Step Nodes Row */}
        <div className="stepper-steps-row">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const Icon = step.icon;

            return (
              <button
                key={step.title || index}
                type="button"
                className="stepper-step-item"
                disabled={!allowClickNavigation}
                onClick={() => {
                  if (allowClickNavigation) {
                    setStep(index);
                  }
                }}
                aria-label={`Step ${index + 1}: ${step.title}`}
                aria-current={isActive ? "step" : undefined}
              >
                {/* Node Circle */}
                <div className="stepper-node-wrapper">
                  {/* Pulsing ring on active step */}
                  {isActive && <div className="stepper-pulse-ring" />}

                  <div
                    className={`stepper-node ${
                      isActive ? "active" : isCompleted ? "completed" : "upcoming"
                    }`}
                  >
                    {isCompleted ? (
                      <Check size={18} strokeWidth={2.6} className="stepper-check-icon" />
                    ) : Icon ? (
                      <Icon size={18} strokeWidth={2.2} />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                </div>

                {/* Step Title Label */}
                <div className="stepper-label-wrapper">
                  <span
                    className={`stepper-title ${
                      isActive ? "active" : isCompleted ? "completed" : ""
                    }`}
                  >
                    {step.title}
                  </span>
                  {step.subtitle && (
                    <span className="stepper-subtitle">{step.subtitle}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Step Content Body ── */}
      <div key={currentStep} className="stepper-content-box">
        {children ? (
          children
        ) : (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <h4
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: "0 0 6px"
              }}
            >
              {activeStepData.title}
            </h4>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                margin: 0,
                lineHeight: 1.5
              }}
            >
              {activeStepData.content || "Step details will appear here."}
            </p>
          </div>
        )}
      </div>

      {/* ── Footer Navigation Controls ── */}
      {showFooter && (
        <div className="stepper-footer">
          <button
            type="button"
            className="stepper-btn stepper-btn-back"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft size={16} />
            <span>{backLabel}</span>
          </button>

          <span className="stepper-counter">
            Step <strong>{currentStep + 1}</strong> of {totalSteps}
          </span>

          <button
            type="button"
            className="stepper-btn stepper-btn-next"
            onClick={handleNext}
          >
            <span>
              {currentStep === totalSteps - 1 ? completeLabel : nextLabel}
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
