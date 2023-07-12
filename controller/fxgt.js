const { firefox } = require('playwright')
const { code, message, dateFormat, flag, crawlResMessage, crawlLogMessage, brokerAbbrev } = require('../constant')
const { createResponse, saveCrawlLog, getCrawlTime } = require('../utils')
const moment = require('moment')
const pidusage = require('pidusage');
const {createPool} = require('generic-pool')
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

    const { BROWSER_HEADLESS_MODE, FXGT_USERNAME, FXGT_PASSWORD, FXGT_URL_LOGIN, FXGT_URL_CRAWL, FXGT_LIMIT_FIRST_DATE } = process.env

    // Get list date
    // const crawlTime = await getCrawlTime(brokerAbbrev.FXGT, FXGT_LIMIT_FIRST_DATE)
    // if (!crawlTime) {
    //   isFunctionActive = false
    //   return
    // }


    // init browser
    const browserHeadlessMode = BROWSER_HEADLESS_MODE === 'true'
    browser = await firefox.launch({ headless: browserHeadlessMode, args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
      '--no-first-run', '--no-zygote', '--disable-gpu',
    ] })

    const context = await browser.newContext()
    
    // pass cloud fare
    await context.addInitScript(() => {
      delete navigator.__proto__.webdriver
    })
    const maxContextr = 5
    const pool = await createPool(browser,{
      browser: browser,
      contextOptions: context,
      max:maxContextr,
    })

    const browserPool = await pool.acquire()
    const page = await browserPool.newPage()

    pidusage(process.pid, (err, stat) => {
      if (err) {
        console.error('Lỗi khi lấy thông tin sử dụng tài nguyên:', err);
        return;
      }
    
      setInterval(() => {
        pidusage(process.pid, (err, stat) => {
          if (err) {
            console.error('Lỗi khi lấy thông tin sử dụng tài nguyên:', err);
            return;
          }
    
          console.log('CPU usage:', stat.cpu);
          console.log('Memory usage:', stat.memory);
        });
      }, 1000);
    });

    // login
    const isLogin = await _login(page, FXGT_URL_LOGIN, FXGT_USERNAME, FXGT_PASSWORD)
    if (!isLogin) {
      // await saveCrawlLog(brokerAbbrev.FXGT, fromDate, toDate, flag.FALSE, crawlLogMessage.login_error)
      await browser.close()
      await pool.close()
      isFunctionActive = false
      return
    }
    const { fromDate, toDate } = req.query

    const listData = await _getDataFxgt(page, FXGT_URL_CRAWL, fromDate, toDate)
    if (!listData) {
    //   await saveCrawlLog(brokerAbbrev.FXGT, fromDate, toDate, flag.FALSE, crawlLogMessage.cannot_crawl_data)
      isFunctionActive = false
      browser.close()
      // await browserPool.close()
      return
    }

    if (listData.length === 0) {
      // await saveCrawlLog(brokerAbbrev.FXGT, fromDate, toDate, flag.TRUE, crawlLogMessage.data_empty)
      isFunctionActive = false
      browser.close()
      // await browserPool.close()
      return
    }

    

    await browser.close()
    // await browserPool.close()
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
    await page.goto(FXGT_URL_LOGIN)
    await page.waitForTimeout(4000)

    await page.fill('#email', FXGT_USERNAME)
    await page.fill('#password', FXGT_PASSWORD)
    await page.waitForTimeout(2000)

    await page.click('#btn_login')
    await page.waitForSelector('#ib-portal')

    return true
  } catch (error) {
    console.log(error)
    return false
  }
}

const _getDataFxgt = async (page, urlCrawl, dateFrom, dateTo)=>{
  try {

    // get data
    // const dateFromPicker = moment(dateFrom, dateFormat.DATE_TIME).format(dateFormat.DATE_2)
    // const dateToPicker = moment(dateTo, dateFormat.DATE_TIME).format(dateFormat.DATE_2)

    await page.waitForTimeout(3000)
    // await page.locator('.dropdown-toggle').nth(2).click()
    // await page.locator('[data-url="locale/en"]').nth(1).click()
    await page.waitForLoadState('domcontentloaded')

    await page.goto(urlCrawl)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // get date
    await page.locator('.custom-radio').nth(7).click()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    await page.fill('#startDateFilter', dateFrom)
    await page.fill('#endDateFilter', dateTo)
    await page.click('#reportFilterGo')
    await page.waitForLoadState('domcontentloaded')

    await page.selectOption('select[name="reportDataTable_length"]', '5000')
    await page.waitForLoadState('domcontentloaded')

    const listData = []
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
            // const closeTime = moment(tdText, dateFormat.DATE_TIME_4).format(dateFormat.DATE_TIME)
            listText.push(tdText)
          }
        }
        if (listText.length > 0) {
          _convertDataToObj(listText, transactionObj)
          listData.push(transactionObj)
        }
      }
      const nextButton = await page.$('li.next')
      const isNextButton = await nextButton.evaluate((btn) => !btn.classList.contains('disabled'))
      if (!isNextButton) {
        break
      }

      await page.waitForTimeout(3000)
      await page.waitForSelector('#reportDataTable_next', { visible: true, timeout: 30000 })
      await page.click('#reportDataTable_next')

      await page.waitForLoadState('domcontentloaded')
    }
    
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
