import React, { useState, useEffect } from "react";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  ArrowRight,
  Sparkles
} from "lucide-react";

/**
 * Standard Luhn Checksum validation algorithm.
 */
function isValidLuhn(numberString) {
  const clean = numberString.replace(/\D/g, "");
  if (clean.length < 13 || clean.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

const PACKAGE_PRICES = {
  gold: {
    amount: 25000,
    formatted: "PKR 25,000",
    name: "Gold Retainer Package",
    features: [
      "Official representation inquiry rights",
      "Direct consultation & case thread messaging",
      "Case file review & court calendar tracking"
    ]
  },
  platinum: {
    amount: 45000,
    formatted: "PKR 45,000",
    name: "Platinum Comprehensive Retainer",
    features: [
      "Prioritized direct representation rights",
      "Unlimited consultation inquiries",
      "Comprehensive statutory analysis & pleading prep"
    ]
  }
};

const DemoPaymentModal = ({
  isOpen,
  onClose,
  lawyer,
  packageType = "gold",
  currentUser,
  onSuccess
}) => {
  const pkg = PACKAGE_PRICES[packageType] || PACKAGE_PRICES.gold;

  // Form Fields
  const [cardholderName, setCardholderName] = useState(currentUser?.name || "");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  // UI Flow States: 'form' | 'processing' | 'success' | 'failed'
  const [paymentState, setPaymentState] = useState("form");
  const [errorMessage, setErrorMessage] = useState("");
  const [transactionId, setTransactionId] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPaymentState("form");
      setErrorMessage("");
      setCardholderName(currentUser?.name || "");
      setCardNumber("");
      setExpiry("");
      setCvv("");
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Format Card Number (adds spaces every 4 digits)
  const handleCardNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const parts = raw.match(/.{1,4}/g);
    setCardNumber(parts ? parts.join(" ") : "");
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (e) => {
    let raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      raw = raw.slice(0, 2) + "/" + raw.slice(2, 4);
    }
    setExpiry(raw);
  };

  // Format CVV (3-4 digits)
  const handleCvvChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCvv(raw);
  };

  // Quick Autofill Test Card
  const fillTestCard = () => {
    setCardholderName(currentUser?.name || "Demo Citizen");
    setCardNumber("4242 4242 4242 4242");
    setExpiry("12/28");
    setCvv("123");
    setErrorMessage("");
  };

  // Form Validation & Process
  const handleSimulatePayment = (e) => {
    e.preventDefault();
    setErrorMessage("");

    const cleanCard = cardNumber.replace(/\s+/g, "");

    // 1. Basic format validation
    if (!cardholderName.trim()) {
      setErrorMessage("Please enter the cardholder name.");
      return;
    }
    if (cleanCard.length < 15 || cleanCard.length > 16) {
      setErrorMessage("Please enter a valid 15 or 16-digit card number.");
      return;
    }

    // 2. Validate Expiry format (MM/YY)
    const expiryParts = expiry.split("/");
    if (expiryParts.length !== 2) {
      setErrorMessage("Please enter expiry as MM/YY.");
      return;
    }
    const month = parseInt(expiryParts[0], 10);
    const year = parseInt("20" + expiryParts[1], 10);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    if (isNaN(month) || month < 1 || month > 12) {
      setErrorMessage("Invalid expiry month. Must be between 01 and 12.");
      return;
    }
    if (isNaN(year) || year < currentYear || (year === currentYear && month < currentMonth)) {
      setErrorMessage("Card expiry date has passed.");
      return;
    }

    // 3. Validate CVV
    if (cvv.length < 3) {
      setErrorMessage("Please enter a valid 3 or 4-digit CVV security code.");
      return;
    }

    // 4. Test Card & Luhn Check
    // Standard test card 4242 4242 4242 4242 always passes Luhn
    const isKnownTestCard = cleanCard === "4242424242424242";
    const passedLuhn = isValidLuhn(cleanCard);

    if (!isKnownTestCard && !passedLuhn) {
      setPaymentState("failed");
      setErrorMessage(
        "Payment Failed: Card number failed Luhn format check. For demo evaluations, please use test card 4242 4242 4242 4242."
      );
      return;
    }

    // 5. Begin 1.5 - 2 second Simulated Processing State
    setPaymentState("processing");

    setTimeout(() => {
      const generatedTxn = `DEMO-LL-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      setTransactionId(generatedTxn);
      setPaymentState("success");

      // ONLY THEN trigger the callback to create database records
      if (onSuccess) {
        onSuccess({
          transactionId: generatedTxn,
          packageType,
          amount: pkg.amount,
          paymentMethod: "demo",
          paymentStatus: "completed",
          cardLast4: cleanCard.slice(-4)
        });
      }
    }, 1800);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
        fontFamily: "var(--font-sans, Inter, sans-serif)"
      }}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "18px",
          maxWidth: "540px",
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #E2E8F0",
          position: "relative"
        }}
      >
        {/* Persistent Demo Warning Banner (Mandatory Requirement 5) */}
        <div
          style={{
            backgroundColor: "#FEF3C7",
            borderBottom: "1px solid #FDE68A",
            padding: "9px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "12px",
            fontWeight: "600",
            color: "#92400E",
            textAlign: "center"
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>Demo Payment Gateway — for demonstration purposes only, no real transaction is processed.</span>
        </div>

        {/* Close Button */}
        {paymentState !== "processing" && (
          <button
            onClick={onClose}
            aria-label="Close Checkout"
            style={{
              position: "absolute",
              top: "44px",
              right: "18px",
              background: "#F1F5F9",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748B",
              transition: "all 0.15s ease"
            }}
          >
            <X size={16} />
          </button>
        )}

        {/* Header */}
        <div style={{ padding: "24px 26px 16px 26px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#1E3F2E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#C5A059"
              }}
            >
              <CreditCard size={18} />
            </div>
            <div>
              <h3
                style={{
                  fontFamily: "var(--font-serif, 'Playfair Display', serif)",
                  fontSize: "19px",
                  fontWeight: 700,
                  margin: 0,
                  color: "#0F172A"
                }}
              >
                LegalLink Demo Checkout
              </h3>
              <span style={{ fontSize: "12px", color: "#64748B" }}>
                Retainer Engagement • Advocate {lawyer?.name || "Legal Counsel"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 26px" }}>
          {/* ── STATE: PROCESSING ── */}
          {paymentState === "processing" && (
            <div style={{ textAlign: "center", padding: "40px 16px" }}>
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  border: "4px solid #E2E8F0",
                  borderTopColor: "#0A3622",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 20px auto"
                }}
              />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <h4 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
                Processing Simulated Payment...
              </h4>
              <p style={{ fontSize: "13.5px", color: "#64748B", maxWidth: "340px", margin: "0 auto", lineHeight: 1.5 }}>
                Authorizing demo card and securing retainer allocation through simulated legal escrow...
              </p>
            </div>
          )}

          {/* ── STATE: SUCCESS ── */}
          {paymentState === "success" && (
            <div style={{ textAlign: "center", padding: "16px 8px 8px 8px" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: "#ECFDF5",
                  border: "2px solid #A7F3D0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#059669",
                  margin: "0 auto 16px auto"
                }}
              >
                <CheckCircle2 size={36} />
              </div>
              <h4
                style={{
                  fontFamily: "var(--font-serif, 'Playfair Display', serif)",
                  fontSize: "21px",
                  fontWeight: 700,
                  color: "#065F46",
                  marginBottom: "6px"
                }}
              >
                Demo Payment Authorized!
              </h4>
              <p style={{ fontSize: "13.5px", color: "#475569", marginBottom: "20px" }}>
                Your simulated transaction succeeded. Counsel has been notified and your retainer has been registered.
              </p>

              {/* Receipt Summary */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "16px",
                  textAlign: "left",
                  fontSize: "13px",
                  marginBottom: "24px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748B" }}>Transaction Reference:</span>
                  <span style={{ fontWeight: 600, color: "#0F172A", fontFamily: "monospace" }}>{transactionId}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748B" }}>Retained Counsel:</span>
                  <span style={{ fontWeight: 600, color: "#0F172A" }}>{lawyer?.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748B" }}>Retainer Package:</span>
                  <span style={{ fontWeight: 600, color: "#0F172A" }}>{pkg.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748B" }}>Payment Method:</span>
                  <span style={{ fontWeight: 600, color: "#0F172A" }}>Demo Simulated Card (•••• {cardNumber.slice(-4) || "4242"})</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #CBD5E1", paddingTop: "8px", marginTop: "8px" }}>
                  <span style={{ fontWeight: 700, color: "#0F172A" }}>Amount Simulated:</span>
                  <span style={{ fontWeight: 700, color: "#0A3622", fontSize: "14px" }}>{pkg.formatted}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  width: "100%",
                  backgroundColor: "#0A3622",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "13px 20px",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "14.5px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                <span>Continue to Profile & Direct Contact</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── STATE: FORM & FAILED ── */}
          {(paymentState === "form" || paymentState === "failed") && (
            <form onSubmit={handleSimulatePayment}>
              {/* Package Summary Box */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  marginBottom: "18px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px", color: "#0F172A" }}>
                    {pkg.name}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: "16px", color: "#0A3622" }}>
                    {pkg.formatted}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", lineHeight: 1.4 }}>
                  Includes 30 days direct counsel access, legal drafting inquiry rights, and court schedule notifications.
                </div>
              </div>

              {/* Test Card Quick Helper Card */}
              <div
                style={{
                  backgroundColor: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginBottom: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px"
                }}
              >
                <div style={{ fontSize: "12px", color: "#166534" }}>
                  <strong>Demo Testing:</strong> Use test card <code style={{ backgroundColor: "#DCFCE7", padding: "2px 5px", borderRadius: "4px" }}>4242 4242 4242 4242</code>
                </div>
                <button
                  type="button"
                  onClick={fillTestCard}
                  style={{
                    backgroundColor: "#166534",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "6px",
                    padding: "5px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    whiteSpace: "nowrap"
                  }}
                >
                  <Sparkles size={12} />
                  <span>Autofill</span>
                </button>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div
                  style={{
                    backgroundColor: "#FEF2F2",
                    border: "1px solid #FECACA",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    color: "#991B1B",
                    fontSize: "13px",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px"
                  }}
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <strong style={{ display: "block" }}>Payment Failed</strong>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Cardholder Name */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "5px" }}>
                  Name on Card *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Ali"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    fontSize: "13.5px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                />
              </div>

              {/* Card Number */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "5px" }}>
                  Card Number *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    required
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    maxLength={19}
                    style={{
                      width: "100%",
                      padding: "9px 12px 9px 38px",
                      fontSize: "13.5px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: "#FFFFFF",
                      boxSizing: "border-box",
                      letterSpacing: "1px",
                      fontFamily: "monospace",
                      outline: "none"
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94A3B8",
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    <CreditCard size={16} />
                  </div>
                </div>
              </div>

              {/* Expiry & CVV */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "5px" }}>
                    Expiry Date *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={handleExpiryChange}
                    maxLength={5}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      fontSize: "13.5px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: "#FFFFFF",
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                      outline: "none"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "5px" }}>
                    Security Code (CVV) *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="123"
                    value={cvv}
                    onChange={handleCvvChange}
                    maxLength={4}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      fontSize: "13.5px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: "#FFFFFF",
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  width: "100%",
                  backgroundColor: "#0A3622",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px 18px",
                  fontSize: "14.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.15s ease",
                  boxShadow: "0 2px 6px rgba(10, 54, 34, 0.2)"
                }}
              >
                <Lock size={15} />
                <span>Simulate Payment & Retain Counsel ({pkg.formatted})</span>
              </button>

              <div
                style={{
                  marginTop: "14px",
                  textAlign: "center",
                  fontSize: "11.5px",
                  color: "#94A3B8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                <ShieldCheck size={13} />
                <span>Sandbox Test Environment • Zero Real Financial Liability</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoPaymentModal;
