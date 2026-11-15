import React, { useState } from "react";
import Navbar from "../components/Navbar";
import AnimatedStepper from "../components/AnimatedStepper";
import { notify } from "../components/Toast";
import {
  FileText,
  UserCheck,
  Calendar,
  CheckCircle,
  Upload,
  User,
  Settings,
  Home,
  ShieldCheck
} from "lucide-react";

export default function StepperDemo() {
  const [demoMode, setDemoMode] = useState("legal"); // "legal" | "standard"
  const [legalStep, setLegalStep] = useState(1); // 0 to 3
  const [standardStep, setStandardStep] = useState(0);

  // 1. LegalLink Court Case Docket Stepper
  const legalCaseSteps = [
    {
      title: "Intake & Filing",
      subtitle: "Formal Petition Filed",
      icon: FileText,
      content: "The citizen filed the legal petition. Formal brief and grounds of litigation entered into the central legal registry."
    },
    {
      title: "Counsel Allocation",
      subtitle: "Advocate Appointed",
      icon: UserCheck,
      content: "Legal aid NGO verified initial intake and assigned High Court panel counsel Adv. Sarah Ahmed to represent the matter."
    },
    {
      title: "Court Proceedings",
      subtitle: "Active Bench Trials",
      icon: Calendar,
      content: "Submissions filed before Senior Civil Court Bench II. Multiple hearings scheduled for evidence recording and preliminary arguments."
    },
    {
      title: "Final Judgment",
      subtitle: "Disposed / Settled",
      icon: CheckCircle,
      content: "Decree executed and final court order obtained. Complete case docket archived in read-only audit compliance repository."
    }
  ];

  // 2. Standard 21st.dev Stepper (From Screenshot)
  const standardSteps = [
    { title: "Account", icon: User, content: "Account details and security credentials configured." },
    { title: "Profile", icon: Settings, content: "Legal specialization and jurisdiction preferences set." },
    { title: "Upload", icon: Upload, content: "Official identity proof and Bar Council license submitted." },
    { title: "Done", icon: Home, content: "Everything is verified and ready to commence." }
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-light)" }}>
      <Navbar />

      <div className="container py-5" style={{ maxWidth: "980px" }}>
        {/* Header Title */}
        <div className="text-center mb-5">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              backgroundColor: "var(--accent-tint, #FEFCE8)",
              border: "1px solid rgba(197, 160, 89, 0.4)",
              color: "var(--accent-hover, #B38E46)",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "12px"
            }}
          >
            <ShieldCheck size={14} />
            <span>Interactive UI Component Showcase</span>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "2.4rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: "10px"
            }}
          >
            Animated Progress Stepper
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "15.5px", maxWidth: "620px", margin: "0 auto" }}>
            High-fidelity interactive milestone tracker with smooth progress transitions, active node pulsing ring, and morphing checkmarks.
          </p>

          {/* Toggle between Legal Case Tracker & 21st.dev Demo */}
          <div className="d-flex justify-content-center gap-2 mt-4">
            <button
              onClick={() => setDemoMode("legal")}
              className={`btn ${demoMode === "legal" ? "btn-dark" : "btn-outline-secondary"}`}
              style={{
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: 600,
                padding: "6px 18px"
              }}
            >
              Legal Case Journey (Recommended)
            </button>
            <button
              onClick={() => setDemoMode("standard")}
              className={`btn ${demoMode === "standard" ? "btn-dark" : "btn-outline-secondary"}`}
              style={{
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: 600,
                padding: "6px 18px"
              }}
            >
              Original (Account / Profile / Upload)
            </button>
          </div>
        </div>

        {/* ── LIVE INTERACTIVE COMPONENT ── */}
        {demoMode === "legal" ? (
          <div>
            <AnimatedStepper
              steps={legalCaseSteps}
              activeStep={legalStep}
              onStepChange={(newStep) => setLegalStep(newStep)}
              nextLabel="Proceed to Next Stage"
              backLabel="Previous Stage"
              completeLabel="Conclude Matter"
              onComplete={() => notify("Case closed and archived.", "success")}
            >
              {/* Custom rich content box for the current judicial stage */}
              <div
                style={{
                  backgroundColor: "var(--bg-light)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "12px",
                  padding: "24px",
                  textAlign: "left"
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <span
                      style={{
                        backgroundColor: "#ECFDF5",
                        color: "#065F46",
                        border: "1px solid #A7F3D0",
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: "9999px"
                      }}
                    >
                      Stage {legalStep + 1} of {legalCaseSteps.length}
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {legalCaseSteps[legalStep].title}
                    </span>
                  </div>

                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Milestone Status: {legalStep === 3 ? "Concluded" : "In Progress"}
                  </span>
                </div>

                <p style={{ fontSize: "14.5px", lineHeight: 1.6, color: "var(--text-secondary)", margin: 0 }}>
                  {legalCaseSteps[legalStep].content}
                </p>
              </div>
            </AnimatedStepper>
          </div>
        ) : (
          <div>
            <AnimatedStepper
              steps={standardSteps}
              activeStep={standardStep}
              onStepChange={(newStep) => setStandardStep(newStep)}
              nextLabel="Continue"
              backLabel="Back"
              completeLabel="Complete Setup"
              onComplete={() => notify("Setup complete.", "success")}
            />
          </div>
        )}

        {/* Instructions Card for User */}
        <div
          className="mt-5 p-4"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid var(--border-hairline)",
            borderRadius: "14px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}
        >
          <h4 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
            Where We Can Use This Component in LegalLink:
          </h4>
          <ul style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, paddingLeft: "20px" }}>
            <li>
              <strong>On Case Dossier (`/case/:id`)</strong>: Automatically reflects the case status (Pending $\rightarrow$ Assigned $\rightarrow$ In Progress $\rightarrow$ Resolved).
            </li>
            <li>
              <strong>On Citizen Case Filing Form (`/user/dashboard`)</strong>: Breaks the long submission modal into a clean, stress-free 4-step wizard.
            </li>
            <li>
              <strong>On Lawyer / NGO Signup</strong>: Multi-step verification form for Bar ID, credentials, and practice areas.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
