import { API_ORIGIN } from "../config";

export const getPhotoUrl = (photoPath) => {
  if (!photoPath) return null;
  if (photoPath.startsWith('http')) return photoPath;
  if (photoPath.startsWith('/uploads')) return `${API_ORIGIN}${photoPath}`;
  return `${API_ORIGIN}/uploads/${photoPath}`;
};