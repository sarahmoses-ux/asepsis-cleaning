import {test,expect} from '@playwright/test';
import {estimate} from '../../shared/pricing.js';
async function openForm(page,project=false) {
 await page.goto('/#/quote'+(project?'?type=project':''));
 await page.getByLabel('Name',{exact:true}).fill('Test Customer');
 await page.getByLabel('Phone',{exact:true}).fill('4055550123');
 await page.getByLabel('Email',{exact:true}).fill('test@example.com');
 await page.getByLabel('Property address or city').fill('Edmond');
}
function receipt(body,paymentAvailable=false){return {id:body.id,status:'requested',booking:{...body,pricing:body.type==='home'?estimate(body.details):null},accessToken:'test-token',paymentAvailable};}
const submit=page=>page.getByRole('button',{name:'Continue to review & payment'}).click();
test('saved request redirects to review, shows first-visit price, survives reload and fits mobile',async({page})=>{
 let submitted;
 await page.route('**/api/bookings',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{enabled:true}});
  submitted=route.request().postDataJSON();return route.fulfill({status:202,json:receipt(submitted)});
 });
 await openForm(page);await submit(page);
 await expect(page).toHaveURL(/#\/booking-review$/);
 await expect(page.locator('.booking-receipt')).toContainText('Your request has been saved');
 await expect(page.locator('.review-total')).toContainText('$305.00');
 await expect(page.locator('.payment-card')).toContainText('$160.00');
 await expect(page.locator('.payment-card')).toContainText('No payment has been taken');
 expect(submitted.customer.email).toBe('test@example.com');
 await page.reload();await expect(page.locator('.review-details')).toContainText('Test Customer');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/booking-review-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'test-results/booking-review-desktop.png',fullPage:true});
});
test('failed request stays on site and retries with the same reference',async({page})=>{
 const ids=[];
 await page.route('**/api/bookings',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{enabled:true}});
  const body=route.request().postDataJSON();ids.push(body.id);
  return ids.length===1?route.fulfill({status:503,json:{error:'Please retry your request.'}}):route.fulfill({status:202,json:receipt(body)});
 });
 await openForm(page);await submit(page);
 await expect(page.getByRole('alert')).toContainText('Please retry');
 await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Test Customer');
 await submit(page);await expect(page.locator('.booking-receipt')).toBeVisible();
 expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
});
test('unconfigured backend shows an error without generating email drafts or claiming receipt',async({page})=>{
 await page.route('**/api/bookings',route=>route.request().method()==='GET'?route.fulfill({json:{enabled:false}}):route.fulfill({status:503,json:{error:'Online booking is temporarily unavailable.'}}));
 await openForm(page);await submit(page);
 await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
 await expect(page.locator('.email-draft')).toHaveCount(0);
 await expect(page.locator('.quote-layout a[href^="mailto:"]')).toHaveCount(0);
 await expect(page.locator('.booking-receipt')).toHaveCount(0);
});
test('commercial bookings go to review without a payment charge',async({page})=>{
 await page.route('**/api/bookings',route=>route.request().method()==='GET'?route.fulfill({json:{enabled:true}}):route.fulfill({status:202,json:receipt(route.request().postDataJSON(),true)}));
 await openForm(page,true);await submit(page);
 await expect(page.getByRole('heading',{name:'Quote comes first'})).toBeVisible();
 await expect(page.locator('.payment-card')).toContainText('No payment is due now');
 await expect(page.getByRole('button',{name:/^Pay /})).toHaveCount(0);
});
test('payment errors retain the saved booking and retry verifies payment server-side',async({page})=>{
 await page.route('**/api/bookings',route=>route.request().method()==='GET'?route.fulfill({json:{enabled:true}}):route.fulfill({status:202,json:receipt(route.request().postDataJSON(),true)}));
 let attempts=0;
 await page.route('**/api/checkout**',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{status:'unpaid'}});
  expect(route.request().headers().authorization).toBe('Bearer test-token');
  expect(route.request().postDataJSON()).not.toHaveProperty('amount');
  return ++attempts===1?route.fulfill({status:503,json:{error:'Payment unavailable. Your booking is saved.'}}):route.fulfill({json:{status:'paid',amount:30500,currency:'usd'}});
 });
 await openForm(page);await submit(page);
 await page.getByRole('button',{name:'Pay $305.00',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Your booking is saved');
 await page.getByRole('button',{name:'Pay $305.00',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Payment received'})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Pay /})).toHaveCount(0);
});
test('direct review link does not invent a booking',async({page})=>{
 await page.goto('/#/booking-review');
 await expect(page.getByRole('heading',{name:'Start with your space.'})).toBeVisible();
 await expect(page.locator('.booking-receipt')).toHaveCount(0);
});
