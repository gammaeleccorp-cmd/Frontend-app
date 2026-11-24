const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });

    let requestCount = 0;
    let verifyCount = 0;

    await page.route('https://api.gamma-tech.ir/**', async route => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;

      if (pathname.endsWith('/otp/request/')) {
        requestCount++;

        assert.equal(req.postDataJSON().mobile, '09111111111');

        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'SMS_DELIVERY_UNKNOWN',
            detail: 'SMS delivery status is unknown.'
          })
        });
      }

      if (pathname.endsWith('/otp/verify/')) {
        verifyCount++;
        assert.equal(req.postDataJSON().code, '00123');

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access: 'isolated-test-access',
            refresh: 'isolated-test-refresh'
          })
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto(
      (process.env.E2E_BASE || 'http://127.0.0.1:5178') + '/login'
    );

    await page.locator('#mobile').fill('09111111111');

    await page.getByRole('button', {
      name: 'دریافت کد تأیید',
      exact: true
    }).click();

    await page.waitForURL('**/otp');

    const notice = page.getByText(
      'در صورت دریافت پیامک، کد تأیید را وارد کنید.',
      { exact: true }
    );

    await notice.waitFor({ state: 'visible' });
    assert.equal(requestCount, 1);

    console.log('PASS: Login HTTP 202');

    await page.getByRole('button', {
      name: 'ارسال مجدد کد',
      exact: true
    }).click();

    await page.waitForFunction(() =>
      !document.querySelector('button.link-btn[disabled]')
    );

    await notice.waitFor({ state: 'visible' });
    assert.equal(requestCount, 2);

    console.log('PASS: Resend HTTP 202');

    for (const [index, digit] of [...'00123'].entries()) {
      await page.locator('.otp').nth(index).fill(digit);
    }

    await page.getByRole('button', {
      name: 'ورود به داشبورد',
      exact: true
    }).click();

    await page.waitForURL('**/home');
    assert.equal(verifyCount, 1);

    console.log('PASS: OTP verification after resend');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
