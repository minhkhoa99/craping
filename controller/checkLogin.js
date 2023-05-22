const { chromium } = require('playwright')
const moment = require('moment')
const querystring = require('querystring')
async function loginExness(page, url, username, password) {
  try {
    await page.goto(url)
    await page.fill('input[name = "login"]', username)
    await page.fill('input[name = "password"]', password)
    await page.click('#mui-1')
    await page.waitForNavigation()
  } catch (error) {
    console.log(error)
  }
}

// getData
async function getDataExness(page, url, res, queryParams) {
  try {
    const utc = new Date().toJSON().slice(0, 10).replace(/-/g, '-')
    const urlGetDay = `${url}/initial_start_day/${utc}/initial_end_day/${utc}`
    const queryString = querystring.stringify(queryParams)
    const urlData = `${urlGetDay}/?${queryString}`
    await page.goto(urlData)
    await page.click('[data-auto="language_switcher_button"]')
    await page.waitForTimeout(2000)
    await page.click('#language_select_values_en > ._1Fc6m')
    await page.waitForTimeout(5000)
    // click get data
    const getTitle = []
    const getInstrument = await page.getByText('Instrument').first().textContent()
    await page.waitForTimeout(1000)
    const getUsd = await page.getByText('USDJPYm').first().textContent()
    getTitle.push(getInstrument, getUsd)
    const divs = await page.$$('div._2i-_7 div._2WW5r div._3SxZ6')
    const data = []
    for (const div of divs) {
      const click = await div.$('span._1ZDRI')
      await click.click()
      await div.waitForSelector('div._2fam6', { state: 'visible' })
      const result = await div.$eval('div._2pyAa', (element) => element.textContent)
      data.push(result)
      await page.waitForTimeout(3000)
    }
    const returnData = convertObj(data)
    return createResponse(res, true, { title: getTitle, getData: returnData })
  } catch (error) {
    console.log(error)
  }
}
// run logic
async function crawExnesstradePro(event, res) {
  const browser = await chromium.launch({ headless: false })
  try {
    const { fromdate, todate } = event.query
    const queryParams = {
      'date_from': fromdate,
      'date_to': todate,
      'sorting[close_date]': 'DESC',
      'page': 0,
      'limit': 10,
    }
    const context = await browser.newContext()
    const page = await context.newPage()
    // get page config ini
    const iniConfig = await readingConfigIni()
    const username = iniConfig.EXNESS.USERNAME
    const password = iniConfig.EXNESS.PASSWORD
    const urlLogin = iniConfig.EXNESS.URL_LOGIN
    const urlCrawl = iniConfig.EXNESS.URL_CRAWL
    // login
    await loginExness(page, urlLogin, username, password)
    //getData
    await getDataExness(page, urlCrawl, res, queryParams)
  } catch (error) {
    console.log(error)
    await browser.close()
    return createResponse(res, false, null, code.ERROR, message.server_error )
  }
}
// convert data
const convertObj = (data)=>{
  try {
    const formatTime = (timeString) => {
      const formattedTime = moment(timeString, 'DD MMM YYYYHH:mm:ss').format('DD MMM YYYY HH:mm:ss')
      return formattedTime
    }
    return data.map((item) => {
      const orderMatch = item.match(/Order in MT(\d+)/)
      const openTimeMatch = item.match(/Open time(.+?)Close time/)
      const closeTimeMatch = item.match(/Close time(.+?)Tick History/)
      const volumeMatch = item.match(/Volume(.+?)Profit/)
      const profitMatch = item.match(/Profit(.+)/)

      return {
        'Order in MT': orderMatch ? parseInt(orderMatch[1]) : null,
        'Open time': openTimeMatch ? formatTime(openTimeMatch[1].trim()) : null,
        'Close time': closeTimeMatch ? formatTime(closeTimeMatch[1].trim()) : null,
        'Volume': volumeMatch ? volumeMatch[1].trim().replace('Lots', 'Lots ') : null,
        'Profit': profitMatch ? profitMatch[1].trim() : null,
      }
    })
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  crawExnesstradePro,
  loginExness,
}

module.exports.getDate = (req,res)=>{
  const startDate = moment('2023/02/18', 'YYYY/MM/DD');
const endDate = moment('2023/04/30', 'YYYY/MM/DD'); // Thay đổi ngày kết thúc để kiểm tra

const diffDays = endDate.diff(startDate, 'days');
console.log(diffDays);
if (diffDays >= 0 && diffDays <=3 || (diffDays > 3 && diffDays < 7)) {
  console.log(`Khoảng từ ${startDate.format('YYYY/MM/DD')} đến ${endDate.format('YYYY/MM/DD')}`);
} else if (diffDays >= 7) {
  const totalWeeks = Math.ceil(diffDays / 7);

  let currentStartDate = moment(startDate);
  let currentEndDate = moment(startDate).add(6, 'days');

  // In ra các khoảng có độ dài 7 ngày
  for (let i = 0; i < totalWeeks; i++) {
    // Đảm bảo không vượt quá ngày kết thúc
    if (currentEndDate.isAfter(endDate)) {
      currentEndDate = moment(endDate);
    }

    console.log(`Khoảng từ ${currentStartDate.format('YYYY/MM/DD')} đến ${currentEndDate.format('YYYY/MM/DD')}`);

    // Cập nhật ngày bắt đầu và ngày kết thúc cho tuần tiếp theo
    currentStartDate = moment(currentEndDate).add(1, 'day');
    currentEndDate = moment(currentStartDate).add(6, 'days');
  }
}else if(diffDays<0){
  console.log('eroor');
}
  
}