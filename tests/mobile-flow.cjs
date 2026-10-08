const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,headless:true}:{channel:'msedge', headless:true});
  const page = await browser.newPage({viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true});
  const requests=[], errors=[]; let bound=false, failBinding=0;
  page.on('pageerror', e=>errors.push(e.message));
  // All API traffic is intercepted: never send an account or OTP to production.
  await page.route('https://api.gamma-tech.ir/**', async route => {
    const req=route.request(), url=new URL(req.url()), body=req.postDataJSON();
    requests.push({path:url.pathname,method:req.method(),body});
    let status=200, data={};
    if(url.pathname.endsWith('/otp/request/')) { status=body.flow==='login'?200:201; data=body.flow==='login'?{registration_required:true}:{detail:'OTP sent successfully.'}; }
    else if(url.pathname.endsWith('/otp/verify/')) { assert.equal(body.code,'00123'); data={access:'isolated-browser-test',refresh:'isolated-refresh'}; }
    else if(url.pathname.endsWith('/otp/me/')) data={first_name:'تست',last_name:'کاربر',mobile:'09111111111',birth_date:'2000-03-20',preferred_product:'LUMINEN'};
    else if(url.pathname.endsWith('/vehicles/')) data=[];
    else if(url.pathname.endsWith('/devices/activate/')) {
      assert.deepEqual(body,{device_code:'NG-0001'});
      if(failBinding===1) { status=404;data={detail:'Device was not found.'}; }
      else if(failBinding===2) return route.abort('internetdisconnected');
      else {status=201;bound=true;data={device:{device_code:'NG-0001'}};}
    } else if(url.pathname.endsWith('/devices/')) data=bound?[{id:'test-board',device_code:'NG-0001',product_type:'NEGAHBAN',status:'ACTIVE'}]:[];
    else if(url.pathname.endsWith('/devices/NG-0001/status/')) data={device_code:'NG-0001',online:false,last_seen:null,server_time:new Date().toISOString(),vehicle:null,latest_telemetry:null,location:null};
    else if(url.pathname.endsWith('/devices/NG-0001/telemetry/')) data=[];
    else if(url.pathname.endsWith('/notifications/')) data={unread_count:0,items:[]};
    else throw Error('Unexpected API '+url.pathname);
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto((process.env.E2E_BASE||'http://127.0.0.1:5177')+'/login');
  await page.locator('#mobile').fill('۰۹۱۱۱۱۱۱۱۱۱');
  await page.getByRole('button',{name:'دریافت کد تأیید',exact:true}).click();
  await page.waitForURL('**/register');
  assert.equal(await page.locator('#mobile').inputValue(),'09111111111');
  await page.locator('#mobile').fill('۰۹۱۱۱۱۱۱۱۱۱');
  assert.equal(await page.locator('#mobile').inputValue(),'09111111111');
  await page.locator('#firstName').fill('تست');
  await page.locator('#lastName').fill('کاربر');
  await page.locator('#birthDate').pressSequentially('1379/01/01');
  assert.equal(await page.locator('#birthDate').inputValue(),'1379/01/01');
  await page.locator('#deviceModel').selectOption('LUMINEN');
  assert.equal(await page.locator('input:not([type=checkbox])').count(),4);
  for(const id of ['mobile','birthDate']) {
    const style=await page.locator('#'+id).evaluate(el=>({align:getComputedStyle(el).textAlign,dir:getComputedStyle(el).direction,color:getComputedStyle(el).color,placeholder:getComputedStyle(el,'::placeholder').color}));
    assert.equal(style.align,'center');assert.equal(style.dir,'ltr');assert.notEqual(style.color,style.placeholder);
  }
  assert.equal(await page.locator('#firstName').getAttribute('dir'),'rtl');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  fs.mkdirSync(process.env.E2E_SHOTS||path.join(__dirname,'../../screenshots'),{recursive:true});
  const shots=process.env.E2E_SHOTS||path.join(__dirname,'../../screenshots');
  await page.screenshot({path:path.join(shots,'register-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'دریافت کد تأیید',exact:true}).click();
  await page.waitForURL('**/otp');
  const registration=requests.find(r=>r.body?.registration).body;
  assert.deepEqual(Object.keys(registration.registration).sort(),['birthDate','deviceModel','firstName','lastName']);
  assert.equal(registration.registration.birthDate,'2000-03-20');
  assert.equal(await page.locator('.otp').count(),5);
  await page.locator('.otp').first().fill('۰۰۱۲۳');
  await page.screenshot({path:path.join(shots,'otp-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'ورود به داشبورد',exact:true}).click();
  await page.waitForURL('**/home');
  await page.getByRole('button',{name:'افزودن دستگاه',exact:true}).click();
  await page.locator('#device-code').fill('ng_۰۰۰۱');
  failBinding=1;
  await page.getByRole('button',{name:'اتصال دستگاه',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(),/پیدا نشد/);
  assert.equal(await page.locator('#device-code').inputValue(),'NG-0001');
  failBinding=2;
  await page.getByRole('button',{name:'اتصال دستگاه',exact:true}).click();
  await page.getByText('ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.').waitFor();
  assert.equal(await page.locator('#device-code').inputValue(),'NG-0001');
  failBinding=0;
  await page.getByRole('button',{name:'اتصال دستگاه',exact:true}).click();
  await page.waitForURL('**/home');
  // A device bound without vehicle data gets the real dashboard, not the setup card.
  await page.getByText('وضعیت ردیاب NG-0001').waitFor();
  await page.getByText('هنوز موقعیت واقعی از دستگاه دریافت نشده است.').first().waitFor();
  await page.waitForFunction(() => { const el=document.querySelector('.content-shell'); return el && Number(getComputedStyle(el).opacity)===1; });
  await page.screenshot({path:path.join(shots,'dashboard-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  if(!process.env.E2E_SHOTS) fs.writeFileSync(path.join(__dirname,'../../browser-test-results.json'),JSON.stringify({passed:true,viewport:'390x844',api:'intercepted test service',requests},null,2));
  console.log('PASS: mobile registration → 5-digit OTP → dashboard → missing/network errors → device binding; RTL/LTR, alignment, placeholders, typing, no vehicle payload.');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
