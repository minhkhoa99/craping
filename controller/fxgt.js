const { firefox } = require('playwright')
const { code, message, dateFormat, flag, crawlResMessage, crawlLogMessage, modeAPI, brokerAbbrev, metaTradePlatform } = require('../constant')
const { createResponse, saveCrawlLog, getListDays } = require('../utils')
const moment = require('moment')



const crawlFxgt = async(req,res)=>{
    const browserHeadlessMode = process.env.BROWSER_HEADLESS_MODE === 'true'
  const browser = await firefox.launch({ headless: browserHeadlessMode })
    try{
        const context = await browser.newContext()
       
        await context.addInitScript(() => {
            delete navigator.__proto__.webdriver;
          });
        const page = await context.newPage()
        // const client = await page.context().newCDPSession(page);
        // await client.send('Network.enable');
        //login
        const urlLogin = "https://ib.fxgt.com/login"
        const username = 'broker@p2t.sg'
        const password = "FHOdsiw34"

        //getData
        const urlCrawl = "https://ib.fxgt.com/reports"
        await loginFxgt(page,urlLogin,username,password)

        await getDataFxgt(page,urlCrawl)
    }catch(error){
        console.log(error);
    }

}

const loginFxgt = async(page,urlLogin,username,password)=>{
try{
  
    await page.goto(urlLogin)
    await page.waitForTimeout(3000)

    await page.fill('#email', username)
    await page.fill('#password', password)
   
    // await setAgents(page)
    await page.waitForTimeout(3000)
    await page.click('#btn_login')
   
   await page.waitForTimeout(3000)
   

   
    
    return true
}catch(error){
    console.log(error);
    return false
}
}

const getDataFxgt = async(page,urlCrawl)=>{
    await page.waitForTimeout(3000)
    
    await page.goto('https://ib.fxgt.com/reports/commission-detail-report')
    await page.waitForTimeout(3000)

    await page.locator('.custom-radio').nth(0).click()
    await page.click('#reportFilterGo')
    await page.waitForLoadState('domcontentloaded')
   
while(true){
    const elements = await page.$$('#reportDataTable tbody tr');
    await page.waitForLoadState('domcontentloaded')

    for (const item of elements) {
    let listText = []

      const tds = await item.$$('td');
      for (let i = 0; i < tds.length; i++) {
        if( i===0 || i===1 || i===2 || i===4 || i === 7 || i===8 || i===10 || i===13){
            const tdText = await tds[i].textContent();
            listText.push(tdText)
        }
       
      
      }
      
    }
    const isNextButton = await page.$('#reportDataTable_next') !==null;
    if(!isNextButton){
        break
    }
   
 await page.click('#reportDataTable_next')

   await page.waitForLoadState('domcontentloaded')
}
   

}

const setAgents = async(page)=>{
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
       
      
    });
}


module.exports ={
    crawlFxgt
}