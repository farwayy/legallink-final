import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ExternalLink, Receipt, RefreshCw } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import DataTable from "../../components/admin/DataTable";
import SidePanel from "../../components/admin/SidePanel";
import { paymentAPI } from "../../services/api";
import { fmtDate } from "../../components/admin/helpers";

const PACKAGE_LABEL = { gold: "Gold", platinum: "Platinum" };
const STATUS = {
  completed: { text: "Paid", tone: "is-ok" },
  pending: { text: "Waiting for payment", tone: "is-warn" },
  failed: { text: "Failed", tone: "is-bad" },
  refunded: { text: "Refunded", tone: "is-info" },
};
const METHOD = { stripe: "Card (Stripe)", demo: "Demo payment" };

const money = (n) => `PKR ${Number(n || 0).toLocaleString()}`;
const fmtTime = (d) =>
  d ? new Date(d).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const whenOf = (p) => p.paidAt || p.createdAt;
const ref = (id) => `#${String(id).slice(-6).toUpperCase()}`;

const Payments = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(params.get("open"));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await paymentAPI.getAdminPayments();
      setRows(res.data.payments || []);
      setMode(res.data.mode || null);
    } catch (e) {
      setError("Could not load payments. Check that the server is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = rows.find((p) => p._id === openId) || null;
  const closePanel = () => {
    setOpenId(null);
    if (params.get("open")) {
      params.delete("open");
      setParams(params, { replace: true });
    }
  };

  // Figures for the strip
  const figures = useMemo(() => {
    const paid = rows.filter((p) => p.paymentStatus === "completed");
    const now = new Date();
    const thisMonth = paid.filter((p) => {
      const d = new Date(whenOf(p));
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const sum = (list) => list.reduce((t, p) => t + Number(p.amount || 0), 0);
    return {
      total: sum(paid),
      count: paid.length,
      month: sum(thisMonth),
      monthCount: thisMonth.length,
      pending: rows.filter((p) => p.paymentStatus === "pending").length,
      refunded: sum(rows.filter((p) => p.paymentStatus === "refunded")),
      average: paid.length ? Math.round(sum(paid) / paid.length) : 0,
    };
  }, [rows]);

  const is = (s) => (p) => p.paymentStatus === s;
  const tabs = [
    { key: "all", label: "All", count: rows.length },
    { key: "completed", label: "Paid", count: rows.filter(is("completed")).length, filter: is("completed") },
    { key: "pending", label: "Waiting", count: rows.filter(is("pending")).length, filter: is("pending") },
    { key: "failed", label: "Failed", count: rows.filter(is("failed")).length, filter: is("failed") },
    { key: "refunded", label: "Refunded", count: rows.filter(is("refunded")).length, filter: is("refunded") },
  ];

  const columns = [
    {
      key: "when",
      header: "Date",
      sortValue: (p) => new Date(whenOf(p)).getTime(),
      render: (p) => <span style={{ whiteSpace: "nowrap" }}>{fmtDate(whenOf(p))}</span>,
      csv: (p) => new Date(whenOf(p)).toISOString(),
    },
    {
      key: "citizen",
      header: "Paid by",
      sortValue: (p) => p.userId?.name || "",
      render: (p) => (
        <span>
          <span className="ax-cell-title">{p.userId?.name || "—"}</span>
          <span className="ax-cell-sub">{p.userId?.email || ""}</span>
        </span>
      ),
      csv: (p) => p.userId?.name || "",
    },
    { key: "citizenEmail", header: "Citizen email", csv: (p) => p.userId?.email || "", hideInTable: true },
    { key: "advocate", header: "Advocate", sortValue: (p) => p.lawyerId?.name || "", render: (p) => p.lawyerId?.name || "—", csv: (p) => p.lawyerId?.name || "" },
    {
      key: "matter",
      header: "Matter",
      sortValue: (p) => p.title || "",
      render: (p) => (
        <span>
          <span className="ax-cell-title" style={{ fontWeight: 500 }}>{p.title || "Legal representation"}</span>
          <span className="ax-cell-sub">{PACKAGE_LABEL[p.packageType] || p.packageType} package</span>
        </span>
      ),
      csv: (p) => p.title || "",
    },
    { key: "package", header: "Package", csv: (p) => PACKAGE_LABEL[p.packageType] || p.packageType, hideInTable: true },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (p) => Number(p.amount || 0),
      render: (p) => <strong style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{money(p.amount)}</strong>,
      csv: (p) => p.amount,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (p) => STATUS[p.paymentStatus]?.text || p.paymentStatus,
      render: (p) => {
        const s = STATUS[p.paymentStatus] || { text: p.paymentStatus, tone: "" };
        return <span className={`ax-pill ${s.tone}`}>{s.text}</span>;
      },
      csv: (p) => STATUS[p.paymentStatus]?.text || p.paymentStatus,
    },
    { key: "method", header: "Method", render: (p) => METHOD[p.paymentMethod] || p.paymentMethod || "—", csv: (p) => METHOD[p.paymentMethod] || p.paymentMethod },
    { key: "transactionId", header: "Transaction", csv: (p) => p.stripePaymentIntentId || p.transactionId || "", hideInTable: true },
  ];

  return (
    <AdminLayout breadcrumb="Payments" activeNav="payments">
      <div className="ax-head">
        <div>
          <h1>Payments</h1>
          <p>What citizens have paid advocates through LegalLink.</p>
        </div>
        <div className="ax-head-actions">
          {mode && (
            <span className={`ax-mode${mode === "live" ? " is-live" : ""}`} title={mode === "demo" ? "STRIPE_SECRET_KEY is not set on the server" : ""}>
              <i /> {mode === "live" ? "Stripe live" : mode === "test" ? "Stripe test mode" : "Demo payments"}
            </span>
          )}
          <button type="button" className="ax-btn" onClick={load} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="ax-msg is-bad">{error}</div>}

      <section className="ax-panel ax-kpis is-4" aria-label="Payment figures">
        <div className="ax-kpi is-static">
          <span className="ax-kpi-label">Total received</span>
          <span className="ax-kpi-value">{loading ? <span className="sk" style={{ width: 90, height: 26 }} /> : money(figures.total)}</span>
          <span className="ax-kpi-delta">{figures.count} payment{figures.count === 1 ? "" : "s"}</span>
        </div>
        <div className="ax-kpi is-static">
          <span className="ax-kpi-label">This month</span>
          <span className="ax-kpi-value">{loading ? <span className="sk" style={{ width: 90, height: 26 }} /> : money(figures.month)}</span>
          <span className="ax-kpi-delta">{figures.monthCount} payment{figures.monthCount === 1 ? "" : "s"}</span>
        </div>
        <div className="ax-kpi is-static">
          <span className="ax-kpi-label">Average payment</span>
          <span className="ax-kpi-value">{loading ? <span className="sk" style={{ width: 90, height: 26 }} /> : money(figures.average)}</span>
          <span className="ax-kpi-delta">{figures.refunded ? `${money(figures.refunded)} refunded` : "No refunds"}</span>
        </div>
        <div className="ax-kpi is-static">
          <span className="ax-kpi-label">Waiting for payment</span>
          <span className="ax-kpi-value">{loading ? <span className="sk" style={{ width: 40, height: 26 }} /> : figures.pending}</span>
          <span className={`ax-kpi-delta${figures.pending ? " is-warn" : ""}`}>Started checkout, not paid yet</span>
        </div>
      </section>

      <DataTable
        rows={rows}
        columns={columns}
        loading={loading}
        tabs={tabs}
        searchKeys={["title", "transactionId", "stripePaymentIntentId", (p) => p.userId?.name, (p) => p.userId?.email, (p) => p.lawyerId?.name]}
        searchPlaceholder="Citizen, advocate, matter, transaction…"
        onRowClick={(p) => setOpenId(p._id)}
        exportName="payments"
        emptyText={rows.length ? "No payments in this list." : "No payments yet. They appear here when citizens pay for an accepted inquiry."}
        defaultSort={{ key: "when", dir: "desc" }}
      />

      <SidePanel
        open={Boolean(open)}
        onClose={closePanel}
        title={open ? money(open.amount) : ""}
        subtitle={open && `${PACKAGE_LABEL[open.packageType] || open.packageType} package · ${fmtTime(whenOf(open))}`}
        footer={
          open && (
            <>
              {open.receiptUrl && (
                <a className="ax-btn" href={open.receiptUrl} target="_blank" rel="noopener noreferrer">
                  <Receipt size={15} /> Stripe receipt
                </a>
              )}
              <span className="ax-spacer" />
              {open.caseId && (
                <button type="button" className="ax-btn is-primary" onClick={() => navigate(`/case/${open.caseId}`)}>
                  <ExternalLink size={15} /> Open case file
                </button>
              )}
            </>
          )
        }
      >
        {open && (
          <>
            {(() => {
              const s = STATUS[open.paymentStatus] || { text: open.paymentStatus, tone: "" };
              return <span className={`ax-pill ${s.tone}`}>{s.text}</span>;
            })()}

            <h3 className="ax-section-title" style={{ marginTop: 18 }}>Payment</h3>
            <dl className="ax-dl">
              <dt>Amount</dt>
              <dd>{money(open.amount)}</dd>
              <dt>Method</dt>
              <dd>{METHOD[open.paymentMethod] || open.paymentMethod || "—"}</dd>
              <dt>Paid on</dt>
              <dd>{open.paidAt ? fmtTime(open.paidAt) : "Not paid"}</dd>
              <dt>Inquiry sent</dt>
              <dd>{fmtTime(open.createdAt)}</dd>
            </dl>

            <h3 className="ax-section-title">People</h3>
            <dl className="ax-dl">
              <dt>Paid by</dt>
              <dd>{open.userId?.name || "—"}{open.userId?.email ? ` · ${open.userId.email}` : ""}</dd>
              <dt>Advocate</dt>
              <dd>{open.lawyerId?.name || "—"}{open.lawyerId?.email ? ` · ${open.lawyerId.email}` : ""}</dd>
            </dl>

            <h3 className="ax-section-title">Matter</h3>
            <dl className="ax-dl">
              <dt>Title</dt>
              <dd>{open.title || "Legal representation"}</dd>
              <dt>Practice area</dt>
              <dd>{open.category || "—"}</dd>
              <dt>Case</dt>
              <dd>{open.caseId ? ref(open.caseId) : "Not opened yet"}</dd>
            </dl>

            {(open.stripePaymentIntentId || open.stripeSessionId || open.transactionId) && (
              <>
                <h3 className="ax-section-title">For Stripe support</h3>
                <dl className="ax-dl">
                  {open.stripePaymentIntentId && (
                    <>
                      <dt>Payment ID</dt>
                      <dd className="ax-mono" style={{ wordBreak: "break-all" }}>{open.stripePaymentIntentId}</dd>
                    </>
                  )}
                  {open.stripeSessionId && (
                    <>
                      <dt>Checkout ID</dt>
                      <dd className="ax-mono" style={{ wordBreak: "break-all" }}>{open.stripeSessionId}</dd>
                    </>
                  )}
                  {!open.stripePaymentIntentId && open.transactionId && (
                    <>
                      <dt>Transaction</dt>
                      <dd className="ax-mono">{open.transactionId}</dd>
                    </>
                  )}
                </dl>
                <p className="ax-hint" style={{ margin: 0 }}>Refunds are made in the Stripe dashboard. With the Stripe webhook set up, this payment then changes to Refunded on its own.</p>
              </>
            )}
          </>
        )}
      </SidePanel>
    </AdminLayout>
  );
};

export default Payments;
