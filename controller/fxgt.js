const { firefox } = require('playwright')
const { code, message, dateFormat, flag, crawlResMessage, crawlLogMessage, modeAPI, brokerAbbrev } = require('../constant')
const { createResponse, saveCrawlLog, getListDays } = require('../utils')
const moment = require('moment')
const repository = require('../repository')

let isFunctionActive = false

const crawlDataFxgt = async (req, res) =>{
  const browserHeadlessMode = process.env.BROWSER_HEADLESS_MODE === 'true'
  const browser = await firefox.launch({ headless: browserHeadlessMode })
  try {
    // Check if the function is already active
    if (isFunctionActive) {
      return createResponse(res, false, null, code.CONFLICT, message.function_active)
    }
    isFunctionActive = true

    // Respond successfully to customers before data crawl
    res.status(code.SUCCESS).json({ message: crawlResMessage.fxgt })

    // query
    // const { dateFrom, dateTo } = req.query
    const { FXGT_USERNAME, FXGT_PASSWORD, FXGT_URL_LOGIN, FXGT_URL_CRAWL, FXGT_LIMIT_FIRST_DATE } = process.env

    // Get list date
    let listDate = []
    if (req.query.mode === modeAPI.MANUAL) {
      const { dateFrom, dateTo } = req.query
      const isErrorDate = await repository.isExistDayError(brokerAbbrev.FXGT, dateFrom, dateTo)
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
      const yesterdayDate = moment().subtract(1, 'days').format(dateFormat.DATE_2)
      const isFirstRunning = await repository.notExistDataOfPage(brokerAbbrev.FXGT)
      if (isFirstRunning) {
        listDate.push({
          fromDate: moment(FXGT_LIMIT_FIRST_DATE, dateFormat.DATE_2).format(dateFormat.DATE_2),
          toDate: yesterdayDate,
        })
      } else {
        listDate = await getListDays(yesterdayDate, yesterdayDate, brokerAbbrev.FXGT)
      }
    }
    const context = await browser.newContext()
    // pass clouldfare
    await context.addInitScript(() => {
      delete navigator.__proto__.webdriver
    })

    const page = await context.newPage()
    // login
    const isLogin = await login(page, FXGT_URL_LOGIN, FXGT_USERNAME, FXGT_PASSWORD)

    if (!isLogin) {
      const yesterdayDate = moment().subtract(1, 'days').format(dateFormat.DATE)
      await saveCrawlLog(brokerAbbrev.FXGT, yesterdayDate, yesterdayDate, flag.FALSE, crawlLogMessage.reading_file_error)
      await browser.close()
      isFunctionActive = false
      return
    }

    await page.waitForTimeout(4000)

    // get data
    for (const obj of listDate) {
      await getDataFxgt(page, FXGT_URL_CRAWL, obj.fromDate, obj.toDate)
    }

    await browser.close()
    isFunctionActive = false
    return
  } catch (error) {
    console.log(error)
    await browser.close()
    isFunctionActive = false
    return
  }
}

const login = async (page, FXGT_URL_LOGIN, FXGT_USERNAME, FXGT_PASSWORD)=>{
  try {
    await page.goto(FXGT_URL_LOGIN)
    await page.waitForTimeout(3000)

    await page.fill('#email', FXGT_USERNAME)
    await page.fill('#password', FXGT_PASSWORD)

    // await setAgents(page)
    await page.waitForTimeout(3000)
    await page.click('#btn_login')

    await page.waitForTimeout(3000)


    return true
  } catch (error) {
    console.log(error)
    return false
  }
}

const getDataFxgt = async (page, FXGT_URL_CRAWL, dateFrom, dateTo)=>{
  try {
    await page.waitForTimeout(3000)

    await page.goto(FXGT_URL_CRAWL)
    await page.waitForTimeout(3000)
    // get date
    await page.locator('.custom-radio').nth(7).click()

    await page.fill('#startDateFilter', dateFrom)

    await page.fill('#endDateFilter', dateTo)


    await page.click('#reportFilterGo')
    await page.waitForLoadState('domcontentloaded')

    await page.selectOption('select[name="reportDataTable_length"]', '5000')

    await page.waitForLoadState('domcontentloaded')

    while (true) {
      const elements = await page.$$('#reportDataTable tbody tr')
      await page.waitForLoadState('domcontentloaded')

      for (const item of elements) {
        const listText = []

        const tds = await item.$$('td')
        for (let i = 0; i < tds.length; i++) {
          if ( i === 0 || i === 1 || i === 2 || i === 4 || i === 7 || i === 8 || i === 10 || i === 13) {
            const tdText = await tds[i].textContent()
            listText.push(tdText)
          }
        }
        console.log(listText)
      }
      const nextButton = await page.$('li.next')
      const isNextButton = await nextButton.evaluate((btn) => !btn.classList.contains('disabled'))
      if (!isNextButton) {
        break
      }
      await page.waitForSelector('#reportDataTable_next', { visible: true, timeout: 30000 })
      await page.click('#reportDataTable_next')

      await page.waitForLoadState('domcontentloaded')
    }
  } catch (error) {
    console.log(error)
  }
}
module.exports = {
  crawlDataFxgt,
}
