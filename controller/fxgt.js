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
        
        //login
        const urlLogin = "https://ib.fxgt.com/login"
        const username = 'broker@p2t.sg'
        const password = "FHOdsiw34"

        //getData
        const urlCrawl = "https://ib.fxgt.com/home"
        await loginFxgt(page,urlLogin,username,password,urlCrawl)

        await getDataFxgt(page,urlCrawl)
    }catch(error){
        console.log(error);
    }

}

const loginFxgt = async(page,urlLogin,username,password,urlCrawl)=>{
try{
  
    await page.goto(urlLogin)

    await page.fill('#email', username)
    await page.fill('#password', password)
    // await page.setExtraHTTPHeaders({
    //     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
       
      
    // });
    // const client = await page.context().newCDPSession(page);
    // await client.send('Network.enable');
    await page.waitForTimeout(3000)
    await page.click('#btn_login')
   
    await page.waitForLoadState('networkidle');
   
    await page.goto(urlCrawl)
    
    return true
}catch(error){
    console.log(error);
    return false
}
}

const getDataFxgt = async()=>{

}

module.exports ={
    crawlFxgt
}