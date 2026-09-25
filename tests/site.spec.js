import {test,expect} from '@playwright/test';
test('pages, calculator, email draft and mobile navigation',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toContainText('A clean home.');
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});
  for(const route of ['residential','pro','about','faq']){
    await page.goto('/#/'+route);
    await expect(page.getByRole('heading',{level:1})).toBeVisible();
  }
  await page.locator('summary').filter({hasText:'Do you bring your own supplies and equipment?'}).click();
  await expect(page.getByText('Yes. All cleaning supplies and equipment are included in every price.',{exact:false})).toBeVisible();
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
  await page.getByRole('button',{name:'Prepare my quote request'}).click();
  await expect(page.getByRole('link',{name:'Open email to send'})).toHaveAttribute('href',/mailto:asepsisedmond@gmail.com/);
  await expect(page.locator('.email-draft')).toContainText('Nothing has been sent yet.');
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
