import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiUrl, readResponse } from '../lib/api';
import { phone } from '../../shared/site-config';

const money = amount => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(amount);
const services = {standard:'Standard clean',deep:'Deep clean',move:'Move-in / move-out clean'};
const frequency = {weekly:'Weekly',fortnightly:'Every 2 weeks',monthly:'Every 4 weeks',once:'One-time'};
const addons = {oven:'Inside oven',fridge:'Inside refrigerator',cabinets:'Inside cabinets',pets:'Heavy pet hair',garage:'Garage sweep-out'};
const arrivals = {'9-10am':'9:00–10:00 AM','12-1pm':'12:00–1:00 PM','3-4pm':'3:00–4:00 PM'};
function Row({label,children}) { return <div className="review-row"><dt>{label}</dt><dd>{children || 'Not specified'}</dd></div>; }
function CardCheckout({checkout,onComplete}) {
  const stripe = useMemo(()=>loadStripe(checkout.publishableKey),[checkout.publishableKey]);
  const options = useMemo(()=>({clientSecret:checkout.clientSecret,onComplete}),[checkout.clientSecret,onComplete]);
  return <EmbeddedCheckoutProvider stripe={stripe} options={options}><EmbeddedCheckout /></EmbeddedCheckoutProvider>;
}
function Payment({receipt}) {
  const [checkout,setCheckout] = useState(null);
  const [status,setStatus] = useState('unpaid');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const headers = useMemo(()=>({'Content-Type':'application/json',Authorization:`Bearer ${receipt.accessToken}`}),[receipt.accessToken]);
  const checkPayment = useCallback(async(signal)=>{
    const data = await readResponse(await fetch(apiUrl(`/api/checkout?id=${encodeURIComponent(receipt.id)}`),{headers,signal,cache:'no-store'}));
    setStatus(data.status);
    return data;
  },[receipt.id,headers]);
  useEffect(()=>{
    if(!receipt.paymentAvailable || receipt.booking.type!=='home') return;
    const controller=new AbortController();
    checkPayment(controller.signal).catch(err=>{if(!controller.signal.aborted)setError(err.message);});
    return()=>controller.abort();
  },[receipt.paymentAvailable,receipt.booking.type,checkPayment]);
  const onComplete = useCallback(()=>{
    setCheckout(null);setBusy(true);setError('');
    checkPayment().then(data=>{if(data.status!=='paid')setStatus('processing');}).catch(err=>setError(err.message)).finally(()=>setBusy(false));
  },[checkPayment]);
  async function pay() {
    setBusy(true);setError('');
    try {
      const data=await readResponse(await fetch(apiUrl('/api/checkout'),{method:'POST',headers,body:JSON.stringify({id:receipt.id}),signal:AbortSignal.timeout(45000)}));
      setStatus(data.status);
      if(data.clientSecret) setCheckout(data);
    } catch(err) { setError(err.message); }
    finally {setBusy(false);}
  }
  const home=receipt.booking.type==='home';
  return <aside className="payment-card" aria-labelledby="payment-title">
    <div className="eyebrow">{home?'FIRST VISIT':'YOUR PROJECT'}</div>
    <h2 id="payment-title">{home?'Payment':'Quote comes first'}</h2>
    {home?<><div className="review-total"><span>First-visit total</span><strong>{money(receipt.booking.pricing.firstVisit)}</strong><small>USD · one payment</small></div>
      {receipt.booking.pricing.recurring&&<p className="note">Your first visit includes a Deep Clean. Later visits are estimated at {money(receipt.booking.pricing.total)} each. This payment does not start an automatic subscription.</p>}
      {status==='paid'?<div className="payment-success" role="status"><h3>Payment received</h3><p>Your first-visit payment is confirmed. Our team will contact you to confirm the appointment.</p></div>
      :!receipt.paymentAvailable?<div className="payment-notice" role="status"><h3>Your request is saved</h3><p>Online payment is not available yet. No payment has been taken. Our team will contact you about payment and availability.</p></div>
      :status==='processing'?<div role="status"><p>Your payment is being confirmed. Please check its status before trying again.</p><button className="button" disabled={busy} onClick={onComplete}>Check payment status</button></div>
      :checkout?<><p className="note">Enter your payment details below.</p><CardCheckout checkout={checkout} onComplete={onComplete}/></>
      :<><button className="button payment-button" disabled={busy || status==='expired'} onClick={pay}>{busy?'Checking payment…':`Pay ${money(receipt.booking.pricing.firstVisit)}`}</button><p className="note">Card details are handled securely by Stripe.</p>{status==='expired'&&<p>This payment session has expired. Please call our team with your booking reference.</p>}</>}
    </>:<div className="payment-notice"><p>Our team will review your project and confirm a written quote before requesting payment.</p><strong>No payment is due now.</strong></div>}
    {error&&<div role="alert" className="booking-error">{error}</div>}
    <p className="note">Need help? <a href={'tel:'+phone}>Call {phone}</a> and quote your request reference.</p>
  </aside>;
}
export default function BookingReview({receipt}) {
  if(!receipt?.booking) return <section className="section empty-review"><div className="eyebrow">BOOKING REVIEW</div><h1>Start with your space.</h1><p>Submit a booking request to review your details and payment here. If you already submitted on another device, contact our team with your reference before booking again.</p><a className="button" href="#/quote">Start a booking</a></section>;
  const {booking,id}=receipt, {customer,details,pricing}=booking;
  const home=booking.type==='home';
  return <section className="section booking-review">
    <ol className="booking-progress" aria-label="Booking progress"><li>1 · Your details <span aria-label="complete">✓</span></li><li aria-current="step">2 · Review & payment</li><li>3 · Team confirmation</li></ol>
    <div className="review-heading"><div className="eyebrow">A LITTLE CLOSER TO A FRESH START</div><h1>Review your <em>booking.</em></h1><p className="booking-receipt" role="status">Your request has been saved. Reference: <strong>{id.slice(0,8)}</strong></p><p>Your appointment is not reserved yet. Our team will confirm availability and the final scope.</p></div>
    <div className="review-grid"><article className="review-details">
      <div className="review-section"><h2>{home?'Your home cleaning':'Your project request'}</h2><dl>
        <Row label="Service">{home?services[details.service]:details.service}</Row>
        <Row label="Frequency">{frequency[details.frequency]||details.frequency}</Row>
        <Row label="Size">{details.sqft?`${Number(details.sqft).toLocaleString()} sq ft`:'Not specified'}</Row>
        {home&&<><Row label="Bedrooms">{details.bedrooms}</Row><Row label="Bathrooms">{`${details.fullBaths} full · ${details.halfBaths} half`}</Row><Row label="Add-ons">{(details.addons||[]).map(key=>addons[key]).join(', ')||'None'}</Row><Row label="Interior windows">{String(details.windows)}</Row><Row label="Laundry loads">{String(details.laundry)}</Row>{pricing.recurring&&<Row label="First visit">Deep Clean</Row>}</>}
      </dl></div>
      <div className="review-section"><h3>Where & when</h3><dl><Row label="Property">{customer.property}</Row><Row label="Preferred date">{customer.date}</Row><Row label="Arrival window">{arrivals[customer.arrival]}</Row></dl><p className="note">Arrival times are local to Oklahoma.</p></div>
      <div className="review-section"><h3>Your contact details</h3><dl><Row label="Name">{customer.name}</Row><Row label="Email">{customer.email}</Row><Row label="Phone">{customer.phone}</Row><Row label="Notes">{customer.notes||'None'}</Row></dl></div>
      <p className="note">Need to change your saved request? Call <a href={'tel:'+phone}>{phone}</a> with your reference so we can update it without creating a duplicate.</p>
    </article><Payment receipt={receipt}/></div>
  </section>;
}
