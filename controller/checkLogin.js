const { chromium } = require('playwright')
const { code, message, dateFormat, flag, crawlResMessage, crawlLogMessage, brokerAbbrev, modeAPI } = require('../constant')
const { createResponse, saveCrawlLog, getListDays } = require('../utils')
const moment = require('moment')

const repository = require('../repository')

const querystring = require('querystring')

let isFunctionActive = false
const NEXT_PAGE_BUTTON_INDEX = 4

async function crawlDataExness(req, res) {
  const browserHeadlessMode = process.env.BROWSER_HEADLESS_MODE === 'true'
  const browser = await chromium.launch({ headless: browserHeadlessMode })
  try {
    // Check if the function is already active
    if (isFunctionActive) {
      return createResponse(res, false, null, code.CONFLICT, message.function_active)
    }
    isFunctionActive = true

    // Respond successfully to customers before data crawl
    res.status(code.SUCCESS).json({ message: crawlResMessage.exness })

    const {
      EXNESS_USERNAME, EXNESS_PASSWORD, EXNESS_URL_LOGIN, EXNESS_URL_CRAWL_REWARDS,
      EXNESS_URL_CRAWL_ORDER, EXNESS_LIMIT_FIRST_DATE,
    } = process.env

    // Get list date
    let listDate = []
    if (req.query.mode === modeAPI.MANUAL) {
      const { dateFrom, dateTo } = req.query
      const isErrorDate = await repository.isExistDayError(brokerAbbrev.EXNESS, dateFrom, dateTo)
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
      const isFirstRunning = await repository.notExistDataOfPage(brokerAbbrev.EXNESS)
      if (isFirstRunning) {
        listDate.push({
          fromDate: EXNESS_LIMIT_FIRST_DATE,
          toDate: yesterdayDate,
        })
      } else {
        listDate = await getListDays(yesterdayDate, yesterdayDate, brokerAbbrev.EXNESS)
      }
    }

    // login
    const context = await browser.newContext()
    const page = await context.newPage()
    const isLogin = await login(page, EXNESS_URL_LOGIN, EXNESS_USERNAME, EXNESS_PASSWORD)
    if (!isLogin) {
      const yesterdayDate = moment().subtract(1, 'days').format(dateFormat.DATE)
      await saveCrawlLog(brokerAbbrev.EXNESS, yesterdayDate, yesterdayDate, flag.FALSE, crawlLogMessage.login_error)
      await browser.close()
      isFunctionActive = false
      return
    }

    for (const obj of listDate) {
      const dateFromPicker = moment(obj.fromDate, dateFormat.DATE).add(1, 'days').format(dateFormat.DATE)
      const dateToPicker = moment(obj.toDate, dateFormat.DATE).add(1, 'days').format(dateFormat.DATE)
      const queryParams = {
        'reward_date_from': dateFromPicker,
        'reward_date_to': dateToPicker,
        'sorting[reward_date]': 'DESC',
        'page': 0,
        'limit': 5,
      }

      // Crawl data from page
      await getDataExness(page, EXNESS_URL_CRAWL_REWARDS, EXNESS_URL_CRAWL_ORDER, queryParams, obj.fromDate, obj.toDate)
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

// login
async function login(page, urlLogin, username, password) {
  try {
    await page.goto(urlLogin)
    await page.waitForLoadState('domcontentloaded')

    await page.click('[data-auto="language_switcher_button"]')
    await page.click('#language_select_values_en > ._1Fc6m')

    await page.fill('input[name = "login"]', username)
    await page.fill('input[name = "password"]', password)
    await page.click('#mui-1')
    await page.waitForLoadState('domcontentloaded')
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

// getData
async function getDataExness(page, urlCrawlRewards, urlCrawlOrder, queryParams, fromDate, toDate) {
  try {
    const listData = []
    const queryString = querystring.stringify(queryParams)
    const urlReportRewards = `${urlCrawlRewards}/?${queryString}`
    await page.goto(urlReportRewards)
    await page.waitForLoadState('domcontentloaded')

    const listAccountInfo = []
    while (true) {
      let getParentElementTimeRetry = 1
      let parentElements = await page.$$('div[data-auto="row"]')
      while (getParentElementTimeRetry <= 3 && parentElements.length === 0) {
        getParentElementTimeRetry++
        await page.waitForTimeout(3000)
        parentElements = await page.$$('div[data-auto="row"]')
      }

      for (const child of parentElements) {
        const accountInfo = {}
        const preElement = await child.$$('pre')
        for (let index = 0; index < preElement.length; index++) {
          switch (index) {
            case 0:
              accountInfo.date = await preElement[index].textContent()
            case 7:
              const rawAccountId = await preElement[index].textContent()
              const convertAccountId = rawAccountId.replace(/\D/g, '')
              accountInfo.accountId = convertAccountId
            case 8:
              accountInfo.accountType = await preElement[index].textContent()
            default:
              continue
          }
        }
        listAccountInfo.push(accountInfo)
      }
      // Check has pagination
      const countPaginationDiv = await page.locator('.pcHFO').count()
      if (countPaginationDiv < 2) {
        break
      }

      // Check is last page
      const isLastPage = await page.evaluate(async ()=>{
        const LIMIT_NEXT_PAGE_INDEX = 19
        const nextButton = document.getElementsByClassName('WlV1S')
        return nextButton[LIMIT_NEXT_PAGE_INDEX].classList.contains('_3cmGt')
      })
      if (isLastPage) {
        break
      }
      const nextPageButton = (await page.$$('div._28HMx div.pcHFO [target="_self"] svg._31SPq'))[NEXT_PAGE_BUTTON_INDEX]
      await nextPageButton.click()
      await page.waitForTimeout(4000)
    }

    for (const accountInfo of listAccountInfo) {
      // Custom report orders url from account info
      const initialDate = moment(accountInfo.date, dateFormat.DATE_2).format(dateFormat.DATE)
      const initialDatePath = `initial_start_day/${initialDate}/initial_end_day/${initialDate}/`
      const dateFilter = `date_from=${initialDate}&date_to=${initialDate}`
      const urlReportOrders = `${urlCrawlOrder}/${initialDatePath}?${dateFilter}&client_account=${accountInfo.accountId}`
      await page.goto(urlReportOrders)
      await page.waitForLoadState('domcontentloaded')

      while (true) {
        let getElementTimeRetry = 1
        let listDetailElements = await page.$$('div.ke3xz div._2i-_7 div._2WW5r div._3SxZ6')
        while (getElementTimeRetry <= 3 && listDetailElements.length === 0) {
          getElementTimeRetry++
          await page.waitForTimeout(3000)
          listDetailElements = await page.$$('div.ke3xz div._2i-_7 div._2WW5r div._3SxZ6')
        }

        for (const detailElement of listDetailElements) {
          const transactionObj = {
            broker: brokerAbbrev.EXNESS,
            account: accountInfo.accountId,
            account_type: accountInfo.accountType,
          }
          const getUsd = await page.locator('._1F2B0 pre').nth(2).textContent()
          transactionObj.symbol = getUsd

          const click = await detailElement.$('span._1ZDRI')
          await click.click()
          await detailElement.waitForSelector('div._2fam6', { state: 'visible' })
          await page.waitForTimeout(3000)
          const result = await detailElement.$eval('div._2pyAa', (element) => element.textContent)

          convertStringToObj(result, transactionObj)
          listData.push(transactionObj)
        }

        const countPaginationDiv = await page.locator('.pcHFO').count()
        if (countPaginationDiv < 2) {
          break
        }

        const isLastPage = await page.evaluate(async ()=>{
          const LIMIT_NEXT_PAGE_INDEX = 19
          const nextButton = document.getElementsByClassName('WlV1S')
          return nextButton[LIMIT_NEXT_PAGE_INDEX].classList.contains('_3cmGt')
        })
        if (isLastPage) {
          break
        }
        const nextPageButton = (await page.$$('div._28HMx div.pcHFO [target="_self"] svg._31SPq'))[NEXT_PAGE_BUTTON_INDEX]
        await nextPageButton.click()
        await page.waitForTimeout(4000)
      }
    }

    // save to db
    if (listData.length === 0) {
      await saveCrawlLog(brokerAbbrev.EXNESS, fromDate, toDate, flag.TRUE, crawlLogMessage.data_empty)
    } else {
      const isInsertCrawlTransaction = await repository.insertCrawlTransaction(listData, brokerAbbrev.EXNESS, fromDate, toDate)
      if (!isInsertCrawlTransaction) {
        await saveCrawlLog(brokerAbbrev.EXNESS, fromDate, toDate, flag.FALSE, crawlLogMessage.save_data_error )
      }
    }
    return
  } catch (error) {
    console.log(error)
    await saveCrawlLog(brokerAbbrev.EXNESS, fromDate, toDate, flag.FALSE, crawlLogMessage.cannot_crawl_data)
    return
  }
}

// convert data
function convertStringToObj(data, transactionObj) {
  try {
    const orderMatch = data.match(/Order in MT(\d+)/)
    const openTimeMatch = data.match(/Open time(.+?)Close time/)
    const closeTimeMatch = data.match(/Close time(.+?)Tick History/)
    const volumeMatch = data.match(/Volume(.+?)Lots/)
    const profitMatch = data.match(/Profit(.+)/)
    const volume = volumeMatch ? volumeMatch[1].trim() : null

    transactionObj.deal_id = orderMatch ? orderMatch[1].replace(/\D/g, '').trim() : null
    transactionObj.reward_per_trade = profitMatch ? profitMatch[1].replace(/[^\d.-]/g, '').trim() : null
    transactionObj.open_time = openTimeMatch ? moment(openTimeMatch[1].trim(), dateFormat.DATE_TIME_3).format(dateFormat.DATE_TIME) : null
    transactionObj.close_time = closeTimeMatch ? moment(closeTimeMatch[1].trim(), dateFormat.DATE_TIME_3).format(dateFormat.DATE_TIME) : null
    transactionObj.volume = volume
  } catch (error) {
    console.error(error)
  }
}
module.exports = {
  crawlDataExness,
}
