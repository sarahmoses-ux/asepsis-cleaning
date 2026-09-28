import { timingSafeEqual } from 'node:crypto';
import { isEnabled } from '../backend/bookings.js';
import { createStore } from '../backend/store.js';
import { createProviders, dispatchNotifications } from '../backend/notifications.js';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') { res.setHeader('Allow','GET'); return res.status(405).end(); }
  const expected=Buffer.from(`Bearer ${process.env.CRON_SECRET||''}`);
  const received=Buffer.from(String(req.headers.authorization||''));
  if(!process.env.CRON_SECRET || received.length!==expected.length || !timingSafeEqual(received,expected)) return res.status(401).json({error:'Unauthorized'});
  if(!isEnabled(process.env)) return res.status(503).json({error:'Notifications are not configured'});
  try {
    const deadline=Date.now()+45000;
    const store=createStore(process.env), providers=createProviders(process.env);
    // Bound the work to fit Vercel's function duration. Pending items stay in the queue.
    const ids=await store.pending(2);
    let processed=0;
    for(const id of ids) {
      if(Date.now()+22000>deadline) break;
      await dispatchNotifications(id,store,providers,{deadline});
      processed++;
    }
    return res.status(200).json({processed});
  } catch { console.error('Notification retry needs attention'); return res.status(503).json({error:'Retry service unavailable'}); }
}
