import React, { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import '../styles/admin.css';

export default function Admin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [token, setToken] = useState('');
  const [bookings, setBookings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  function logout() { setToken(''); setBookings([]); setLoaded(false); setPassword(''); setError(''); }
  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => { logout(); setError('Your session expired. Please sign in again.'); }, 30 * 60_000);
    return () => clearTimeout(timer);
  }, [token]);
  async function request(options = {}) {
    const response = await fetch(apiUrl('/api/admin'), options);
    let data;
    try { data = await response.json(); } catch { throw new Error('Admin service is unavailable. Please try again shortly.'); }
    if (!response.ok) {
      if (response.status === 401 && options.method !== 'POST') logout();
      throw new Error(data.error || 'Unable to complete this request.');
    }
    return data;
  }
  async function load(session = token) {
    setBusy(true); setError('');
    try { const data = await request({ headers: { Authorization: `Bearer ${session}` } }); setBookings(data.bookings); setLoaded(true); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function login(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      setPassword(''); setToken(data.token); await load(data.token);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="admin-shell">
    <div className="admin-top"><a href="#/" aria-label="Asepsis Edmond home"><img src="/assets/logo.png" alt="Asepsis Edmond" /></a><span>TEAM PORTAL</span><a href="#/">Back to website &rarr;</a></div>
    {token ? <section className="admin-dashboard">
      <div className="admin-dashboard-heading"><div><div className="eyebrow">ASEPSIS EDMOND ADMIN</div><h1>Booking requests</h1><p>Your latest 100 requests, newest first. Contact customers to confirm availability.</p></div><div className="admin-controls"><button onClick={() => load()} disabled={busy}>{busy ? 'Loading...' : 'Refresh'}</button><button onClick={logout}>Sign out</button></div></div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {busy && <p role="status">Loading booking requests...</p>}
      {!busy && loaded && !bookings.length && <div className="admin-empty"><h2>A fresh start.</h2><p>New booking requests will appear here.</p></div>}
      <div className="admin-bookings">{bookings.map(booking => <article key={booking.id}>
        <div className="admin-booking-title"><h2>{booking.customer?.name || 'Customer'}</h2><span>{booking.status || 'requested'}</span></div>
        <p>{booking.type === 'home' ? 'Residential cleaning' : 'Commercial project'} &middot; {booking.createdAt ? new Date(booking.createdAt).toLocaleString() : ''}</p>
        <a href={'mailto:' + booking.customer?.email}>{booking.customer?.email}</a><a href={'tel:' + booking.customer?.phone}>{booking.customer?.phone}</a>
        <dl><dt>Property</dt><dd>{booking.customer?.property || 'Not provided'}</dd><dt>Requested date</dt><dd>{booking.customer?.date || 'Flexible'}</dd><dt>Payment</dt><dd>{booking.payment?.status || 'Not paid'}</dd><dt>Service</dt><dd>{booking.details?.service || 'Project quote'}</dd></dl>
        {booking.customer?.notes && <p className="admin-notes">{booking.customer.notes}</p>}<small>Reference: {booking.id}</small>
      </article>)}</div>
    </section> : <section className="admin-login-layout">
      <div className="admin-intro"><div className="eyebrow">A LITTLE CARE. BEHIND THE SCENES.</div><h1>A fresh start.<br/><em>Welcome back.</em></h1><p>Your space to keep the day running smoothly, one clean home at a time.</p><div className="admin-photo"><img src="/photos/kitchen.jpg" alt="A bright, freshly cleaned kitchen"/><span>Asepsis Edmond &middot; Team access</span></div></div>
      <div className="admin-card"><span className="admin-lock" aria-hidden="true">&#9906;</span><h2>Admin sign in</h2><p>Sign in with your administrator account.</p><form onSubmit={login}>
        <label htmlFor="admin-email">Email address<input id="admin-email" name="email" type="email" autoComplete="username" placeholder="you@example.com" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label htmlFor="admin-password">Password<div className="admin-password"><input id="admin-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></div></label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="button admin-submit" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'} <span aria-hidden="true">&rarr;</span></button>
      </form><div className="admin-help">Need access or a password reset?<br/>Contact your website administrator.</div><small className="admin-private">Authorized team members only.</small></div>
    </section>}
    <div className="admin-bottom">&copy; {new Date().getFullYear()} Asepsis Edmond LLC <span>A little care makes a big difference.</span></div>
  </div>;
}
