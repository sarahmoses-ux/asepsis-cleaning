const key = 'asepsis-booking-review';
export function saveReview(receipt) {
  try { sessionStorage.setItem(key, JSON.stringify({ receipt, expiresAt: Date.now() + 86400000 })); } catch { /* React state still works if storage is unavailable. */ }
}
export function loadReview() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (saved?.expiresAt > Date.now() && saved.receipt?.booking?.customer && saved.receipt?.id) return saved.receipt;
    sessionStorage.removeItem(key);
  } catch { /* Show the empty review state. */ }
  return null;
}
