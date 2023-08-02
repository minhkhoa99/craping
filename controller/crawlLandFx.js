const { chromium } = require('playwright')
const { code, message, dateFormat, flag, crawlResMessage, crawlLogMessage, brokerAbbrev,metaTradePlatform } = require('../constant')
const { createResponse, saveCrawlLog, getCrawlTime } = require('../utils')
const moment = require('moment')
const pidusage = require('pidusage');
const {createPool} = require('generic-pool')
const repository = require('../repository')

const crawlLandFx = async()=>{
    let browser
    try{
        const { BROWSER_HEADLESS_MODE, LANDFX_USERNAME, LANDFX_PASSWORD, LANDFX_URL_LOGIN, LANDFX_URL_CRAWL,LANDFX_LIMIT_FIRST_DATE} = process.env
        
        const lastCrawlTime = await getCrawlTime(brokerAbbrev.LANDFX, LANDFX_LIMIT_FIRST_DATE)
        if (!lastCrawlTime) {
          return false
        }
        const {fromDate, toDate } = lastCrawlTime
        
        const browserHeadlessMode = BROWSER_HEADLESS_MODE === 'true'
        browser = await chromium.launch({ headless: browserHeadlessMode, args: [
          '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
          '--no-first-run', '--no-zygote', '--disable-gpu',
        ] })
        const context = await browser.newContext()

        const page = await context.newPage()
    
        const isLogin = await _login(page, LANDFX_URL_LOGIN, LANDFX_USERNAME, LANDFX_PASSWORD)

       
        
          const isGetData = await _getData(page,LANDFX_URL_CRAWL, fromDate, toDate)
        
    }catch(error){
        console.log(error);
    }
}

const _login = async(page, urlLogin, username, password)=>{
    try {
        await page.goto(urlLogin)
        await page.waitForTimeout(2000)
    
        await page.fill('#mt4_id', username)
        await page.fill('#password', password)
        await page.waitForTimeout(2000)
    
        await page.click('button.btn')
       
        await page.waitForTimeout(2000)
      } catch (error) {
        console.log(error)
        return false
      }
}


const _getData = async(page, urlCrawl,fromDate , toDate)=>{
  await page.goto(urlCrawl)

  await page.waitForSelector('#view_client_status_container');

  const servers = await page.$$('#server option');

for (let i = 0; i < servers.length; i++) {
  const server = servers[i];
  const serverValue = await server.evaluate((el) => el.value);

  if (serverValue === "0" && i === 0) {
    continue;
  }

  await page.selectOption('#server', serverValue);

  await page.waitForTimeout(3000);


  const accountElements = await page.$$('#account_no option');
  
  for (const accountElement of accountElements) {
    const accountValue = await accountElement.evaluate((el) => el.value);
   if(accountValue){
    await page.waitForTimeout(2000);
    await page.selectOption('#account_no', accountValue);
   }
      
   await page.waitForTimeout(2000);

    await page.fill('#start_date', fromDate);
    await page.fill('#end_date', toDate);
    await page.waitForTimeout(2000);

    await page.selectOption('select[name="datatables_length"]', '100');

    await page.click('#filter_btn');
   

    await page.waitForTimeout(4000)
 
    while(true){
   
      const elements = await page.$$('#datatables tbody tr')
      const listItem =[]
      for(const item of elements){
        const listTxt =[]
        const transactionObj = {
          plaform: metaTradePlatform.MT5
        }
        const tds = await item.$$('td')
        for(let i = 0;i<tds.length;i++){
          const tdText =await tds[i].textContent()
          listTxt.push(tdText)
        }
        listItem.push(listTxt)

      }
      console.log('list',listItem);
      const nextButton = await page.$('#datatables_next')
      const isNextButton = await nextButton.evaluate((btn) => !btn.classList.contains('disabled'))
      console.log(isNextButton);
      if(!nextButton ||!isNextButton){
        break
      }
     await nextButton.click()
      }
  }

}

  

}
module.exports ={
    crawlLandFx
}
