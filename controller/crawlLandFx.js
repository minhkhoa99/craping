const { firefox } = require('playwright')
const { code, message, dateFormat, flag, crawlResMessage, crawlLogMessage, brokerAbbrev } = require('../constant')
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
        browser = await firefox.launch({ headless: browserHeadlessMode, args: [
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
        await page.waitForTimeout(4000)
    
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

  const selectElement = await page.$('#account_no');

  // Get the list of options in the select element
  const optionElements = await selectElement.$$('option');

  // Loop through each option and select it one by one
  for (const optionElement of optionElements) {
    const value = await optionElement.evaluate((el) => el.value);
    await page.selectOption('#account_no', value);

    // Wait for a short time to see the change (optional)
    await page.waitForTimeout(1000);

    await page.fill('#start_date',fromDate)
    await page.fill('#end_date',toDate)

    await page.click('#filter_btn')
    await page.waitForSelector('#datatables');


  }


}
module.exports ={
    crawlLandFx
}
