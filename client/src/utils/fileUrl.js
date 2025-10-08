export const apiBase =
  (import.meta.env.VITE_API_URL ?? 'http://localhost:5000').replace(/\/$/, '');

export function fileUrl(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;   // already absolute (e.g., Cloudinary)
  return `${apiBase}${u.startsWith('/') ? '' : '/'}${u}`;
}
