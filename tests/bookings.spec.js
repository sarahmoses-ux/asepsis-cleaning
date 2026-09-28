import {test,expect} from '@playwright/test';

async function openForm(page) {
  await page.goto('/#/quote');
  await page.getByLabel('Name',{exact:true}).fill('Test Customer');
  await page.getByLabel('Phone',{exact:true}).fill('4055550123');
  await page.getByLabel('Email',{exact:true}).fill('test@example.com');
  await page.getByLabel('Property address or city').fill('Edmond');
}

test('configured online form sends data to server and shows a request receipt',async({page})=>{
  let submitted;
  await page.route('**/api/bookings',async route=>{
    if(route.request().method()==='GET') return route.fulfill({json:{enabled:true}});
    submitted=route.request().postDataJSON();
    return route.fulfill({status:202,json:{id:submitted.id,status:'requested'}});
  });
  await openForm(page);
  await page.getByRole('button',{name:'Send booking request'}).click();
  await expect(page.locator('.booking-receipt')).toContainText('Your request has been received.');
  await expect(page.locator('.booking-receipt')).toContainText('not reserved yet');
  expect(submitted.customer.email).toBe('test@example.com');
  expect(submitted.details.bedrooms).toBe(3);
  expect(submitted).not.toHaveProperty('to');
  await expect(page.getByRole('button',{name:'Send booking request'})).toBeDisabled();
});

test('failed request keeps details and retries with the same id',async({page})=>{
  const ids=[];
  await page.route('**/api/bookings',async route=>{
    if(route.request().method()==='GET') return route.fulfill({json:{enabled:true}});
    const body=route.request().postDataJSON();ids.push(body.id);
    if(ids.length===1) return route.fulfill({status:503,json:{error:'Please retry your request.'}});
    return route.fulfill({status:202,json:{id:body.id,status:'requested'}});
  });
  await openForm(page);
  await page.getByRole('button',{name:'Send booking request'}).click();
  await expect(page.getByRole('alert')).toContainText('Please retry');
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Test Customer');
  await page.getByRole('button',{name:'Send booking request'}).click();
  await expect(page.locator('.booking-receipt')).toBeVisible();
  expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
});

test('unconfigured services retain the existing email fallback',async({page})=>{
  await page.route('**/api/bookings',route=>route.fulfill({json:{enabled:false}}));
  await openForm(page);
  await page.getByRole('button',{name:'Prepare my quote request'}).click();
  await expect(page.getByRole('link',{name:'Open email to send'})).toHaveAttribute('href',/^mailto:asepsiscleaningservices@gmail.com/);
  await expect(page.locator('.booking-receipt')).toHaveCount(0);
});
