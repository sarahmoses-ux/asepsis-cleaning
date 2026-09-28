import { useEffect, useRef, useState } from 'react';

export function useBookingRequest() {
  const [enabled,setEnabled]=useState(false);
  const [busy,setBusy]=useState(false);
  const [receipt,setReceipt]=useState(null);
  const [error,setError]=useState('');
  const attempt=useRef(null);
  const submitting=useRef(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/bookings',{signal:controller.signal,cache:'no-store'})
      .then(response=>response.ok ? response.json() : null)
      .then(data=>{if(!controller.signal.aborted) setEnabled(data?.enabled===true);})
      .catch(()=>{});
    return()=>controller.abort();
  },[]);
  async function submit(payload) {
    if(submitting.current) return;
    submitting.current=true;setBusy(true);setError('');
    const signature=JSON.stringify(payload);
    if(!attempt.current || attempt.current.signature!==signature) attempt.current={signature,id:crypto.randomUUID()};
    try {
      const response=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,id:attempt.current.id}),signal:AbortSignal.timeout(55000)});
      const data=await response.json();
      if(!response.ok || data.status!=='requested' || data.id!==attempt.current.id) throw new Error(data.error||'We could not confirm receipt. Please retry or call our team.');
      setReceipt(data);
    } catch(error) {
      setError(error.name==='TimeoutError' || error instanceof TypeError ? 'We could not confirm receipt. Please retry without changing the details, or call 405-549-7722. A retry will use the same request reference.' : error.message);
    } finally {submitting.current=false;setBusy(false);}
  }
  function reset(){attempt.current=null;setReceipt(null);setError('');}
  return {enabled,busy,receipt,error,submit,reset};
}
