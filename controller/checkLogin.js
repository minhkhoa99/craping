const { chromium } = require('playwright')
const moment = require('moment')
const querystring = require('querystring')
async function loginExness(page, url, username, password) {
  try {
    await page.goto(url)
   await page.waitForLoadState("networkidle")
    

    await page.fill('input[name = "login"]', username)
    await page.fill('input[name = "password"]', password)
    await page.click('#mui-1')
    await page.waitForNavigation()

    await page.waitForTimeout(3000)
  } catch (error) {
    console.log(error)
  }
}

// getData
async function getDataExness(page, url, res, queryParams) {
  try {
    let listAccountId = []
    const queryString = querystring.stringify(queryParams)
    const urlData = `${url}/?${queryString}`
    await page.goto(urlData)
 
    page.waitForTimeout(3000)
  // do {

    let parentEls = await page.$$('div[data-auto="row"]')
    
  for (const child of parentEls) {
     let pre = await child.$$("pre")
     let getListId = []
     for(let index =0 ; index<pre.length;index++) {
    
       if(index===0 || index===7 || index ===8) { 
        const accountId = await pre[index].textContent()
        getListId.push(accountId)
       
       await page.waitForTimeout(3000)
        }    
     }
     listAccountId.push(getListId);
    
  }
  console.log(listAccountId);
// }while (!await page.evaluate(async ()=>{
//     console.log(13213);
//     const nextButton = document.getElementsByClassName('WlV1S')
//     return nextButton[19].classList.contains('_3cmGt')
//   }))
 
//  const getAccountId = listAccountId.map((e)=>{return e[0]})


 let data =[]

for (let i = 0; i < listAccountId.length; i++) {
  const dateInitial = moment(listAccountId[i][0], 'DD MMM YYYY').format('YYYY-MM-DD')
  const initial = `initial_start_day/${dateInitial}/initial_end_day/${dateInitial}/`
  const date = `date_from=${dateInitial}&date_to=${dateInitial}`
  await page.goto(`https://my.exnesstrade.pro/reports/orders/${initial}?${date}&client_account=${listAccountId[i][1]}`)
  await page.waitForTimeout(3000)
  // something

  const getInstrument = await page.getByText('Instrument').first().textContent()
  await page.waitForTimeout(2000)

  const getUsd = await page.getByText('USDJPYm').first().textContent()
  await page.waitForTimeout(2000)

  const divs = await page.$$('div.ke3xz div._2i-_7 div._2WW5r div._3SxZ6')

  for (const div of divs) {
    const click = await div.$('span._1ZDRI')
    await click.click()
    await div.waitForSelector('div._2fam6', { state: 'visible' })
    await page.waitForTimeout(3000)
    const result = await div.$eval('div._2pyAa', (element) => element.textContent)
    await page.waitForTimeout(3000)
    data.push(result, getInstrument, getUsd, listAccountId[i])

    await page.waitForTimeout(3000)
  }

  await page.waitForTimeout(3000)
  
}

return convertObj(data)
} catch (error) {
    console.log(error)
  }
}
// run logic
async function crawExnesstradePro(event, res) {
  const browser = await chromium.launch({ headless: false })

  try {
    const { fromdate, todate } = event.query
    const startDate = moment(fromdate, 'YYYY-MM-DD', true);
    const endDate = moment(todate, 'YYYY-MM-DD', true)
    const rs =[]
   
  
   
    const context = await browser.newContext()
    const page = await context.newPage()
   const username = 'broker@p2t.sg'
   const password = 'Px9bvWSB'
    const urlLogin = 'https://my.exnesstrade.pro/login/?origin=%2Fdashboard%3Flang%3Dja%26action%3Dlogin'
    const urlCrawl = 'https://my.exnesstrade.pro/reports/rewards'
    // login
    await loginExness(page, urlLogin, username, password)
//getDate
const dateData = await calculateDateRanges();

    //getData

    for(const {start,end} of dateData){
    
      console.log(`Crawling data from ${start} to ${end}`);
      const queryParams = {
        'reward_date_from': start,
        'reward_date_to': end,
        'sorting[reward_date]': 'DESC',
        'page': 0,
        'limit': 10,
      }
      const result = await getDataExness(page, urlCrawl,res, queryParams);
    rs.push(result)
    }
    
    // return await res.status(200).json({mss:"ss", data: rs})

    // await getDataExness(page, urlCrawl, res, queryParams)
  } catch (error) {
    console.log(error)
    await browser.close()
    // return createResponse(res, false, null, code.ERROR, message.server_error )
  }
}
// convert data
const convertObj = (data)=>{
  try {
    const instrumentIndex = data.findIndex((item) => item === 'Instrument');
    const instrument = data[instrumentIndex + 1];
    const result = [];
    let accountInfo = null;
    let accountType = null;
    for (let i = 0; i < data.length; i++) {
      for (let j = i + 1; j < i + 4; j++) {
        if (
          Array.isArray(data[j]) &&
          data[j].length === 3 &&
          typeof data[j][1] === 'string' &&
          typeof data[j][2] === 'string'
        ) {
          accountInfo = data[j][1];
          accountType = data[j][2];
          break;
        }
      }
      if (data[i].includes('Order in MT')) {
        const orderMatch = data[i].match(/Order in MT(\d+)/);
        const openTimeMatch = data[i].match(/Open time(.+?)Close time/);
        const closeTimeMatch = data[i].match(/Close time(.+?)Tick History/);
        const volumeMatch = data[i].match(/Volume(.+?)Lots/);
        const profitMatch = data[i].match(/Profit(.+)/);
        const volumeLots = volumeMatch ? volumeMatch[1].trim() + ' ' + 'Lots' : null;
        const volumeMlnMatch = data[i].match(/Lots(.+?)Mln\. USD/);
        const volumeMln = volumeMlnMatch ? volumeMlnMatch[1].trim() + ' ' + 'Mln. USD' : null;
  
        const obj = {
          'account_id': accountInfo,
          'account_type': accountType,
          'order_in_mt': orderMatch ? orderMatch[1] : null,
          'profit': profitMatch ? profitMatch[1].trim() : null,
          'instrument': instrument,
          'open_date': openTimeMatch ? moment(openTimeMatch[1].trim(), "DD MMM YYYYHH:mm:ss").format('DD-MMM-YYYY HH:mm:ss') : null,
          'close_date': closeTimeMatch ? moment(closeTimeMatch[1].trim(), "DD MMM YYYYHH:mm:ss").format('DD-MMM-YYYY HH:mm:ss') : null,
          'volume_lots': volumeLots,
          'volume_mln_usd': volumeMln,
        };
  
        result.push(obj)
      }
    }
  return result
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  crawExnesstradePro,
  loginExness,
}

// const getDate = (startDate,endDate)=>{
//    // Thay đổi ngày kết thúc để kiểm tra

//    const diffDays = endDate.diff(startDate, 'days');
//    const dateRanges = [];
 
//    if (diffDays >= 0 && diffDays <= 3 || (diffDays > 3 && diffDays < 7)) {
//      dateRanges.push({ start: startDate.format('YYYY-MM-DD'), end: endDate.format('YYYY-MM-DD') });
//    } else if (diffDays >= 7) {
//      const totalWeeks = Math.ceil(diffDays / 7);
 
//      let currentStartDate = moment(startDate);
//      let currentEndDate = moment(startDate).add(6, 'days');
 
//      for (let i = 0; i < totalWeeks; i++) {
//        if (currentEndDate.isAfter(endDate)) {
//          currentEndDate = moment(endDate);
//        }
 
//        dateRanges.push({ start: currentStartDate.format('YYYY-MM-DD'), end: currentEndDate.format('YYYY-MM-DD') });
 
//        currentStartDate = moment(currentEndDate).add(1, 'day');
//        currentEndDate = moment(currentStartDate).add(6, 'days');
//      }
//    } else if (diffDays < 0) {
//      console.log('error');
//    }
 
//    return dateRanges;
  
// }

function calculateDateRanges() {
  const today = moment().subtract(1, 'day'); // return 1 day with today
  const finalEndDate = moment("2023-01-01");
  const queryParamsList = [];
  let endDate = moment(today);

  while (endDate.diff(finalEndDate, 'days') >= 0) { // check endDate
    const startDate = moment(endDate).subtract(6, 'days'); //last week

    queryParamsList.push({
      start: moment.max(startDate, finalEndDate).format("YYYY-MM-DD"), // select max days after startDate and finalEndDate
      end: endDate.format("YYYY-MM-DD")
    });

    

    endDate = moment(startDate).subtract(1, 'day'); // return 1 day create new endDate
  }

  return queryParamsList;
}