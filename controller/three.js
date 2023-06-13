const { chromium } = require('playwright-extra')
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha')
const { code, message, flag, resMessage, scrapLogMessage, dateFormat, modeAPI } = require('../constant')
const { createResponse, saveScrapLog, getListDays } = require('../utils')
const moment = require('moment')

const repository = require('../repository')

let loginTimeRetry = 1
const APPLY_FILTER_DATE_INDEX = 8
let isFunctionActive = false
const URL_PAGE = 'three_trader'

async function crawlDataThreeTrader(req, res) {
  chromium.use(
    RecaptchaPlugin({
      provider: {
        id: '2captcha',
        token: process.env.THREE_TRADER_RECAPTCHA_TOKEN,
      },
      visualFeedback: true, // colorize reCAPTCHAs (violet = detected, green = solved)
    }),
  )
  const browserHeadlessMode = process.env.BROWSER_HEADLESS_MODE === 'true'
  const browser = await chromium.launch({ headless: browserHeadlessMode })
  try {
    // Check if the function is already active
    if (isFunctionActive) {
      return createResponse(res, false, null, code.CONFLICT, message.function_active)
    }
    isFunctionActive = true

    // Respond successfully to customers before data crawl
    res.status(code.SUCCESS).json({ message: 'succcess' })
    const { fromDate, toDate } = req.query

   
    const {
      THREE_TRADER_USERNAME, THREE_TRADER_PASSWORD, THREE_TRADER_URL_LOGIN, THREE_TRADER_URL_CRAWL_REBATE,
      THREE_TRADER_TRADING_ACCOUNTS, THREE_TRADER_URL_CRAWL_ORDER, THREE_TRADER_LIMIT_FIRST_DATE,
    } = process.env

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
      const yesterdayDate = moment().subtract(1, 'days').format(dateFormat.DATE)
      const isFirstRunning = await repository.isExistDayError(URL_PAGE)
      if (isFirstRunning) {
        listDate.push({
          fromDate: THREE_TRADER_LIMIT_FIRST_DATE,
          toDate: yesterdayDate,
        })
      } else {
        listDate = await getListDays(yesterdayDate, yesterdayDate, URL_PAGE)
      }
    }
    // get list trading account
    const listIdTradingAccount = THREE_TRADER_TRADING_ACCOUNTS.split(',')

    // login to home three
    const context = await browser.newContext()
    const page = await context.newPage()
    const isLogin = await login(page, THREE_TRADER_URL_LOGIN, THREE_TRADER_USERNAME, THREE_TRADER_PASSWORD)
    if (!isLogin) {
      const dateNow = moment(Date.now()).format(dateFormat.DATE)
      await saveScrapLog(URL_PAGE, dateNow, dateNow, flag.FALSE, scrapLogMessage.login_error)
      await browser.close()
      isFunctionActive = false
      return
    }

    // get all data
    for (const obj of listDate) {
      const listData = []
      for (const tradingAccount of listIdTradingAccount) {
        const isCrawlDataRebateSuccess = await handleRebatePage(page, tradingAccount, THREE_TRADER_URL_CRAWL_REBATE, obj.fromDate, obj.toDate, listData )
        if (!isCrawlDataRebateSuccess) {
          await saveScrapLog(URL_PAGE, obj.fromDate, obj.toDate, flag.FALSE, scrapLogMessage.cannot_crawl_data)
          await browser.close()
          isFunctionActive = false
          return
        }
        const isCrawlDataOrderSuccess = await handleOrderPage(page, tradingAccount, THREE_TRADER_URL_CRAWL_ORDER, fromDate, toDate, listData)
        if (!isCrawlDataOrderSuccess) {
          await saveScrapLog(URL_PAGE, obj.fromDate, obj.toDate, flag.FALSE, scrapLogMessage.cannot_crawl_data)
          await browser.close()
          isFunctionActive = false
          return
        }
      }

      // save to db
      if (listData.length === 0) {
        await saveScrapLog(URL_PAGE, obj.fromDate, obj.toDate, flag.TRUE, scrapLogMessage.data_empty)
      } else {
        const isInsertThreeTrader = await repository.insertDataThreeTrader(listData, obj.fromDate, obj.toDate)
        if (!isInsertThreeTrader) {
          await saveScrapLog(URL_PAGE, obj.fromDate, obj.toDate, flag.FALSE, scrapLogMessage.save_data_error )
        }
      }
    }

    await browser.close()
    isFunctionActive = false
    return
  } catch (error) {
    console.error(error)
    await saveScrapLog(URL_PAGE, req.query.fromDate, req.query.toDate, flag.FALSE, scrapLogMessage.cannot_crawl_data)
    await browser.close()
    isFunctionActive = false
    return
  }
}

async function login(page, urlLogin, username, password) {
  try {
    await page.goto(urlLogin)
    await page.waitForLoadState('networkidle')

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
    await page.waitForNavigation()
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
            rebate: dataRebate[index],
            node_name: dataNodeName[index],
            trading_account: tradingAccount,
            screen_code: 'rebate',
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
  const liApplyReportIndex = 1
  try {
    await page.waitForTimeout(2000)
    // moving to page OrderReportManagementPage
    await page.goto(urlOrder)
    await page.waitForTimeout(3000)

    // fill trading account
    await page.getByRole('textbox').first(5).fill(tradingAccount)

    await page.waitForTimeout(4000)
    await page.locator('[placeholder="Select"]').click()
    await page.waitForTimeout(1000)
    const liElements = await page.$$('li')

    // select "Apply Report" in Search Type Element li
    await liElements[liApplyReportIndex].click()
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
    await page.waitForLoadState('load')

    // fill to date
    await page.locator('[placeholder="To"]').focus()
    await keyboard.down('Control')
    await keyboard.press('A')
    await keyboard.up('Control')
    await keyboard.press('Delete')
    await page.fill('[placeholder="To"]', `${toDate} 00:00:00`) //

    // fill trading account
    await page.waitForTimeout(3000)
    await page.getByRole('textbox').nth(7).fill(tradingAccount)

    // click button APPLY
    const element = await page.$$('.el-form-item__content')
    await element[APPLY_FILTER_DATE_INDEX].click()
    await page.waitForTimeout(4000)

    // get data require
    const parentElements = await page.$$('.table_content_tbody')

    for (const parentElement of parentElements) {
      const childElements = await parentElement.$$('.vxe-body--column')
      const rowContent = []

      for (let i = 0; i < childElements.length; i++) {
        if (i === 0 || i === 2 || i === 4 || i === 5 || i === 6 || i === 7 || i === 12 || i === 15 ) {
          const textContent = await childElements[i].textContent()
          rowContent.push(textContent)
        }
      }
      rowContent.push('order')
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
  const keyValue = ['order_id', 'trading_account', 'open_date', 'order_type', 'symbol', 'volume', 'close_date', 'profit', 'screen_code']
  keyValue.forEach((key, index)=>{
    obj[key] = listData[index]
  })
  return obj
}

module.exports = {
  crawlDataThreeTrader,
}
