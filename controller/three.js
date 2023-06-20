const { chromium } = require('playwright-extra')
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha')
const { code, message, flag, crawlResMessage, crawlLogMessage, dateFormat, modeAPI, brokerAbbrev, metaTradePlatform } = require('../constant')
const { createResponse, saveCrawlLog, getListDays } = require('../utils')
const moment = require('moment')

const repository = require('../repository')

let loginTimeRetry = 1
const APPLY_FILTER_DATE_INDEX = 8
let isFunctionActive = false

async function crawlDataThreeTrader(req, res) {
  chromium .use(
    RecaptchaPlugin({
      provider: {
        id: '2captcha',
        token: process.env.THREE_TRADER_RECAPTCHA_TOKEN,
      },
      visualFeedback: true, // colorize reCAPTCHAs (violet = detected, green = solved)
    }),
  )
  const browserHeadlessMode = process.env.BROWSER_HEADLESS_MODE === 'true'
  const browser = await chromium .launch({ headless: browserHeadlessMode })
  try {
    // Check if the function is already active
    if (isFunctionActive) {
      return createResponse(res, false, null, code.CONFLICT, message.function_active)
    }
    isFunctionActive = true

    // Respond successfully to customers before data crawl
    res.status(code.SUCCESS).json({ message: crawlResMessage.three_trader })

    const {
      THREE_TRADER_USERNAME, THREE_TRADER_PASSWORD, THREE_TRADER_URL_LOGIN, THREE_TRADER_URL_CRAWL_REBATE,
      THREE_TRADER_TRADING_ACCOUNTS, THREE_TRADER_URL_CRAWL_ORDER, THREE_TRADER_LIMIT_FIRST_DATE,
    } = process.env

    // Get list date

    let listDate = []
    if (req.query.mode === modeAPI.MANUAL) {
      const { dateFrom, dateTo } = req.query
      const isErrorDate = await repository.isExistDayError(brokerAbbrev.THREE_TRADER, dateFrom, dateTo)
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
      const isFirstRunning = await repository.notExistDataOfPage(brokerAbbrev.THREE_TRADER)
      if (isFirstRunning) {
        listDate.push({
          fromDate: THREE_TRADER_LIMIT_FIRST_DATE,
          toDate: yesterdayDate,
        })
      } else {
        listDate = await getListDays(yesterdayDate, yesterdayDate, brokerAbbrev.THREE_TRADER)
      }
    }
    // get list trading account
    const listIdTradingAccount = THREE_TRADER_TRADING_ACCOUNTS.split(',')

    // login to home three
    const context = await browser.newContext()
    const page = await context.newPage()
    const isLogin = await login(page, THREE_TRADER_URL_LOGIN, THREE_TRADER_USERNAME, THREE_TRADER_PASSWORD)
    if (!isLogin) {
      const yesterdayDate = moment().subtract(1, 'days').format(dateFormat.DATE)
      await saveCrawlLog(brokerAbbrev.THREE_TRADER, yesterdayDate, yesterdayDate, flag.FALSE, crawlLogMessage.login_error)
      await browser.close()
      isFunctionActive = false
      return
    }

    // get all data
    for (const obj of listDate) {
      const listData = []
      for (const tradingAccount of listIdTradingAccount) {
        const isCrawlDataRebateSuccess = await handleRebatePage(page, tradingAccount, THREE_TRADER_URL_CRAWL_REBATE,
          obj.fromDate, obj.toDate, listData )
        if (!isCrawlDataRebateSuccess) {
          await saveCrawlLog(brokerAbbrev.THREE_TRADER, obj.fromDate, obj.toDate, flag.FALSE, crawlLogMessage.cannot_crawl_data)
          await browser.close()
          isFunctionActive = false
          return
        }
        const isCrawlDataOrderSuccess = await handleOrderPage(page, tradingAccount, THREE_TRADER_URL_CRAWL_ORDER, obj.fromDate, obj.toDate, listData)
        if (!isCrawlDataOrderSuccess) {
          await saveCrawlLog(brokerAbbrev.THREE_TRADER, obj.fromDate, obj.toDate, flag.FALSE, crawlLogMessage.cannot_crawl_data)
          await browser.close()
          isFunctionActive = false
          return
        }
      }

      // save to db
      if (listData.length === 0) {
        await saveCrawlLog(brokerAbbrev.THREE_TRADER, obj.fromDate, obj.toDate, flag.TRUE, crawlLogMessage.data_empty)
      } else {
        const isInsertCrawlTransaction = await repository.insertCrawlTransaction(listData, brokerAbbrev.THREE_TRADER, obj.fromDate, obj.toDate)
        if (!isInsertCrawlTransaction) {
          await saveCrawlLog(brokerAbbrev.THREE_TRADER, obj.fromDate, obj.toDate, flag.FALSE, crawlLogMessage.save_data_error )
        }
      }
    }

    await browser.close()
    isFunctionActive = false
    return
  } catch (error) {
    console.error(error)
    await saveCrawlLog(brokerAbbrev.THREE_TRADER, req.query.fromDate, req.query.toDate, flag.FALSE, crawlLogMessage.cannot_crawl_data)
    await browser.close()
    isFunctionActive = false
    return
  }
}

async function login(page, urlLogin, username, password) {
  try {
    await page.goto(urlLogin)
    await page.waitForLoadState('domcontentloaded')

    // fill login email and password
    await page.getByLabel('email').fill(username)
    await page.getByLabel('Password').fill(password)

    // verify recaptcha
    const res = await page.solveRecaptchas()
    if (res.error) {
      while (loginTimeRetry <= 3) {
        loginTimeRetry++
        await login(page, urlLogin, username, password)
      }
      return false
    }

    // click login and navigate home page
    await page.click('button:is(:text("LOGIN"))')
    await page.waitForLoadState('domcontentloaded')

    // click change status IB Portal
    await page.click('button:is(:text("IB Portal"))')
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

// get data rebate page
async function handleRebatePage( page, tradingAccount, urlRebate, fromDate, toDate, listData) {
  try {
    // Move to page RebateReportManagement
    await page.goto(urlRebate)
    await page.waitForLoadState('domcontentloaded')

    // click to Request History
    await page.getByText('Request History').click()
    await page.waitForTimeout(3000)

    // fill tradingAccount
    await page.getByRole('textbox').nth(5).fill(tradingAccount)
    await page.waitForTimeout(3000)
    // fill time From
    await page.getByPlaceholder('From').nth(1).focus()
    const keyboard = page.keyboard
    await keyboard.down('Control')
    await keyboard.press('A')
    await keyboard.up('Control')
    await keyboard.press('Delete')
    await page.getByPlaceholder('From').nth(1).fill(`${fromDate} 00:00:00`)

    // fill time To
    await page.getByPlaceholder('To').nth(1).focus()
    await keyboard.down('Control')
    await keyboard.press('A')
    await keyboard.up('Control')
    await keyboard.press('Delete')
    await page.getByPlaceholder('To').nth(1).fill(`${toDate} 00:00:00`) // need arg time

    // click button apply
    await page.locator('.dark').nth(4).click()
    await page.waitForTimeout(2000)

    // get data
    const elementRowComplete = await page.locator('.vxe-cell', { hasText: 'Complete' }).count()
    if (elementRowComplete) {
      await page.locator('.icon-viewcsv').first().click()
      await page.locator('.el-icon-close').nth(1).click()
      await page.waitForTimeout(3000)

      // get data RequestTime
      const countRowComplete = await page.locator('.vxe-cell', { hasText: 'Complete' }).count()


      // Get data file "csv view"
      for (let i = 0; i < countRowComplete; i++ ) {
        await page.locator('.icon-viewcsv').nth(i).click()
        await page.waitForTimeout(2000)

        // get data in column 3/4
        const columnRebate = await page.$$eval('.vxe-table--body tr td:nth-child(3)', (tds) => tds.map((td) => td.textContent.trim()))
        const columnNodeName = await page.$$eval('.vxe-table--body  tr td:nth-child(4)', (tds) => tds.map((td) => td.textContent.trim()))
        const dataNodeName = columnNodeName.slice(5, (columnNodeName.length) / 2)
        const dataRebate = columnRebate.slice(5, (columnRebate.length) / 2)
        for (let index = 0; index < dataRebate.length; index++) {
          listData.push({
            reward_per_period: dataRebate[index].replace(/[^\d.-]/g, ''),
            account_type: dataNodeName[index],
            account_currency: dataNodeName[index],
            account: tradingAccount,
            broker: brokerAbbrev.THREE_TRADER,
            platform: metaTradePlatform.MT4,
          })
        }
        await page.waitForTimeout(2000)
        await page.locator('.el-icon-close').nth(1).click()
        await page.waitForTimeout(2000)
      }
    }
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

// get data order pages
async function handleOrderPage( page, tradingAccount, urlOrder, fromDate, toDate, listData) {
  // select "Apply Report" in Search Type Element li
  try {
    // moving to page OrderReportManagementPage
    await page.goto(urlOrder)
    await page.waitForLoadState('domcontentloaded')

    // fill trading account
    await page.getByRole('textbox').first(5).fill(tradingAccount)

    await page.waitForTimeout(4000)
    await page.locator('[placeholder="Select"]').click()
    await page.waitForTimeout(1000)
    const liElements = await page.$$('li')

    // select "Apply Report" in Search Type Element li
    await liElements[1].click()
    await page.waitForTimeout(1000)
    await page.locator('.dark').nth(2).click()
    await page.waitForTimeout(2000)
    await page.locator('.btns').click()
    await page.waitForTimeout(2000)

    // fill from date
    const keyboard = page.keyboard
    await keyboard.down('Control')
    await keyboard.press('A')
    await keyboard.up('Control')
    await keyboard.press('Delete')
    await page.fill('[placeholder="From"]', `${fromDate} 00:00:00`)
    await page.waitForLoadState('domcontentloaded')

    // fill to date
    await page.locator('[placeholder="To"]').focus()
    await keyboard.down('Control')
    await keyboard.press('A')
    await keyboard.up('Control')
    await keyboard.press('Delete')
    await page.fill('[placeholder="To"]', `${toDate} 00:00:00`) //

    let element = await page.$$('.el-form-item__content')
    let elementTimeRetry = 1
    while (elementTimeRetry <= 3 && element === null) {
      elementTimeRetry++
      await page.waitForTimeout(3000)
      element = await page.$$('.el-form-item__content')
    }

    // click button APPLY
    await element[APPLY_FILTER_DATE_INDEX].click()
    await page.waitForTimeout(4000)

    // get data require
    const parentElements = await page.$$('.table_content_tbody')
    for (const parentElement of parentElements) {
      const childElements = await parentElement.$$('.vxe-body--column')
      const rowContent = []

      for (let i = 0; i < childElements.length; i++) {
        if (i === 2 || i === 4 || i === 5 || i === 6 || i === 12 ) {
          const textContent = await childElements[i].textContent()
          rowContent.push(textContent)
        }
        if (i === 0 || i === 7 || i === 15) {
          const rawTextContent = await childElements[i].textContent()
          const textContent = rawTextContent.replace(/[^\d.,-]/g, '').trim()
          rowContent.push(textContent)
        }
      }
      rowContent.push(brokerAbbrev.THREE_TRADER, metaTradePlatform.MT4)
      listData.push(mapRawDataToOrderObj(rowContent))
    }
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

const mapRawDataToOrderObj = (listData) => {
  const obj = {}
  const keyValue = ['order_id', 'account', 'open_time', 'type', 'symbol', 'volume', 'close_time', 'profit', 'broker', 'platform']
  keyValue.forEach((key, index)=>{
    obj[key] = listData[index]
  })
  return obj
}

module.exports = {
  crawlDataThreeTrader,
}
