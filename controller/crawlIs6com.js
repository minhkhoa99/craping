const { firefox } = require('playwright')
const { code, message, dateFormat, flag, crawlResMessage, crawlLogMessage, brokerAbbrev } = require('../constant')
const { createResponse, saveCrawlLog, getCrawlTime } = require('../utils')
const moment = require('moment')
const pidusage = require('pidusage');
const {createPool} = require('generic-pool')
const repository = require('../repository')

const crawlIs6com = async()=>{
    let browser
    try{
        const { BROWSER_HEADLESS_MODE, IS6COM_USERNAME, IS6COM_PASSWORD, IS6COM_URL_LOGIN, IS6COM_URL_CRAWL,IS6_LIMIT_FIRST_DATE} = process.env
        
        const lastCrawlTime = await getCrawlTime(brokerAbbrev.IS6_COM, IS6_LIMIT_FIRST_DATE)
        if (!lastCrawlTime) {
          return false
        }
        const {fromDate, toDate } = lastCrawlTime
        const listYearMonth = await getYearMonth(fromDate, toDate)
        const browserHeadlessMode = BROWSER_HEADLESS_MODE === 'true'
        browser = await firefox.launch({ headless: browserHeadlessMode, args: [
          '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
          '--no-first-run', '--no-zygote', '--disable-gpu',
        ] })
        const context = await browser.newContext()

        const page = await context.newPage()
    
        const isLogin = await _login(page, IS6COM_URL_LOGIN, IS6COM_USERNAME, IS6COM_PASSWORD)

        for(const {year, month} of listYearMonth){
        
          const isGetData = await _getData(page,IS6COM_URL_CRAWL, year, month)

        }
    }catch(error){
        console.log(error);
    }
}

const _login = async(page, urlLogin, username, password)=>{
    try {
        await page.goto(urlLogin)
        await page.waitForTimeout(4000)
    
        await page.fill('#email', username)
        await page.fill('#password', password)
        await page.waitForTimeout(2000)
    
        await page.click('button.btn')
       
        await page.waitForTimeout(2000)
      } catch (error) {
        console.log(error)
        return false
      }
}


const _getData = async(page, urlCrawl,year , month)=>{
  await page.goto(urlCrawl)

  await page.waitForTimeout(3000)

  await page.selectOption('select[name="searchYear"]',`${year}`);
  await page.selectOption('select[name="searchMonth"]',`${month}`);

  await page.waitForTimeout(3000)

  await page.click('#fetch_report')

  await page.waitForSelector('#data-container', { visible: true })
  

  const listData =[]
  while(true){
const elements = await page.$$('#data-container tbody tr')

for(const item of elements){
  const listText =[]
  const transactionObj = {
    broker:brokerAbbrev.IS6_COM
  }
  const tds = await item.$$('td')
  for(let i=0;i<tds.length;i++){
   if([1,2,3,4,5,6,7,8].includes(i)){
    const tdText = await tds[i].textContent()
console.log(tdText);
   }
  }
}

const nextButton = await page.$('li.paginationjs-next')
if (!nextButton) {
  break; 
}
const isNextButton = await nextButton.evaluate((btn) => !btn.classList.contains('disabled'))
      if (!isNextButton) {
        break
      }

  await nextButton.click()    

  await page.waitForLoadState('#data-container')

  }

}
module.exports ={
    crawlIs6com
}

const getYearMonth = async (fromDate, toDate)=>{
  const listYearMonth = [];

  const fromDateYear = moment(fromDate, dateFormat.DATE_TIME).year();
  const fromDateMonth = moment(fromDate, dateFormat.DATE_TIME).month() + 1;
  const toDateYear = moment(toDate, dateFormat.DATE_TIME).year();
  const toDateMonth = moment(toDate, dateFormat.DATE_TIME).month() + 1;

  for (let year = fromDateYear; year <= toDateYear; year++) {
    const endMonth = year === toDateYear ? toDateMonth : 12;
    for (let month = year === fromDateYear ? fromDateMonth : 1; month <= endMonth; month++) {
      listYearMonth.push({ year, month });

    }
  }

  return listYearMonth;
}