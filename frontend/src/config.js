/**
 * Where the LegalLink backend runs.
 *
 * On your computer this is http://localhost:5000.
 * When deployed, set REACT_APP_API_URL to the backend address, for example
 *   REACT_APP_API_URL=https://legallink-api.onrender.com
 * (in frontend/.env, or in the hosting service's environment settings).
 * Rebuild the frontend after changing it.
 */
export const API_ORIGIN = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/+$/, "").replace(/\/api$/, "");
export const API_URL = `${API_ORIGIN}/api`;