const { firefox } = require('playwright')
const { code, message, dateFormat, flag, crawlResMessage, crawlLogMessage, brokerAbbrev } = require('../constant')
const { createResponse, saveCrawlLog } = require('../utils')
const moment = require('moment')
const repository = require('../repository')

let isFunctionActive = false

const crawlDataFxgt = async (req, res) =>{
  let browser
  try {
    // Check if the function is already active
    if (isFunctionActive) {
      return createResponse(res, false, null, code.CONFLICT, message.function_active)
    }
    isFunctionActive = true

    // Respond successfully to customers before data crawl
    res.status(code.SUCCESS).json({ message: crawlResMessage.fxgt })

    const { BROWSER_HEADLESS_MODE, FXGT_USERNAME, FXGT_PASSWORD, FXGT_URL_LOGIN, FXGT_URL_CRAWL } = process.env

    // Get list date
    // const crawlTime = await getCrawlTime(brokerAbbrev.FXGT, FXGT_LIMIT_FIRST_DATE)
    // if (!crawlTime) {
    //   isFunctionActive = false
    //   return
    // }
    const { fromDate, toDate } = req.query

    // init browser
    const browserHeadlessMode = BROWSER_HEADLESS_MODE === 'true'
    browser = await firefox.launch({ headless: browserHeadlessMode, args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
      '--no-first-run', '--no-zygote', '--disable-gpu',
    ] })


    const startCheckClf = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const context = await browser.newContext()
    // pass cloud fare
    await context.addInitScript(() => {
      delete navigator.__proto__.webdriver
    })

    const endCheckClf = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const checkClf = endCheckClf.diff(startCheckClf, 'milliseconds')
    console.log('check and pass clouldflare : ', checkClf, 'milliseconds')

    const page = await context.newPage()
    // login
    const isLogin = await _login(page, FXGT_URL_LOGIN, FXGT_USERNAME, FXGT_PASSWORD)
    if (!isLogin) {
      await saveCrawlLog(brokerAbbrev.FXGT, fromDate, toDate, flag.FALSE, crawlLogMessage.login_error)
      await browser.close()
      isFunctionActive = false
      return
    }

    const listData = await _getDataFxgt(page, FXGT_URL_CRAWL, fromDate, toDate)

    if (!listData) {
      const x = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
      const total = x.diff(startCheckClf, 'milliseconds')
      console.log('Total Time : ', total, 'milliseconds')
      await saveCrawlLog(brokerAbbrev.FXGT, fromDate, toDate, flag.FALSE, crawlLogMessage.cannot_crawl_data)
      isFunctionActive = false
      browser.close()
      return
    }

    if (listData.length === 0) {
      const x = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
      const total = x.diff(startCheckClf, 'milliseconds')
      console.log('Total Time : ', total, 'milliseconds')
      await saveCrawlLog(brokerAbbrev.FXGT, fromDate, toDate, flag.TRUE, crawlLogMessage.data_empty)
      isFunctionActive = false
      browser.close()
      return
    }

    // sort list data by deal_id
    const listDataSorted = listData.sort((a, b) =>{
      const timeA = moment(a.close_time, dateFormat.DATE_TIME)
      const timeB = moment(b.close_time, dateFormat.DATE_TIME)
      if (timeA < timeB) {
        return -1
      } else if (timeA > timeB) {
        return 1
      } else {
        // If the times are equal, sort by deal_id
        return a.deal_id - b.deal_id
      }
    })

    // check if don't have the last value then save it to db
    const lastRecord = await repository.getLastRecordOfPage(brokerAbbrev.FXGT)
    if (!lastRecord) {
      const x = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
      const total = x.diff(startCheckClf, 'milliseconds')
      console.log('Total Time : ', total, 'milliseconds')
      await saveCrawlLog(brokerAbbrev.FXGT, fromDate, toDate, flag.FALSE, crawlLogMessage.save_data_error)
      isFunctionActive = false
      browser.close()
      return
    }

    if (lastRecord.length === 0) {
      const x = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
      const total = x.diff(startCheckClf, 'milliseconds')
      console.log('Total Time : ', total, 'milliseconds')
      // check if don't have the last value then save it to db
      const isInserted = await repository.insertCrawlTransaction(listDataSorted, brokerAbbrev.FXGT, fromDate, toDate)
      if (!isInserted) {
        await saveCrawlLog(brokerAbbrev.FXGT, fromDate, toDate, flag.FALSE, crawlLogMessage.save_data_error )
      }
      isFunctionActive = false
      browser.close()
      return
    }

    const lastRecordTime = moment(lastRecord[0].close_time, dateFormat.DATE_TIME)
    // check have last value and save to db
    const listDataNew = listDataSorted.filter((item) => {
      const itemTime = moment(item.close_time, dateFormat.DATE_TIME)
      if (itemTime.isAfter(lastRecordTime)) {
        return true
      } else if (itemTime.isSame(lastRecordTime) && item.deal_id > lastRecord[0].deal_id) {
        return true
      }
      return false
    })

    if (listDataNew.length === 0) {
      const x = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
      const total = x.diff(startCheckClf, 'milliseconds')
      console.log('Total Time : ', total, 'milliseconds')
      await saveCrawlLog(brokerAbbrev.FXGT, fromDate, toDate, flag.TRUE, crawlLogMessage.no_new_data )
    } else {
      const isInserted = await repository.insertCrawlTransaction(listDataNew, brokerAbbrev.FXGT, fromDate, toDate)
      if (!isInserted) {
        const x = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
        const total = x.diff(startCheckClf, 'milliseconds')
        console.log('Total Time : ', total, 'milliseconds')
        await saveCrawlLog(brokerAbbrev.FXGT, fromDate, toDate, flag.FALSE, crawlLogMessage.save_data_error )
        isFunctionActive = false
        browser.close()
        return
      }
    }
    const x = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const total = x.diff(startCheckClf, 'milliseconds')
    console.log('Total Time : ', total, 'milliseconds')

    await browser.close()
    isFunctionActive = false
    return
  } catch (error) {
    console.log(error)
    if (browser) {
      await browser.close()
    }
    isFunctionActive = false
  }
}

const _login = async (page, FXGT_URL_LOGIN, FXGT_USERNAME, FXGT_PASSWORD)=>{
  try {
    const startLogin = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    await page.goto(FXGT_URL_LOGIN)
    await page.waitForTimeout(4000)

    const endLogin = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const x = endLogin.diff(startLogin, 'milliseconds')
    console.log('loading for login page: ', x, 'milliseconds')

    const startFill = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    await page.fill('#email', FXGT_USERNAME)
    await page.fill('#password', FXGT_PASSWORD)
    await page.waitForTimeout(2000)

    const endFill = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const fillUrs = endFill.diff(startFill, 'milliseconds')
    console.log('time fill username and password: ', fillUrs, 'milliseconds')

    const startClick = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    await page.click('#btn_login')
    await page.waitForTimeout(2000)

    const endClick = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const clickSb = endClick.diff(startClick, 'milliseconds')
    console.log('time click login button: ', clickSb, 'milliseconds')

    // check is dashboard page
    const startCheckDb = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    await page.waitForSelector('#ib-portal')
    await page.waitForTimeout(1000)

    const endCheckdb = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const timeCheckdb = endCheckdb.diff(startCheckDb, 'milliseconds')
    console.log('loading for home page: ', timeCheckdb, 'milliseconds')
    // change language to en
    await page.locator('a#dropdownMenuLink').nth(1).click()
    await page.waitForTimeout(1000)

    await page.locator('[data-url="locale/en"]').nth(1).click()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000)

    return true
  } catch (error) {
    console.log(error)
    return false
  }
}

const _getDataFxgt = async (page, urlCrawl, dateFrom, dateTo)=>{
  try {
    // const dateFromPicker = moment(dateFrom, dateFormat.DATE_TIME).format(dateFormat.DATE_2)
    // const dateToPicker = moment(dateTo, dateFormat.DATE_TIME).format(dateFormat.DATE_2)

    // go to report page
    const startReportPage = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    await page.goto(urlCrawl)
    const endReportPage = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const timeNext = endReportPage.diff(startReportPage, 'milliseconds')
    console.log('time wait for loading crawl page: ', timeNext, 'milliseconds')

    const startLoadDom = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000)


    // open custom modal
    await page.locator('.custom-radio').nth(7).click()
    await page.waitForTimeout(3000)

    const endLoadDom = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const timeLoadDom = endLoadDom.diff(startLoadDom, 'milliseconds')
    console.log('click button "custom"  and wait for loading : ', timeLoadDom, 'milliseconds')
    // fill date picker

    const startFillDate = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    await page.waitForSelector('#startDateFilter', { state: 'visible' })
    await page.fill('#startDateFilter', dateFrom)
    await page.fill('#endDateFilter', dateTo)
    await page.waitForTimeout(1000)

    const endFillDate = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const timeFillDate = endFillDate.diff(startFillDate, 'milliseconds')
    console.log('time fill date: ', timeFillDate, 'milliseconds')
    // filter data

    const startClickGo = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    await page.click('#reportFilterGo')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const endClickGo = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const timeClickGo = endClickGo.diff(startClickGo, 'milliseconds')
    console.log('time click button "go": ', timeClickGo)

    const startChooseOpt = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    await page.selectOption('select[name="reportDataTable_length"]', '5000')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const endChooseOpt = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const timeChoose = endChooseOpt.diff(startChooseOpt, 'milliseconds')
    console.log('time loading show "5000" record per page : ', timeChoose, 'milliseconds')

    const listData = []

    const startGetData = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    while (true) {
      const elements = await page.$$('#reportDataTable tbody tr')
      for (const item of elements) {
        const listText = []
        const transactionObj = {
          broker: brokerAbbrev.FXGT,
        }
        const tds = await item.$$('td')
        for (let i = 0; i < tds.length; i++) {
          if ( [0, 2, 7, 8, 10, 13].includes(i)) {
            const tdText = await tds[i].textContent()
            listText.push(tdText)
          }
          if (i === 1) {
            const tdText = await tds[i].textContent()
            const regex = /MT(\d+)\s*-\s*(\w+)-Live/
            const matches = tdText.match(regex)
            if (matches) {
              const metaNumber = matches[1]
              listText.push(metaNumber)
            }
          }
          if (i === 4) {
            const tdText = await tds[i].textContent()
            const closeTime = moment(tdText, dateFormat.DATE_TIME_4).format(dateFormat.DATE_TIME)
            listText.push(closeTime)
          }
        }
        if (listText.length > 0) {
          _convertDataToObj(listText, transactionObj)
          listData.push(transactionObj)
        }
      }

      const startCheckNextPage = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

      const nextButton = await page.$('li.next')
      const isNextButton = await nextButton.evaluate((btn) => !btn.classList.contains('disabled'))
      if (!isNextButton) {
        break
      }

      await page.waitForSelector('#reportDataTable_next', { visible: true })
      await page.waitForTimeout(1000)

      const endCheckNextPage = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
      const timeCheckNextPage = endCheckNextPage.diff(startCheckNextPage, 'seconds')
      console.log('time CheckNextPage: ', timeCheckNextPage)
      // click next page
      const startClickNextPage = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

      await page.click('#reportDataTable_next')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(3000)

      const endClickNextPage = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
      const timeClickNextPage = endClickNextPage.diff(startClickNextPage, 'seconds')
      console.log('time ClickNextPage: ', timeClickNextPage)
    }
    const endGetData = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const timeGetData = endGetData.diff(startGetData, 'milliseconds')
    console.log('Time crawl data: ', timeGetData, 'milliseconds')

    return listData
  } catch (error) {
    console.log(error)
    return false
  }
}

const _convertDataToObj = (listData, obj) => {
  const keyValue = [
    'deal_id', 'platform', 'account', 'close_time', 'symbol', 'account_type',
    'volume', 'reward_per_trade',
  ]
  keyValue.forEach((key, index) => {
    obj[key] = listData[index]
  })
  return obj
}
module.exports = {
  crawlDataFxgt,
}
