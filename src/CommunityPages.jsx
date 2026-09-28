import React, { useEffect, useRef, useState } from 'react';
import posts from '../content/blog.json';
import { formatPostDate, galleryPhotos, publishedPosts, publishingSchedule, reviews } from './content';
import { contactFor, phone } from './site-config';

function PageHeading({ label, title, accent, children }) {
  return <section className="page-hero community-hero"><div className="eyebrow">{label}</div><h1>{title}<br/><em>{accent}</em></h1>{children}</section>;
}

function usePublishedPosts() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return publishedPosts(posts, now);
}

export function Blog({ slug }) {
  const available = usePublishedPosts();
  const [category, setCategory] = useState('All stories');
  const categories = ['All stories', ...new Set(available.map(post => post.category))];
  const article = available.find(post => post.slug === slug);
  if (slug && !article) return <section className="section article-page"><div className="eyebrow">THE CLEAN HOME JOURNAL</div><h1>This story isn’t available yet.</h1><p>Explore the latest published stories from our team.</p><a className="text-link" href="#/blog">← Back to the journal</a></section>;
  if (article) return <article className="article-page section">
    <a className="text-link" href="#/blog">← All stories</a>
    <div className="article-meta"><span>{article.category}</span><time dateTime={article.publishAt}>{formatPostDate(article.publishAt)}</time><span>{article.readMinutes} min read</span></div>
    <h1>{article.title}</h1><p className="article-deck">{article.excerpt}</p>
    <p className="article-byline">By {article.category === 'For businesses' ? 'Asepsis Edmond' : 'Asepsis Cleaning Services'}</p>
    <img className="article-photo" src={article.image} alt={article.imageAlt}/>
    <div className="article-copy">{article.sections.map(section => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}</div>
    <div className="article-end"><span>A little care makes a big difference.</span><a className="text-link" href={article.category === 'For businesses' ? '#/pro' : '#/residential'}>{article.category === 'For businesses' ? 'Commercial services' : 'Explore home cleaning'} ↗</a></div>
  </article>;
  const visible = available.filter(post => category === 'All stories' || post.category === category);
  return <><PageHeading label="THE CLEAN HOME JOURNAL" title="A little know-how." accent="A little more calm."><p>Thoughtful routines, helpful checklists and room for real life. From the Asepsis team in Oklahoma.</p><div className="journal-cadence">Our editorial rhythm: {publishingSchedule.days}</div></PageHeading>
    <section className="section"><div className="filter-bar" aria-label="Filter articles">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      {visible.length ? <div className="journal-grid">{visible.map(post => <article className="journal-card" key={post.slug}><a href={'#/blog/' + post.slug}><img src={post.image} alt={post.imageAlt} loading="lazy"/><div className="journal-card-copy"><div className="article-meta"><span>{post.category}</span><time dateTime={post.publishAt}>{formatPostDate(post.publishAt)}</time></div><h2>{post.title}</h2><p>{post.excerpt}</p><span className="text-link">Read the story <span aria-hidden="true">↗</span></span></div></a></article>)}</div> : <div className="content-empty"><h2>A fresh story is on its way.</h2><p>Check back for our next home-care guide.</p></div>}
    </section></>;
}

export function Gallery() {
  const [category, setCategory] = useState('All spaces');
  const [selected, setSelected] = useState(null);
  const dialogRef = useRef(null);
  const visible = galleryPhotos.filter(photo => category === 'All spaces' || photo.category === category);
  const photo = galleryPhotos.find(item => item.id === selected);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!selected || !dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selected]);
  function close() { dialogRef.current?.close(); setSelected(null); }
  function step(direction) {
    const index = visible.findIndex(item => item.id === selected);
    setSelected(visible[(index + direction + visible.length) % visible.length].id);
  }
  return <><PageHeading label="THE PHOTO GALLERY" title="Fresh spaces." accent="Everyday inspiration."><p>A little inspiration for the rooms where life happens.</p></PageHeading>
    <section className="section gallery-section"><p className="gallery-disclosure">These are illustrative interior photos, not photographs of Asepsis customer projects. Customer-approved project photos will be added here as they become available.</p>
      <div className="filter-bar" aria-label="Filter photos">{['All spaces', ...new Set(galleryPhotos.map(item => item.category))].map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="gallery-grid">{visible.map(item => <figure key={item.id}><button className="gallery-open" type="button" onClick={() => setSelected(item.id)} aria-label={'View ' + item.title}><img src={item.src} alt={item.alt} loading="lazy"/><span aria-hidden="true">View photo ↗</span></button><figcaption><span className="eyebrow">{item.category}</span><h2>{item.title}</h2><p>{item.caption}</p></figcaption></figure>)}</div>
    </section>
    <dialog ref={dialogRef} className="photo-dialog" aria-labelledby="photo-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); step(1); } if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); } }}>
      {photo && <div className="photo-dialog-inner"><button className="dialog-close" type="button" onClick={close} aria-label="Close photo" autoFocus>✕</button><img src={photo.src} alt={photo.alt}/><div className="photo-dialog-caption"><div><h2 id="photo-title">{photo.title}</h2><p>Illustrative interior photograph</p></div><div className="photo-controls"><button type="button" disabled={visible.length < 2} onClick={() => step(-1)} aria-label="Previous photo">←</button><button type="button" disabled={visible.length < 2} onClick={() => step(1)} aria-label="Next photo">→</button></div></div></div>}
    </dialog>
  </>;
}

export function Reviews() {
  const [type, setType] = useState('home');
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const contact = contactFor(type);
  function prepare(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setDraft(`Customer feedback for ${contact.name}\n\nName: ${data.Name}\nService: ${type === 'home' ? 'Residential' : 'Commercial'}\nRating: ${data.Rating}/5\nFeedback: ${data.Feedback}\nPermission to publish: ${data.Permission ? 'Yes, with first name only' : 'No, private feedback only'}`);
    setCopied(false); setCopyError(false);
  }
  return <><PageHeading label="CUSTOMER REVIEWS" title="Your home." accent="Your honest experience."><p>Good service begins with listening. Here’s a place for real experiences and thoughtful feedback.</p></PageHeading>
    <section className="section reviews-layout"><div><div className="eyebrow">FROM OUR CUSTOMERS</div><h2>Every detail matters.<br/>So does your feedback.</h2>
      {reviews.length ? <div className="review-list">{reviews.map(review => <article key={review.id}><blockquote>{review.text}</blockquote><p>{review.name} · {review.service}</p><a className="text-link" href={review.sourceUrl} target="_blank" rel="noreferrer">View original review ↗</a></article>)}</div> : <div className="content-empty"><h3>Our review collection is getting started.</h3><p>Customer-approved reviews will appear here. We only publish genuine feedback with permission.</p></div>}
      <p>Need help with a recent visit? Speak with our team directly at <a className="text-link" href={'tel:' + phone}>{phone}</a>.</p>
    </div><div className="feedback-card"><h2>How did we do?</h2><p>Share what went well and what we could improve. All honest feedback is welcome.</p>
      <form onSubmit={prepare} onChange={() => setDraft('')}><div className="form-grid"><label>Your name<input name="Name" autoComplete="given-name" required maxLength={100}/></label><label>Service<select value={type} onChange={event => setType(event.target.value)}><option value="home">Residential cleaning</option><option value="project">Commercial / project</option></select></label></div>
        <label>Your rating<select name="Rating" required defaultValue=""><option value="" disabled>Select a rating</option>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} {rating === 1 ? 'star' : 'stars'}</option>)}</select></label>
        <label>Your experience<textarea name="Feedback" rows={5} required minLength={10} maxLength={3000} placeholder="Tell us about your cleaning visit…"/></label>
        <label className="permission-check"><input type="checkbox" name="Permission"/>You may publish this feedback on the website using my first name.</label>
        <button type="submit" className="button">Prepare feedback <span aria-hidden="true">↗</span></button><p className="note">Feedback is prepared on your device. It is not sent or posted automatically. Permission to publish is optional.</p>
      </form>
      {draft && <div className="feedback-draft" role="status"><h3>Your feedback is ready.</h3>{contact.email ? <><p>Review it in your email app and send it to {contact.name}.</p><a className="text-link" href={`mailto:${contact.email}?subject=${encodeURIComponent('Customer feedback')}&body=${encodeURIComponent(draft)}`}>Open email to send ↗</a></> : <p>Please call {phone} to share your feedback with our residential team. You can also copy the text below for your records.</p>}<button className="copy-button" type="button" onClick={async () => { try { await navigator.clipboard.writeText(draft); setCopied(true); setCopyError(false); } catch { setCopyError(true); } }}>{copied ? 'Copied!' : 'Copy feedback'}</button>{copyError && <p>Copy is unavailable in this browser. Select the text below to copy it manually.</p>}<details><summary>Read feedback text</summary><pre>{draft}</pre></details></div>}
    </div></section></>;
}
