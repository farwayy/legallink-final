import React, { useEffect, useState } from "react";
import { X, Lock, CheckCircle2, CreditCard } from "lucide-react";
import DemoPaymentModal from "./DemoPaymentModal";
import { paymentAPI } from "../services/api";
import "../styles/payment.css";

const PACKAGE_LABEL = { gold: "Gold", platinum: "Platinum" };
const PACKAGE_FEE = { gold: 25000, platinum: 45000 };

// Ask the server once per page load whether card payments are on
let configCache = null;
const loadConfig = () => {
  if (!configCache) {
    configCache = paymentAPI
      .getConfig()
      .then((res) => res.data)
      .catch(() => ({ enabled: false }));
  }
  return configCache;
};

/**
 * Pay for an inquiry the advocate has accepted.
 *
 * With Stripe set up on the server, this shows a summary and sends the citizen
 * to Stripe's secure payment page. The case opens after Stripe confirms the payment.
 * Without Stripe, it falls back to the demo payment screen.
 *
 * Props: isOpen, onClose, inquiry ({ _id, packageType, amount, title }), lawyer, currentUser,
 *        onDemoSuccess (demo mode only)
 */
const PaymentCheckout = ({ isOpen, onClose, inquiry, lawyer, currentUser, onDemoSuccess }) => {
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    loadConfig().then((c) => alive && setConfig(c));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setBusy(false);
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, busy, onClose]);

  if (!isOpen || !config) return null;

  const pkg = inquiry?.packageType || "gold";

  if (!config.enabled) {
    return (
      <DemoPaymentModal isOpen={isOpen} onClose={onClose} lawyer={lawyer} packageType={pkg} currentUser={currentUser} onSuccess={onDemoSuccess} />
    );
  }

  const amount = PACKAGE_FEE[pkg] || inquiry?.amount || 25000;
  const advocate = lawyer?.name || "your advocate";

  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await paymentAPI.createCheckout(inquiry._id);
      window.location.assign(res.data.url);
    } catch (err) {
      const data = err.response?.data || {};
      if (data.caseId) {
        window.location.assign(`/case/${data.caseId}`);
        return;
      }
      setError(data.message || "Could not open the payment page. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="pay-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="pay-box" role="dialog" aria-modal="true" aria-labelledby="pay-title">
        <div className="pay-head">
          <div>
            <h2 id="pay-title">Pay and open your case</h2>
            <p>{advocate} accepted your inquiry.</p>
          </div>
          <button type="button" className="pay-x" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div className="pay-body">
          {error && <div className="pay-error" role="alert">{error}</div>}

          <dl className="pay-rows">
            <div className="pay-row">
              <dt>Advocate</dt>
              <dd>{advocate}</dd>
            </div>
            {inquiry?.title && (
              <div className="pay-row">
                <dt>Matter</dt>
                <dd>{inquiry.title}</dd>
              </div>
            )}
            <div className="pay-row">
              <dt>Package</dt>
              <dd>{PACKAGE_LABEL[pkg] || pkg}</dd>
            </div>
            <div className="pay-row is-total">
              <dt>Total</dt>
              <dd>PKR {Number(amount).toLocaleString()}</dd>
            </div>
          </dl>

          <ul className="pay-steps">
            <li><CheckCircle2 size={16} /> You'll pay on Stripe's secure page, then come straight back here.</li>
            <li><CheckCircle2 size={16} /> Your case file opens as soon as the payment goes through.</li>
            <li><CheckCircle2 size={16} /> A receipt is emailed to {currentUser?.email || "you"}.</li>
          </ul>

          <button type="button" className="pay-btn" onClick={pay} disabled={busy} aria-busy={busy}>
            {busy ? <span className="pay-spin" /> : <CreditCard size={18} />}
            {busy ? "Opening secure payment…" : `Pay PKR ${Number(amount).toLocaleString()} by card`}
          </button>

          <p className="pay-secure">
            <Lock size={13} /> Card details are handled by Stripe. LegalLink never sees them.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentCheckout;
