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
        const { BROWSER_HEADLESS_MODE, LANDFX_USERNAME, LANDFX_PASSWORD, LANDFX_URL_LOGIN, LANDFX_URL_CRAWL,LANDFX_LIMIT_FIRST_DATE,LANDFX_URL_CRAWL_TYPE} = process.env
        
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

       
        
          const isGetData =  _getData(page,LANDFX_URL_CRAWL, fromDate, toDate)
        const isGetType = _getDataAccountType(context,LANDFX_URL_CRAWL_TYPE)
        const [dataTrading,dataClient] = await Promise.all([isGetData,isGetType])
     
      console.log('dataTrading', dataTrading);
      console.log('dataClient', dataClient);
        let dataResult
        for(const item of dataClient){
          dataResult = dataTrading.filter((data)=>{
           if(data[0]===item[0]){
             return data.push(item[1],item[2])
           }
         })
        
        }
        console.log(dataResult);
       
    }catch(error){
        console.log(error);
    }
}

const _login = async(page, urlLogin, username, password)=>{
    try {
        await page.goto(urlLogin)
        await page.waitForLoadState('domcontentloaded')
    
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
await page.waitForLoadState('domcontentloaded')
  // await page.waitForSelector('#view_client_status_container');

  const servers = await page.$$('#server option');
  const listItem = [];

for (let i = 0; i < servers.length; i++) {
  const server = servers[i];
  const serverValue = await server.evaluate((el) => el.value);

  if (serverValue === "0" && i === 0) {
    continue;
  }
  await page.waitForTimeout(3000)
  await page.selectOption('#server', serverValue);
  await page.waitForLoadState('load');
  await page.waitForTimeout(3000)

  const accountElements = await page.$$('#account_no option');
  for (const accountElement of accountElements) {
    let flag = true
    const accountValue = await accountElement.evaluate((el) => el.value);
     if(accountValue){
   
      await page.selectOption('#account_no', accountValue);
       
     }
       await page.waitForTimeout(1000);
       await page.fill('#start_date', fromDate);
       await page.fill('#end_date', toDate);
       await page.waitForTimeout(2000);
   
       
       const searchButton = await page.$('#filter_btn')
       await searchButton.click();

       await page.waitForFunction(() => {
        const processingDiv = document.querySelector('#datatables_processing');
        return window.getComputedStyle(processingDiv).display === 'none';
      });

       await page.selectOption('select[name="datatables_length"]', '100');
       await page.waitForTimeout(3000)
    
       while (flag) {
        const elements = await page.$$('#datatables tbody tr');
        for (const item of elements) {
          const listTxt = [];
          const transactionObj = {
            platform: metaTradePlatform.MT4
          };
          if (serverValue === '4') {
            
            transactionObj.platform = metaTradePlatform.MT5;
          
          }

          const tds = await item.$$('td');
          for (let i = 0; i < tds.length; i++) {
            if([0,2,3,4,5,6,7,8,9].includes(i)){  
              const tdText = await tds[i].textContent();
              listTxt.push(tdText);
            }
          
          }
            listItem.push(listTxt);
         
         
        }
        const nextButton = await page.$('#datatables_next');
        const isNextButton = await nextButton.evaluate((btn) => !btn.classList.contains('disabled'));
       
        if (!nextButton || !isNextButton) {
          flag = false;
      
        }else{
          await nextButton.click();
          await page.waitForFunction(() => {
            const processingDiv = document.querySelector('#datatables_processing');
            return window.getComputedStyle(processingDiv).display === 'none';
          });
        }

      }
     
    }
    
}

return listItem

}

const _getDataAccountType = async (context,LANDFX_URL_CRAWL_TYPE)=>{
 const page = await context.newPage()
  await page.goto(LANDFX_URL_CRAWL_TYPE)
  await page.waitForSelector('#view_client_status_container');

  await page.selectOption('select[name="datatables_length"]', '100');
  await page.waitForFunction(() => {
    const processingDiv = document.querySelector('#datatables_processing');
    return window.getComputedStyle(processingDiv).display === 'none';
  });
  await page.waitForTimeout(3000)
  const listItem =[]
let flag = true
  while(flag){
   
    const elements = await page.$$('#datatables tbody tr')
    for(const item of elements){
      const listTxt =[]
      const tds = await item.$$('td')
      for(let i = 0;i<tds.length;i++){
        if([0,4,5].includes(i)){
          const tdText =await tds[i].textContent()
       
          listTxt.push(tdText)
        }
       
      }
      listItem.push(listTxt)

    }
      
   
    const isNextButton = await page.$eval('#datatables_next', button => !button.classList.contains('disabled'));
    if (!isNextButton) {
      flag = false 
    }
    await page.click('#datatables_next',{ force: true });
    await page.waitForFunction(() => {
      const processingDiv = document.querySelector('#datatables_processing');
      return window.getComputedStyle(processingDiv).display === 'none';
    });
    }
  
    return listItem
}
module.exports ={
    crawlLandFx
}
