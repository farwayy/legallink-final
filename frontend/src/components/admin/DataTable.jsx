import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { downloadCSV } from "./csv";

/**
 * DataTable — the one table used across the admin console.
 *
 * columns: [{ key, header, render(row), sortValue(row), csv(row), width, align, hideInTable }]
 *   hideInTable: the column is only included in the CSV export
 * tabs:    optional [{ key, label, count, filter(row) }] shown as a segmented control
 * bulkActions(selectedRows, clear) → React nodes shown when rows are selected
 * onRowClick(row) opens the side panel
 */
const PAGE_SIZES = [10, 25, 50];

const DataTable = ({
  rows = [],
  columns = [],
  loading = false,
  tabs = null,
  initialTab,
  searchKeys = [],
  searchPlaceholder = "Search…",
  onRowClick,
  bulkActions,
  exportName = "export",
  emptyText = "Nothing to show.",
  toolbarExtra = null,
  defaultSort = null, // { key, dir: "asc" | "desc" }
  rowKey = (r) => r._id,
}) => {
  const [tab, setTab] = useState(initialTab || (tabs ? tabs[0].key : null));
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const tabbed = useMemo(() => {
    if (!tabs) return rows;
    const t = tabs.find((x) => x.key === tab) || tabs[0];
    return t.filter ? rows.filter(t.filter) : rows;
  }, [rows, tabs, tab]);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return tabbed;
    return tabbed.filter((r) =>
      searchKeys.some((k) => {
        const v = typeof k === "function" ? k(r) : r[k];
        return String(Array.isArray(v) ? v.join(" ") : v ?? "").toLowerCase().includes(s);
      })
    );
  }, [tabbed, q, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort) return searched;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return searched;
    const val = col.sortValue || ((r) => r[col.key]);
    const out = [...searched].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === "number" && typeof y === "number") return x - y;
      return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });
    });
    return sort.dir === "desc" ? out.reverse() : out;
  }, [searched, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [tab, q, pageSize]);

  const toggleSort = (key) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  const allOnPage = visible.length > 0 && visible.every((r) => selected.has(rowKey(r)));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allOnPage) visible.forEach((r) => n.delete(rowKey(r)));
      else visible.forEach((r) => n.add(rowKey(r)));
      return n;
    });
  const toggleOne = (r) =>
    setSelected((s) => {
      const n = new Set(s);
      const k = rowKey(r);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const selectedRows = sorted.filter((r) => selected.has(rowKey(r)));
  const clearSelection = () => setSelected(new Set());

  const exportRows = () => {
    const src = selectedRows.length ? selectedRows : sorted;
    const cols = columns.filter((c) => c.csv !== false);
    downloadCSV(
      `${exportName}-${new Date().toISOString().slice(0, 10)}.csv`,
      cols.map((c) => c.header),
      src.map((r) => cols.map((c) => (c.csv ? c.csv(r) : c.sortValue ? c.sortValue(r) : r[c.key]) ?? ""))
    );
  };

  const hasBulk = typeof bulkActions === "function";
  const shown = columns.filter((c) => !c.hideInTable);

  return (
    <div className="ax-panel">
      <div className="ax-toolbar">
        {tabs && (
          <div className="ax-seg" role="tablist">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "is-on" : ""} onClick={() => setTab(t.key)}>
                {t.label}
                {t.count != null && <em>{t.count}</em>}
              </button>
            ))}
          </div>
        )}
        {toolbarExtra}
        <div className="ax-filter">
          <Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label="Filter this list" />
        </div>
        <button type="button" className="ax-btn is-sm" onClick={exportRows} title={selectedRows.length ? "Export the selected rows" : "Export all rows in this view"}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {hasBulk && selectedRows.length > 0 && (
        <div className="ax-bulk">
          <strong>{selectedRows.length} selected</strong>
          {bulkActions(selectedRows, clearSelection)}
          <button type="button" className="ax-btn is-sm is-ghost" onClick={clearSelection}>Clear</button>
        </div>
      )}

      <div className="ax-table-wrap">
        <table className="ax-table">
          <thead>
            <tr>
              {hasBulk && (
                <th className="ax-check">
                  <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all on this page" />
                </th>
              )}
              {shown.map((c) => (
                <th key={c.key} style={{ width: c.width, textAlign: c.align || "left" }}>
                  {c.sortable === false ? (
                    c.header
                  ) : (
                    <button type="button" className={`ax-th-sort${sort?.key === c.key ? " is-on" : ""}`} onClick={() => toggleSort(c.key)}>
                      {c.header}
                      {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="ax-skel-row">
                  <td colSpan={shown.length + (hasBulk ? 1 : 0)}>
                    <span className="sk sk-line" style={{ width: `${70 - i * 8}%` }} />
                  </td>
                </tr>
              ))
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={shown.length + (hasBulk ? 1 : 0)} style={{ cursor: "default" }}>
                  <div className="ax-empty">{q ? `Nothing matches “${q}”.` : emptyText}</div>
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={rowKey(r)} className={selected.has(rowKey(r)) ? "is-selected" : ""} onClick={() => onRowClick && onRowClick(r)}>
                  {hasBulk && (
                    <td className="ax-check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(rowKey(r))} onChange={() => toggleOne(r)} aria-label="Select row" />
                    </td>
                  )}
                  {shown.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align || "left" }}>
                      {c.render ? c.render(r) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="ax-pager">
        <span>
          {sorted.length === 0
            ? "0 results"
            : `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, sorted.length)} of ${sorted.length}`}
        </span>
        <div className="ax-pager-btns">
          <select className="ax-select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Rows per page">
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
          <button type="button" className="ax-btn is-sm" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
            <ChevronLeft size={14} />
          </button>
          <span>Page {current} of {pages}</span>
          <button type="button" className="ax-btn is-sm" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="Next page">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
