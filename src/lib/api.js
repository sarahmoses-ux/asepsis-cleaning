const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export function apiUrl(path) { return `${base}${path}`; }
export async function readResponse(response) {
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The booking service is unavailable. Please try again shortly.'); }
  if (!response.ok) throw new Error(data.error || 'We could not complete this request. Please try again.');
  return data;
}
