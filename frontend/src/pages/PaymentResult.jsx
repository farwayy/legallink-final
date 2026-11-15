import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, XCircle, ArrowRight, Receipt, AlertTriangle } from "lucide-react";
import Navbar from "../components/Navbar";
import { paymentAPI } from "../services/api";
import "../styles/payment.css";

const PACKAGE_LABEL = { gold: "Gold", platinum: "Platinum" };
const MAX_CHECKS = 10; // about 20 seconds

/**
 * Where Stripe sends the citizen back.
 *   /payment/success?session_id=...  confirms the payment and links to the new case
 *   /payment/cancelled?request=...   nothing was charged
 */
const PaymentResult = () => {
  const location = useLocation();
  const [params] = useSearchParams();
  const cancelled = location.pathname.endsWith("/cancelled");
  const sessionId = params.get("session_id");
  const requestId = params.get("request");

  const [state, setState] = useState(cancelled ? "cancelled" : "checking"); // checking | paid | waiting | error | cancelled
  const [info, setInfo] = useState(null);
  const [message, setMessage] = useState("");
  const checks = useRef(0);

  useEffect(() => {
    if (cancelled) return undefined;
    if (!sessionId) {
      setState("error");
      setMessage("This page needs the link Stripe sent you back with.");
      return undefined;
    }
    let timer;
    let alive = true;
    const check = async () => {
      checks.current += 1;
      try {
        const res = await paymentAPI.getSession(sessionId);
        if (!alive) return;
        setInfo(res.data);
        if (res.data.status === "paid" && res.data.caseId) {
          setState("paid");
          return;
        }
        if (checks.current < MAX_CHECKS) {
          setState(checks.current > 2 ? "waiting" : "checking");
          timer = setTimeout(check, 2000);
        } else {
          setState("waiting");
        }
      } catch (err) {
        if (!alive) return;
        if (checks.current < 3) {
          timer = setTimeout(check, 2000);
          return;
        }
        setState("error");
        setMessage(err.response?.data?.message || "We couldn't check your payment right now.");
      }
    };
    check();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [cancelled, sessionId]);

  const amount = info?.amount != null ? `PKR ${Number(info.amount).toLocaleString()}` : "";

  return (
    <div className="pay-page">
      <Navbar />
      <main className="pay-page-main">
        <section className="pay-card" aria-live="polite">
          {state === "checking" && (
            <>
              <div className="pay-mark is-wait"><Clock size={30} /></div>
              <h1>Confirming your payment…</h1>
              <p>This takes a few seconds. Please don't close this page.</p>
            </>
          )}

          {state === "paid" && (
            <>
              <div className="pay-mark"><CheckCircle2 size={32} /></div>
              <h1>Payment received</h1>
              <p>Thank you. Your case file is open and {info?.advocate || "your advocate"} has been told.</p>
              <dl className="pay-rows">
                <div className="pay-row">
                  <dt>Advocate</dt>
                  <dd>{info?.advocate || "—"}</dd>
                </div>
                <div className="pay-row">
                  <dt>Package</dt>
                  <dd>{PACKAGE_LABEL[info?.packageType] || info?.packageType || "—"}</dd>
                </div>
                {info?.paidAt && (
                  <div className="pay-row">
                    <dt>Paid on</dt>
                    <dd>{new Date(info.paidAt).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</dd>
                  </div>
                )}
                <div className="pay-row is-total">
                  <dt>Amount paid</dt>
                  <dd>{amount}</dd>
                </div>
              </dl>
              <div className="pay-actions">
                <Link to={`/case/${info.caseId}`} className="pay-btn">
                  Open your case file <ArrowRight size={17} />
                </Link>
                <Link to="/user/dashboard" className="pay-btn pay-btn-ghost">Go to dashboard</Link>
              </div>
              {info?.receiptUrl && (
                <a className="pay-receipt" href={info.receiptUrl} target="_blank" rel="noopener noreferrer">
                  <Receipt size={15} /> View receipt
                </a>
              )}
            </>
          )}

          {state === "waiting" && (
            <>
              <div className="pay-mark is-wait"><Clock size={30} /></div>
              <h1>Still confirming</h1>
              <p>
                {info?.status === "paid"
                  ? "Your payment went through. We're opening your case file now."
                  : "Stripe hasn't confirmed the payment yet. This can take a minute. We'll notify you as soon as it does, and your case will open automatically."}
              </p>
              <div className="pay-actions">
                <button type="button" className="pay-btn" onClick={() => window.location.reload()}>Check again</button>
                <Link to="/user/dashboard" className="pay-btn pay-btn-ghost">Go to dashboard</Link>
              </div>
            </>
          )}

          {state === "error" && (
            <>
              <div className="pay-mark is-off"><AlertTriangle size={30} /></div>
              <h1>We couldn't confirm the payment</h1>
              <p>{message} If you were charged, your case will still open once Stripe confirms the payment.</p>
              <div className="pay-actions">
                <button type="button" className="pay-btn" onClick={() => window.location.reload()}>Try again</button>
                <Link to="/user/dashboard" className="pay-btn pay-btn-ghost">Go to dashboard</Link>
              </div>
            </>
          )}

          {state === "cancelled" && (
            <>
              <div className="pay-mark is-off"><XCircle size={30} /></div>
              <h1>Payment cancelled</h1>
              <p>You weren't charged. Your advocate's acceptance is still valid, so you can pay whenever you're ready.</p>
              <div className="pay-actions">
                <Link to={requestId ? `/user/dashboard?pay=${requestId}` : "/user/dashboard"} className="pay-btn">Try again</Link>
                <Link to="/user/dashboard" className="pay-btn pay-btn-ghost">Back to dashboard</Link>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default PaymentResult;
