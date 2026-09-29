import { isEnabled } from './bookings.js';
import { createStore } from './store.js';
import { createProviders, dispatchNotifications } from './notifications.js';

// Render's Node service does not run Vercel cron jobs. Recover queued alerts while it is running.
export function startNotificationWorker({env=process.env,storeFactory=createStore,providerFactory=createProviders,dispatch=dispatchNotifications,interval=60000}={}) {
  let running=false;
  async function tick() {
    if(running || !isEnabled(env)) return;
    running=true;
    try {
      const deadline=Date.now()+45000,store=storeFactory(env),providers=providerFactory(env);
      for(const id of await store.pending(2)) {
        if(Date.now()+22000>deadline) break;
        await dispatch(id,store,providers,{deadline});
      }
    } catch { console.error('Notification recovery needs attention'); }
    finally { running=false; }
  }
  const timer=setInterval(tick,interval);
  timer.unref();
  return {tick,stop:()=>clearInterval(timer)};
}
