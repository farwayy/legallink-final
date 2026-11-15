import { useEffect, useState } from "react";
import api from "./api";

/**
 * Private documents (CNIC, Bar Council, NGO registration, case evidence).
 * The server checks who is asking and returns a link that works for 5 minutes.
 */
// Files LegalLink stored (local uploads or Cloudinary). Other https links
// that someone typed in are opened as they are.
export const isStoredFile = (src) =>
  /^\/?uploads\//i.test(String(src || "")) ||
  /^https?:\/\/[^/]+\/(uploads|api\/documents)\//i.test(String(src || "")) ||
  /^https:\/\/res\.cloudinary\.com\//i.test(String(src || ""));

export const getFileLink = async (src) => {
  const res = await api.get("/files/link", { params: { src } });
  return res.data.url;
};

// Open a document in a new tab (the tab opens straight away so browsers don't block it)
export const openFile = async (src, onError) => {
  if (!isStoredFile(src)) {
    if (/^https?:\/\//i.test(String(src || ""))) window.open(src, "_blank", "noopener,noreferrer");
    return;
  }
  const tab = window.open("", "_blank");
  try {
    const url = await getFileLink(src);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (err) {
    if (tab) tab.close();
    const msg = err.response?.data?.message || "Could not open the document. Please try again.";
    if (onError) onError(msg);
  }
};

/**
 * For showing a document inside the page (image or PDF preview).
 * Returns { url, error, loading }. Refreshes the link before it expires.
 */
export const useFileLink = (src) => {
  const [state, setState] = useState({ url: "", error: "", loading: Boolean(src) });
  useEffect(() => {
    if (!src) {
      setState({ url: "", error: "", loading: false });
      return undefined;
    }
    let alive = true;
    let timer;
    const load = async () => {
      try {
        const url = await getFileLink(src);
        if (!alive) return;
        setState({ url, error: "", loading: false });
        timer = setTimeout(load, 4 * 60 * 1000);
      } catch (err) {
        if (alive) setState({ url: "", error: err.response?.data?.message || "Could not load the document.", loading: false });
      }
    };
    setState({ url: "", error: "", loading: true });
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [src]);
  return state;
};
