const { chromium } = require('playwright')
const { code, message, dateFormat, flag, resMessage, scrapLogMessage, modeAPI } = require('../constant')
const { createResponse, readingConfigIni, saveScrapLog, getListDays } = require('../utils')
const moment = require('moment')

const repository = require('../repository')

let isFunctionActive = false
const URL_PAGE = 'milton_market'

async function crawlDataMiltonMarket(req, res) {
  const browserHeadlessMode = process.env.BROWSER_HEADLESS_MODE === 'true'
  const browser = await chromium.launch({ headless: browserHeadlessMode })
  try {
    // Check if the function is already active
    if (isFunctionActive) {
      return createResponse(res, false, null, code.CONFLICT, message.function_active)
    }
    isFunctionActive = true

    // Respond successfully to customers before data crawl
    res.status(code.SUCCESS).json({ message: resMessage.milton_market })

    // get page config ini
    const iniConfig = await readingConfigIni()
    if (!iniConfig) {
      const dateNow = moment(Date.now()).format(dateFormat.DATE)
      await saveScrapLog(URL_PAGE, dateNow, dateNow, flag.FALSE, scrapLogMessage.reading_file_error)
      await browser.close()
      isFunctionActive = false
      return
    }
    const { USERNAME, URL_LOGIN, URL_CRAWL, PASSWORD, LIMIT_FIRST_DATE } = iniConfig.MILTON_PRIME


    // Get list date
    let listDate = []
    if (req.query.mode === modeAPI.MANUAL) {
      const { dateFrom, dateTo } = req.query
      const isErrorDate = await repository.isExistDayError(URL_PAGE, dateFrom, dateTo)
      if (!isErrorDate) {
        await browser.close()
        isFunctionActive = false
        return
      }
      listDate.push({
        fromDate: dateFrom,
        toDate: dateTo,
      })
    } else {
      const yesterdayDate = moment().subtract(1, 'days').format('DD-MM-YYYY')
      const isFirstRunning = await repository.isExistDataOfPage(URL_PAGE)
      if (isFirstRunning) {
        listDate.push({
          fromDate: moment(LIMIT_FIRST_DATE, dateFormat.DATE).format('DD-MM-YYYY'),
          toDate: yesterdayDate,
        })
      } else {
        listDate = await getListDays(yesterdayDate, yesterdayDate, URL_PAGE)
      }
    }
    const context = await browser.newContext()
    const page = await context.newPage()
    // login to milton prime
    const isLogin = await login(page, URL_LOGIN, USERNAME, PASSWORD)
    if (!isLogin) {
      const dateNow = moment(Date.now()).format(dateFormat.DATE)
      await saveScrapLog(URL_PAGE, dateNow, dateNow, flag.FALSE, scrapLogMessage.reading_file_error)
      await browser.close()
      isFunctionActive = false
      return
    }

    await page.waitForTimeout(4000)

    // const listDate = [{
    //   fromDate: '20-05-2001',
    //   toDate: '20-05-2023',
    // }]
    for (const obj of listDate) {
      // Crawl data from page
      await getDataMiltonMarket(page, URL_CRAWL, obj.fromDate, obj.toDate)
    }

    await browser.close()
    isFunctionActive = false
    return
  } catch (error) {
    console.error(error)
    await browser.close()
    isFunctionActive = false
    return
  }
}

async function login(page, urlLogin, username, password) {
  try {
    await page.goto(urlLogin)
    await page.waitForLoadState('networkidle')
    await page.fill('#form_login__username', username)
    await page.fill('#form_login__password', password)
    await page.click('#form_login_submit')
    return true
  } catch (error) {
    return false
  }
}

async function getDataMiltonMarket(page, urlCrawl, dateFrom, dateTo) {
  // go to history page
  await page.goto(urlCrawl)

  // click input calendar
  await page.locator('input[type="text"]').nth(1).click()
  await page.evaluate(() => {
    document
      .querySelectorAll('input[type="text"]')[1]
      .removeAttribute('readonly')
  })

  // click dropdown calendar
  await page.locator('.interval-dropdown_item').nth(15).click()
  await page.waitForTimeout(4000)

  // change property input and fill time
  await page.evaluate(() => {
    const elFromDate = document.querySelectorAll('input[type="hidden"]')[4]
    elFromDate.setAttribute('type', 'visible')
    elFromDate.setAttribute('id', 'from-date')
    elFromDate.focus()
    setTimeout(() => {
      document
        .querySelectorAll('.interval-dropdown')[1]
        .setAttribute('style', 'display:block')
    }, 50)
  })
  await page.fill('#from-date', dateFrom)
  const keyboard = page.keyboard
  await keyboard.press('Space')
  await keyboard.press('Enter')


  await page.waitForTimeout(2000)
  await page.evaluate(() => {
    const elToDate = document.querySelectorAll('input[type="hidden"]')[4]
    elToDate.setAttribute('type', 'visible')
    elToDate.setAttribute('id', 'to-date')
    elToDate.focus()
  })

  await page.fill('#to-date', dateTo)
  await keyboard.press('Space')
  await keyboard.press('Enter')

  // click button "apply filters"
  await page.click('button[class="btn btn-xs bg-olive"]')
  await page.waitForTimeout(4000)


  // get data in pagination
  const listData = []
  do {
    await getDataOnPage(page, listData)

    await page.locator('.page-link').nth(1).click()
    await page.waitForTimeout(4000)

    await getDataOnPage(page, listData)
  }
  while (! await page.evaluate(()=>{
    const elNext = document.getElementsByClassName('page-item')
    return elNext[1].classList.contains('disabled')
  }))

  // save to db
  if (listData.length === 0) {
    await saveScrapLog(URL_PAGE, dateFrom, dateTo, flag.TRUE, scrapLogMessage.data_empty)
  } else {
    const isInsertMilton = await repository.insertDataMilTon(listData, dateFrom, dateTo)
    if (!isInsertMilton) {
      await saveScrapLog(URL_PAGE, dateFrom, dateTo, flag.FALSE, scrapLogMessage.save_data_error )
    }
  }
}

async function getDataOnPage(page, listData) {
  const elTr = await page.$$( '.table-bordered  tbody tr')
  for (const item of elTr) {
    const td = await item.$$('td')
    const listTdText = []
    for ( let i = 0; i < td.length; i++ ) {
      if (i === 0 || i === 1 || i === 2 || i === 3 || i === 4 || i === 5 || i === 8 || i === 10) {
        const tdText = await td[i].innerText()
        listTdText.push(tdText)
      }
    }
    listData.push( mapRawDataMilTonToObj(listTdText))
  }
  return listData
}


const mapRawDataMilTonToObj = (listData) => {
  const obj = {}
  const keyValue = ['ticket', 'lots', 'symbol', 'close_date', 'account', 'monetary_commission', 'commission_received', 'rule']
  keyValue.forEach((key, index)=>{
    obj[key] = listData[index]
  })
  return obj
}

module.exports = {
  crawlDataMiltonMarket,
}
