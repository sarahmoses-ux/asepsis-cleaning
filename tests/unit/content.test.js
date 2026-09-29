import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publishedPosts } from '../../src/lib/content.js';
import { contactFor } from '../../shared/site-config.js';
const posts = JSON.parse(readFileSync(new URL('../../content/blog.json', import.meta.url)));

test('scheduled content only appears after its publishing time and approval', () => {
  const queue = [
    {slug:'past', status:'approved', publishAt:'2026-09-28T09:00:00-05:00'},
    {slug:'future', status:'approved', publishAt:'2026-10-01T09:00:00-05:00'},
    {slug:'draft', status:'draft', publishAt:'2026-09-20T09:00:00-05:00'},
    {slug:'invalid', status:'approved', publishAt:'invalid'},
  ];
  assert.deepEqual(publishedPosts(queue, new Date('2026-10-01T13:59:59Z')).map(p=>p.slug), ['past']);
  assert.deepEqual(publishedPosts(queue, new Date('2026-10-01T14:00:00Z')).map(p=>p.slug), ['future','past']);
});
test('initial queue contains unique complete posts twice weekly on Monday and Thursday', () => {
  assert.equal(posts.length,8);
  assert.equal(new Set(posts.map(p=>p.slug)).size,posts.length);
  for(const post of posts) {
    assert.match(post.slug,/^[a-z0-9-]+$/);
    assert.ok(post.sections.length>=3);
    const day=new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'America/Chicago'}).format(new Date(post.publishAt));
    assert.ok(['Monday','Thursday'].includes(day));
  }
});
test('residential and commercial enquiries share the business inbox',()=>{
  assert.equal(contactFor('home').email,'asepsisedmond@gmail.com');
  assert.equal(contactFor('project').email,'asepsisedmond@gmail.com');
});
test('live source no longer contains the business street address or address map link',()=>{
  for(const file of ['../../src/App.jsx','../../src/pages/Quote.jsx','../../src/pages/CommunityPages.jsx','../../shared/site-config.js']) {
    assert.doesNotMatch(readFileSync(new URL(file,import.meta.url),'utf8'),/15305|Jasper|73013/);
  }
});
