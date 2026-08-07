import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const BASE=process.env.SITE_URL||'http://localhost:4321';
test.describe('Desktop',()=>{
  test('loads+title+h1',async({page})=>{const r=await page.goto(BASE,{waitUntil:'domcontentloaded'});expect(r?.status()).toBeLessThan(400);await expect(page).toHaveTitle(/.+/);await expect(page.getByRole('heading',{level:1})).toBeVisible();});
  test('nav links real',async({page})=>{await page.goto(BASE);const l=page.getByRole('link');const n=await l.count();expect(n).toBeGreaterThan(0);for(let i=0;i<n;i++){const h=await l.nth(i).getAttribute('href');expect(h).toBeTruthy();expect(h).not.toBe('#');}});
  test('contact exists',async({page})=>{await page.goto(BASE);const r=(await page.locator('a[href^="tel:"]').count())+(await page.locator('a[href^="mailto:"]').count())+(await page.locator('form').count());expect(r).toBeGreaterThan(0);});
  test('images alt',async({page})=>{await page.goto(BASE);const im=page.locator('img');const n=await im.count();for(let i=0;i<n;i++)await expect(im.nth(i)).toHaveAttribute('alt',/.*/);});
  test('no a11y violations',async({page})=>{await page.goto(BASE);const r=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(r.violations,JSON.stringify(r.violations.map(v=>v.id))).toEqual([]);});
});
test.describe('Mobile',()=>{test.use({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});test('no sideways scroll',async({page})=>{await page.goto(BASE);await expect(page.getByRole('heading',{level:1})).toBeVisible();const o=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);expect(o).toBeLessThanOrEqual(2);});});
