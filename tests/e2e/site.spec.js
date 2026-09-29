import {test,expect} from '@playwright/test';
test('pages, calculator, online booking errors and mobile navigation',async({page})=>{
  test.setTimeout(60000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toContainText('A clean home.');
  await page.evaluate(()=>{document.querySelectorAll('img').forEach(image=>image.loading='eager');});
  await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
  await page.getByRole('tab',{name:'The bathroom'}).click();
  await expect(page.getByRole('tabpanel')).toContainText('Shower and tub cleaned');
  await page.getByRole('tab',{name:'The bathroom'}).press('ArrowRight');
  await expect(page.getByRole('tab',{name:'Living spaces'})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tabpanel')).toContainText('More room to simply unwind');
  await page.getByRole('tab',{name:'Living spaces'}).press('Home');
  await expect(page.getByRole('tab',{name:'The kitchen'})).toBeFocused();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});
  for(const route of ['residential','pro','about','faq']){
    await page.goto('/#/'+route);
    await expect(page.getByRole('heading',{level:1})).toBeVisible();
  }
  await page.locator('summary').filter({hasText:'Do you bring your own supplies and equipment?'}).click();
  await expect(page.getByText('Yes. All cleaning supplies and equipment are included in every price.',{exact:false})).toBeVisible();
  await page.route('**/api/bookings', route=>route.fulfill({status:503,json:{error:'Booking temporarily unavailable'}}));
  await page.goto('/#/quote');
  await expect(page.locator('.estimate')).toContainText('$160');
  await expect(page.locator('.estimate')).toContainText('$305');
  await page.getByLabel('Type of clean').selectOption('move');
  await expect(page.locator('.estimate')).toContainText('$380');
  await expect(page.getByLabel('Inside oven')).toHaveCount(0);
  await page.getByLabel('Name',{exact:true}).fill('Test Visitor');
  await page.getByLabel('Phone',{exact:true}).fill('4055550123');
  await page.getByLabel('Email',{exact:true}).fill('test@example.com');
  await page.getByLabel('Property address or city').fill('Edmond');
  await page.getByRole('button',{name:'Continue to review & payment'}).click();
  await expect(page.getByRole('alert')).toContainText('Booking temporarily unavailable');
  await expect(page.locator('.email-draft')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('navigation').getByText('House Cleaning').click();
  await expect(page.getByRole('heading',{level:1})).toContainText('A fresh home.');
  for(const route of ['','residential','pro','about','faq','quote']){
    await page.goto('/#/'+route);
    await expect(page.getByRole('heading',{level:1})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.goto('/');
  await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
});
