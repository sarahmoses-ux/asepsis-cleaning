import React, {useEffect, useRef, useState} from 'react';
import {phone} from '../../shared/site-config';
import {estimate} from '../../shared/pricing';
import '../styles/home.css';

function Mark({kind='spark',className=''}) {
  const paths={spark:<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z"/>,check:<path d="m5 12 4 4L19 6"/>,home:<><path d="m3 10 9-7 9 7v11H3V10Z"/><path d="M9 21v-8h6v8"/></>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,shield:<><path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z"/><path d="m8 11 3 3 5-5"/></>,arrow:<><path d="M5 19 19 5M5 5h14v14"/></>};
  return <svg className={'home-icon '+className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]||paths.spark}</svg>;
}
function LinkButton({children,href='#/quote',secondary=false}) {return <a className={'button home-button'+(secondary?' secondary':'')} href={href}>{children}<Mark kind="arrow"/></a>;}
function Reveal({children,className='',as:Tag='div',delay=0}) {return <Tag className={className} data-reveal style={{'--reveal-delay':`${delay}ms`}}>{children}</Tag>;}
const rooms=[
 {id:'kitchen',label:'The kitchen',title:'A fresh start for your busiest room.',text:'From the first coffee to the last dish, enjoy a kitchen that feels ready for whatever comes next.',photo:'/photos/kitchen.jpg',alt:'Airy kitchen with clean counters, white cabinetry and natural wood accents',items:['Counters and backsplash wiped','Sink and faucet cleaned','Appliance exteriors wiped','Floors vacuumed and mopped']},
 {id:'bathroom',label:'The bathroom',title:'A little everyday sanctuary.',text:'Fresh surfaces, gleaming fixtures, and the lovely feeling of a bathroom that has been properly cared for.',photo:'/photos/bathroom.jpg',alt:'Bright bathroom with a freestanding bath and clean tiled surfaces',items:['Shower and tub cleaned','Toilet cleaned and sanitized','Mirrors and fixtures polished','Floors vacuumed and mopped']},
 {id:'living',label:'Living spaces',title:'More room to simply unwind.',text:'Put your feet up. We take care of everyday dust and floors, so your favorite spaces feel like yours again.',photo:'/photos/living.jpg',alt:'Inviting neutral living room with comfortable seating and warm natural light',items:['Reachable surfaces dusted','High-touch surfaces wiped','Floors vacuumed and mopped','Waste bins emptied']},
];
function RoomPreview() {
 const [selected,setSelected]=useState(0);const room=rooms[selected];const tabs=useRef([]);
 function onKeyDown(event,index){let next;if(event.key==='ArrowRight')next=(index+1)%rooms.length;else if(event.key==='ArrowLeft')next=(index+rooms.length-1)%rooms.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=rooms.length-1;else return;event.preventDefault();setSelected(next);tabs.current[next]?.focus();}
 return <section className="home-section room-section">
  <Reveal className="home-section-heading"><div><div className="eyebrow">CARE IN EVERY CORNER</div><h2>Goodbye, to-do list.<br/><em>Hello, fresh space.</em></h2></div><p>A little attention makes a big difference.<br/>Explore what goes into a Standard Clean.</p></Reveal>
  <Reveal className="room-explorer"><div className="room-image"><img key={room.id} src={room.photo} alt={room.alt} width="900" height="750" loading="lazy" decoding="async"/><span className="room-image-label"><Mark/>{room.label}, taken care of.</span></div><div className="room-copy">
   <div className="room-tabs" role="tablist" aria-label="Explore cleaning by room">{rooms.map((item,index)=><button key={item.id} ref={node=>{tabs.current[index]=node;}} id={`room-tab-${item.id}`} role="tab" aria-selected={selected===index} aria-controls="room-panel" tabIndex={selected===index?0:-1} onClick={()=>setSelected(index)} onKeyDown={event=>onKeyDown(event,index)}>{item.label}</button>)}</div>
   <div role="tabpanel" id="room-panel" aria-labelledby={`room-tab-${room.id}`} tabIndex={0}><span className="room-number">0{selected+1} / 03</span><h3>{room.title}</h3><p>{room.text}</p><ul>{room.items.map(item=><li key={item}><Mark kind="check"/>{item}</li>)}</ul><a className="text-link" href="#/quote">Build my cleaning plan <span aria-hidden="true">↗</span></a></div>
  </div></Reveal>
 </section>;
}
export default function Home({services,Area}) {
 const root=useRef(null);const preview=estimate({});
 useEffect(()=>{
  const element=root.current,preference=window.matchMedia('(prefers-reduced-motion: reduce)');let observer;
  const configure=()=>{
   observer?.disconnect();element.classList.remove('motion-ready');
   if(preference.matches || !('IntersectionObserver' in window))return;
   const targets=element.querySelectorAll('[data-reveal]');
   // Above-the-fold content is always visible, including when scripting or observation is unavailable.
   element.classList.add('motion-ready');
   observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:0.08,rootMargin:'0px 0px 25px 0px'});
   targets.forEach(target=>observer.observe(target));
  };
  configure();preference.addEventListener('change',configure);
  return()=>{observer?.disconnect();preference.removeEventListener('change',configure);};
 },[]);
 return <div className="home-v2" ref={root}>
  <section className="home-hero">
   <div className="home-hero-copy"><span className="home-location"><span/>EDMOND · DEER CREEK · NORTH OKC</span><h1>A clean home.<br/>A little more<br/><em>room to live.</em></h1><p>Come home to the good part. Thoughtful house cleaning that gives you a fresh space and a little more time for yourself.</p><div className="home-hero-actions"><LinkButton>See my price & book</LinkButton><a className="home-explore" href="#home-services" onClick={event=>{event.preventDefault();document.getElementById('home-services')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}>Explore our cleans <span aria-hidden="true">↓</span></a></div><div className="home-assurances"><span><Mark kind="shield"/>Fully insured</span><span><Mark kind="check"/>Supplies included</span></div><div className="hero-bottom-note"><span className="little-line"/>A little care. A big difference.</div></div>
   <div className="home-hero-art"><div className="hero-photo-frame"><img src="/photos/home-hero-v2.jpg" alt="Sunlit living room with an ivory sofa, oak coffee table and an inviting kitchen beyond" width="1536" height="1024" fetchPriority="high" decoding="async"/><div className="hero-photo-caption"><span>MAKE YOURSELF AT HOME</span><span>We’ll handle the clean.</span></div></div><div className="home-care-seal" aria-hidden="true"><span>A LITTLE CARE</span><Mark/><span>EVERYWHERE</span></div><a className="home-price-note" href="#/quote"><span className="price-note-icon"><Mark kind="home"/></span><div><span>YOUR HAPPY-HOME ROUTINE</span><strong>${preview.total}<small> / recurring visit</small></strong><p>3 bedrooms · every 2 weeks<br/>First Deep Clean: ${preview.firstVisit}</p></div><Mark kind="arrow"/></a><span className="hero-side-note" aria-hidden="true">FRESH SPACES. MORE LIFE.</span></div>
  </section>
  <div className="home-value-strip"><span><Mark/>Care in every corner.</span><span><Mark kind="home"/>Locally owned</span><span><Mark kind="shield"/>Supplies & equipment included</span><span><Mark kind="clock"/>A clean that fits your routine</span></div>
  <section className="home-section home-services" id="home-services">
   <Reveal className="home-section-heading"><div><div className="eyebrow">A CLEAN FOR EVERY CHAPTER</div><h2>Your space.<br/><em>Your kind of clean.</em></h2></div><div><p>A regular reset, a deeper fresh start,<br/>or a clean slate for your next move.</p><a href="#/residential" className="text-link">Explore all prices <span aria-hidden="true">↗</span></a></div></Reveal>
   <div className="home-service-grid">{services.map((service,index)=><Reveal as="article" className="home-service-card" delay={index*90} key={service.id}><a href={`#/quote?service=${service.id}`} className="home-service-photo" aria-label={`Book a ${service.title}`}><img src={`/photos/${service.photo}.jpg`} alt={{kitchen:'Fresh kitchen with white counters and wooden details',bathroom:'Clean bathroom with a freestanding bath',living:'Bright and airy living space'}[service.photo]} width="800" height="600" loading="lazy" decoding="async"/><span className="service-index">0{index+1}</span><span className="service-photo-arrow"><Mark kind="arrow"/></span></a><div className="home-service-body"><div className="service-name-row"><h3>{service.title}</h3><span>from <strong>${service.price}</strong></span></div><p>{service.text}</p><div className="service-footer"><span>{['Your everyday reset','A little extra attention','Onto your next chapter'][index]}</span><a href={`#/quote?service=${service.id}`}>Get my price <span aria-hidden="true">↗</span></a></div></div></Reveal>)}</div>
  </section>
  <RoomPreview/>
  <section className="home-section home-story"><Reveal className="story-image"><img src="/photos/cleaning-detail-v2.jpg" alt="Illustrative close-up of a blue-gloved hand carefully wiping a kitchen counter" width="1536" height="1024" loading="lazy" decoding="async"/><span className="story-image-note"><Mark/>It’s the little things.</span></Reveal><Reveal className="story-copy" delay={100}><div className="eyebrow">THOUGHTFUL CLEANING. REAL-LIFE SIMPLE.</div><h2>We take care of the clean.<br/><em>You take back your day.</em></h2><p>Unhurried mornings. An open weekend. A space that feels good to be in. That’s what a little help around the house can make room for.</p><div className="story-benefits">{[['01','Your home, respected','Arrange access with our team. We’ll lock up and leave your space ready for you.'],['02','The essentials, included','We bring the cleaning supplies, equipment, and attention to detail.'],['03','Care you can plan around','Choose a one-time visit or a routine that fits the way you live.']].map(([number,title,text])=><div key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div><LinkButton href="#/about" secondary>Meet Asepsis</LinkButton></Reveal></section>
  <section className="home-section home-how"><Reveal className="home-how-heading"><div className="eyebrow">LESS ADMIN. MORE AH, THAT’S BETTER.</div><h2>A fresher home is<br/><em>a few steps away.</em></h2></Reveal><div className="home-how-grid">{[['01','Tell us about your space','Choose your clean, home size, and preferred date.'],['02','Review your booking','Check your details and first-visit price, all on the website.'],['03','We’ll take it from here','Our team confirms availability, then brings the supplies and care.']].map(([number,title,text],index)=><Reveal className="home-step" key={number} delay={index*100}><span>{number}</span><h3>{title}</h3><p>{text}</p></Reveal>)}</div><Reveal><LinkButton>Let’s find your clean</LinkButton></Reveal></section>
  <Reveal className="home-commercial"><div className="commercial-emblem" aria-hidden="true"><Mark kind="home"/></div><div><div className="eyebrow">BUILDERS & BUSINESSES, WE’RE HERE FOR YOU TOO</div><h2>Big projects. The same care.</h2><p>Post-construction, offices, turnovers, and more.</p></div><LinkButton href="#/pro" secondary>Explore commercial cleaning</LinkButton></Reveal>
  <Reveal><Area/></Reveal>
  <section className="home-final"><div className="home-final-image"><img src="/photos/home-hero-v2.jpg" alt="" width="1536" height="1024" loading="lazy" decoding="async"/></div><Reveal className="home-final-copy"><div className="eyebrow">YOUR HOME. A LITTLE LIGHTER.</div><h2>Let’s make room<br/>for <em>the good stuff.</em></h2><p>A fresh space is a lovely place to start.</p><LinkButton>Find my cleaning price</LinkButton><a className="home-final-call" href={'tel:'+phone}>Or call our team · {phone}</a></Reveal><Mark className="final-spark"/></section>
  <p className="home-photo-disclosure">Illustrative interiors and cleaning imagery; not photographs of customer projects.</p>
 </div>;
}
