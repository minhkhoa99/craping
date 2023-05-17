const axios = require('axios')
const {chromium} = require('playwright')
const cheerio = require('cheerio')
const {addDays, nextFriday, format} = require('date-fns')
const CURRENCY_SYMBOL = '$';
const NUMBER_OF_WEEKENDS_TO_SEARCH = 1;

const formatDate = (date)=> format(date, 'yyyy-MM-dd')
const getUpCommingWeekends = () =>{
    const weekends = []
    let currentDate = new Date();
    const timeIntervals = [
        { days: 1, includeCurrentDay: true },
        { days: 3, includeCurrentDay: false },
        { days: 7, includeCurrentDay: false }
      ];
      
      for (let interval of timeIntervals) {
        if (interval.includeCurrentDay) {
          const friday = formatDate(currentDate);
          const sunday = formatDate(addDays(currentDate, 2));
          weekends.push({ friday, sunday });
        }
      
        currentDate = addDays(currentDate, interval.days);
      
        const friday = formatDate(currentDate);
        const sunday = formatDate(addDays(currentDate, 2));
        weekends.push({ friday, sunday });
      }
      
      return weekends;
}
async function checkLogin(req,res){
const getUrl = 'https://my.exnesstrade.pro/dashboard?lang=ja&action=login'

    try{
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext();
        const page = await context.newPage();
       
        await page.goto(getUrl)
        await page.fill('input[name = "login"]','broker@p2t.sg')
        await page.fill('input[name = "password"]','Px9bvWSB')

        await page.click('#mui-1')
        await page.waitForNavigation()
       
            const urlData = `https://my.exnesstrade.pro/reports/orders/initial_start_day/2023-05-17/initial_end_day/2023-05-17/?date_from=2023-02-11&date_to=2023-02-17&sorting%5Bclose_date%5D=DESC&page=0&limit=10`
            await page.goto(urlData)
            const getContentData = []

           const elements = await page.locator('[data-auto="cell_data"] > ._3qJH9 > ._1ZDRI').first().click()
          
        
            // const text = await page.content("._2fam6")
            // console.log(text)
            // const $ = cheerio.load(await page.content());
        
            // $(`#_2fam6 > .bibp9`).each((index, element) => {
            //     getContentData.push($(element).text());
            //   });
                
            //     console.log(getContentData);
    //         await page.waitForTimeout(10000)
 
        
        
     
    }catch(error){
        console.log(error);
    }
}

module.exports ={
    checkLogin
}