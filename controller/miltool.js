const { chromium } = require('playwright')
const { code, message, dateFormat, flag, crawlResMessage, crawlLogMessage, modeAPI, brokerAbbrev, metaTradePlatform } = require('../constant')
const { createResponse, saveCrawlLog, getListDays } = require('../utils')
const moment = require('moment')

const repository = require('../repository')

let isFunctionActive = false

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
    res.status(code.SUCCESS).json({ message: crawlResMessage.milton_market })

    const {
      MILTON_MARKET_USERNAME, MILTON_MARKET_URL_LOGIN, MILTON_MARKET_URL_CRAWL, MILTON_MARKET_PASSWORD,
      MILTON_MARKET_LIMIT_FIRST_DATE,
    } = process.env

    // Get list date
    let listDate = []
    if (req.query.mode === modeAPI.MANUAL) {
      const { dateFrom, dateTo } = req.query
      const isErrorDate = await repository.isExistDayError(brokerAbbrev.MILTON_MARKET, dateFrom, dateTo)
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
      const yesterdayDate = moment().subtract(1, 'days').format(dateFormat.DATE)
      const isFirstRunning = await repository.notExistDataOfPage(brokerAbbrev.MILTON_MARKET)
      if (isFirstRunning) {
        listDate.push({
          fromDate: moment(MILTON_MARKET_LIMIT_FIRST_DATE, dateFormat.DATE).format(dateFormat.DATE),
          toDate: yesterdayDate,
        })
      } else {
        listDate = await getListDays(yesterdayDate, yesterdayDate, brokerAbbrev.MILTON_MARKET)
      }
    }
    const context = await browser.newContext()
    const page = await context.newPage()
    // login to milton prime
    const isLogin = await login(page, MILTON_MARKET_URL_LOGIN, MILTON_MARKET_USERNAME, MILTON_MARKET_PASSWORD)
    if (!isLogin) {
      const yesterdayDate = moment().subtract(1, 'days').format(dateFormat.DATE)
      await saveCrawlLog(brokerAbbrev.MILTON_MARKET, yesterdayDate, yesterdayDate, flag.FALSE, crawlLogMessage.reading_file_error)
      await browser.close()
      isFunctionActive = false
      return
    }

    await page.waitForTimeout(4000)

    for (const obj of listDate) {
      // Crawl data from page
      await getDataMiltonMarket(page, MILTON_MARKET_URL_CRAWL, obj.fromDate, obj.toDate)
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
    await page.waitForLoadState('domcontentloaded')

    await page.fill('#form_login__username', username)
    await page.fill('#form_login__password', password)
    await page.click('#form_login_submit')
    return true
  } catch (error) {
    return false
  }
}

async function getDataMiltonMarket(page, urlCrawl, dateFrom, dateTo) {
  const dateFromPicker = moment(dateFrom).format(dateFormat.DATE_3)
  const dateToPicker = moment(dateTo).format(dateFormat.DATE_3)

  // go to history page
  await page.goto(urlCrawl)
  await page.waitForLoadState('domcontentloaded')

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
      document.querySelectorAll('.interval-dropdown')[1].setAttribute('style', 'display:block')
    }, 50)
  })
  await page.fill('#from-date', dateFromPicker)
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

  await page.fill('#to-date', dateToPicker)
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
  } while (!(await page.evaluate(() => {
    const elNext = document.getElementsByClassName('page-item')
    return elNext[1].classList.contains('disabled')
  })))

  // save to db
  if (listData.length === 0) {
    await saveCrawlLog(brokerAbbrev.MILTON_MARKET, dateFrom, dateTo, flag.TRUE, crawlLogMessage.data_empty )
  } else {
    const isInsertCrawlTransaction = await repository.insertCrawlTransaction(listData, brokerAbbrev.MILTON_MARKET, dateFrom, dateTo)
    if (!isInsertCrawlTransaction) {
      await saveCrawlLog(brokerAbbrev.MILTON_MARKET, dateFrom, dateTo, flag.FALSE, crawlLogMessage.save_data_error )
    }
  }
}

async function getDataOnPage(page, listData) {
  const elTr = await page.$$('.table-bordered  tbody tr')
  for (const item of elTr) {
    const td = await item.$$('td')
    let listTdText = []
    for (let i = 0; i < td.length; i++) {
      if (i === 0 || i === 1 || i === 2 || i === 3 || i === 4 || i === 5 || i === 8 || i === 10) {
        const tdText = await td[i].innerText()
        listTdText.push(tdText)
      }
    }
    listTdText = [...listTdText, metaTradePlatform.MT4, brokerAbbrev.MILTON_MARKET]
    listData.push(mapRawDataMilTonToObj(listTdText))
  }
  return listData
}

const mapRawDataMilTonToObj = (listData) => {
  const obj = {}
  const keyValue = [
    'order_id', 'volume', 'symbol', 'close_time', 'account', 'account_currency',
    'reward_per_trade', 'account_type', 'platform', 'broker',
  ]
  keyValue.forEach((key, index) => {
    obj[key] = listData[index]
  })
  return obj
}

module.exports = {
  crawlDataMiltonMarket,
}
