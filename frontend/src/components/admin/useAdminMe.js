import { useCallback, useEffect, useState } from "react";
import { adminAPI } from "../../services/api";

/**
 * The signed-in admin's account, role and permissions.
 * Loaded once per page load and shared by every admin page.
 *
 *   const { me, can } = useAdminMe();
 *   can("verify")  → advocates and NGOs
 *   can("moderate") → citizens, disputes, reviews
 *   can("announce") → announcements
 *   can("team")    → admin team
 */
export const ROLE_LABELS = {
  super_admin: "Super admin",
  verifier: "Verifier",
  moderator: "Moderator",
};

export const ROLE_HELP = {
  super_admin: "Full access, including inviting and managing other admins.",
  verifier: "Reviews and approves advocate and NGO applications.",
  moderator: "Handles citizens, disputes, reviews and announcements.",
};

let cache = null;
let pending = null;
const listeners = new Set();

const fetchMe = () => {
  if (!pending) {
    pending = adminAPI
      .getMe()
      .then((res) => {
        cache = { me: res.data.admin, permissions: res.data.permissions || [], error: null };
        return cache;
      })
      .catch((e) => {
        cache = { me: null, permissions: [], error: e.response?.status || "error" };
        return cache;
      })
      .finally(() => {
        pending = null;
        listeners.forEach((fn) => fn(cache));
      });
  }
  return pending;
};

export const refreshAdminMe = () => {
  cache = null;
  return fetchMe();
};

export const clearAdminMe = () => {
  cache = null;
};

const useAdminMe = () => {
  const [state, setState] = useState(cache);

  useEffect(() => {
    listeners.add(setState);
    if (!cache) fetchMe();
    return () => listeners.delete(setState);
  }, []);

  // Until loaded, allow nothing; the server checks every action anyway.
  const can = useCallback((perm) => Boolean(state?.permissions?.includes(perm)), [state]);

  return {
    me: state?.me || null,
    permissions: state?.permissions || [],
    loaded: Boolean(state),
    error: state?.error || null,
    can,
  };
};

export default useAdminMe;
