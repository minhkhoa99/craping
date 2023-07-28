const { chromium } = require('playwright')
const { code, message, dateFormat, flag, crawlResMessage, crawlLogMessage, brokerAbbrev } = require('../constant')
const { createResponse, saveCrawlLog } = require('../utils')
const moment = require('moment')

const repository = require('../repository')

const querystring = require('querystring')

let isFunctionActive = false
const NEXT_PAGE_BUTTON_INDEX = 4

async function crawlDataExness(req, res) {
  let browser
  try {
    // Check if the function is already active
    if (isFunctionActive) {
      return createResponse(res, false, null, code.CONFLICT, message.function_active)
    }
    isFunctionActive = true

    // Respond successfully to customers before data crawl
    res.status(code.SUCCESS).json({ message: crawlResMessage.exness })

    const {
      BROWSER_HEADLESS_MODE, EXNESS_USERNAME, EXNESS_PASSWORD, EXNESS_URL_LOGIN,
      EXNESS_URL_CRAWL_REWARDS, EXNESS_URL_CRAWL_ORDER,
    } = process.env

    // Get crawl time
    // const crawlTime = await getCrawlTime(brokerAbbrev.EXNESS, EXNESS_LIMIT_FIRST_DATE)
    // if (!crawlTime) {
    //   isFunctionActive = false
    //   return
    // }
    const { fromDate, toDate } = req.query

    // init browser
    const browserHeadlessMode = BROWSER_HEADLESS_MODE === 'true'
    browser = await chromium.launch({ headless: browserHeadlessMode, args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
      '--no-first-run', '--no-zygote', '--disable-gpu',
    ] })

    // login
    const context = await browser.newContext()
    const page = await context.newPage()
    const isLogin = await _login(page, EXNESS_URL_LOGIN, EXNESS_USERNAME, EXNESS_PASSWORD)
    if (!isLogin) {
      await saveCrawlLog(brokerAbbrev.EXNESS, fromDate, toDate, flag.FALSE, crawlLogMessage.login_error)
      await browser.close()
      isFunctionActive = false
      return
    }

    // Crawl data from page
    const listData = await _getDataExness(page, EXNESS_URL_CRAWL_REWARDS, EXNESS_URL_CRAWL_ORDER, fromDate, toDate)
    if (!listData) {
      await saveCrawlLog(brokerAbbrev.EXNESS, fromDate, toDate, flag.FALSE, crawlLogMessage.cannot_crawl_data)
      await browser.close()
      isFunctionActive = false
      return
    }

    // save to db
    if (listData.length === 0) {
      await saveCrawlLog(brokerAbbrev.EXNESS, fromDate, toDate, flag.TRUE, crawlLogMessage.data_empty)
      await browser.close()
      isFunctionActive = false
      return
    }
    // sort list data by deal_id
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

    // get last value in database
    const lastRecord = await repository.getLastRecordOfPage(brokerAbbrev.EXNESS)
    if (!lastRecord) {
      await saveCrawlLog(brokerAbbrev.EXNESS, fromDate, toDate, flag.FALSE, crawlLogMessage.save_data_error)
      await browser.close()
      isFunctionActive = false
      return
    }

    if (lastRecord.length === 0) {
      // check if don't have the last value then save it to db
      const isInserted = await repository.insertCrawlTransaction(listDataSorted, brokerAbbrev.EXNESS, fromDate, toDate)
      if (!isInserted) {
        await saveCrawlLog(brokerAbbrev.EXNESS, fromDate, toDate, flag.FALSE, crawlLogMessage.save_data_error)
      }
      await browser.close()
      isFunctionActive = false
      return
    }
    const lastRecordTime = moment(lastRecord[0].close_time, dateFormat.DATE_TIME)
    // check have last value and save to db
    // get index exist or not in list data
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
      await saveCrawlLog(brokerAbbrev.EXNESS, fromDate, toDate, flag.TRUE, crawlLogMessage.no_new_data)
    } else {
      const isInserted = await repository.insertCrawlTransaction(listDataNew, brokerAbbrev.EXNESS, fromDate, toDate)
      if (!isInserted) {
        await saveCrawlLog(brokerAbbrev.EXNESS, fromDate, toDate, flag.FALSE, crawlLogMessage.save_data_error)
      }
    }

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

// login
async function _login(page, urlLogin, username, password) {
  try {
    const gotoPage = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    await page.goto(urlLogin)
    const endLogin = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const x = endLogin.diff(gotoPage, 'seconds')
    console.log('goto page: ', x)

    await page.waitForLoadState('domcontentloaded')

    await page.click('[data-auto="language_switcher_button"]')
    await page.click('#language_select_values_en > ._1Fc6m')
    await page.waitForTimeout(2000)

    const getLogin = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    await page.fill('input[name = "login"]', username)
    await page.fill('input[name = "password"]', password)
    await page.waitForTimeout(1000)
    const endGetInf = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const fill = endGetInf.diff(getLogin, 'seconds')
    console.log('click usr pss: ', fill)

    const clickSb = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    await page.click('#mui-2')


    await page.waitForSelector('#menu-item-reports')
    const click = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const sb = click.diff(clickSb, 'seconds')
    console.log('click submit: ', sb)
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

// getData
async function _getDataExness(page, urlCrawlRewards, urlCrawlOrder, fromDate, toDate) {
  try {
    const listData = []
    const queryParams = {
      'reward_date_from': moment(fromDate, dateFormat.DATE_TIME).format(dateFormat.DATE),
      'reward_date_to': moment(toDate, dateFormat.DATE_TIME).format(dateFormat.DATE),
      'sorting[reward_date]': 'DESC',
      'page': 0,
      'limit': 10,
    }
    const queryString = querystring.stringify(queryParams)
    const urlReportRewards = `${urlCrawlRewards}/?${queryString}`

    const gotoURLCrwl = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    await page.goto(urlReportRewards)
    const endGoto = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const nextPage = endGoto.diff(gotoURLCrwl, 'seconds')
    console.log('go to url crawl record: ', nextPage)


    const loadDom = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

    await page.waitForLoadState('domcontentloaded')

    const endLoadDom = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const domLoaded = endLoadDom.diff(loadDom, 'seconds')
    console.log('load dom: ', domLoaded)
    const listAccountInfo = []

    const getListAccount = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

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
      await page.evaluate(()=>{
        const els = document.querySelectorAll('div._28HMx div.pcHFO [target="_self"] svg._31SPq')
        els[els.length - 2].setAttribute('id', 'btn-next')
      })

      await page.click('#btn-next')
      await page.waitForTimeout(4000)
    }

    const endGetList = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
    const timeGetList = endGetList.diff(getListAccount, 'seconds')
    console.log('get list acc: ', timeGetList)


    for (const accountInfo of listAccountInfo) {
      const gotoPageRecord = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

      const isLogin = await page.$('#login') !== null
      if (isLogin) {
        const time = moment().format(dateFormat.DATE_TIME_3)
        throw new Error(crawlLogMessage.maintenance_server + ` [${time}]`)
      }
      // Custom report orders url from account info
      const initialDate = moment(accountInfo.date, dateFormat.DATE_2).format(dateFormat.DATE)
      const initialDatePath = `initial_start_day/${initialDate}/initial_end_day/${initialDate}/`
      const dateFilter = `date_from=${initialDate}&date_to=${initialDate}`
      const urlReportOrders = `${urlCrawlOrder}/${initialDatePath}?${dateFilter}&client_account=${accountInfo.accountId}`
      await page.goto(urlReportOrders)
      await page.waitForLoadState('domcontentloaded')

      const endGoto = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
      const timeGoto = endGoto.diff(gotoPageRecord, 'seconds')
      console.log('go to url record: ', timeGoto)

      const getDataRecord = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

      while (true) {
        let getElementTimeRetry = 1

        const loadDomListRecord = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

        let listDetailElements = await page.$$('div.ke3xz div._2i-_7 div._2WW5r div._3SxZ6')
        while (getElementTimeRetry <= 3 && listDetailElements.length === 0) {
          getElementTimeRetry++
          await page.waitForTimeout(3000)
          listDetailElements = await page.$$('div.ke3xz div._2i-_7 div._2WW5r div._3SxZ6')
        }
        const endLoaded = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
        const timeLoaded = endLoaded.diff(loadDomListRecord, 'seconds')
        console.log('time loadDom Record: ', timeLoaded)


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


          _convertStringToObj(result, transactionObj)
          listData.push(transactionObj)
        }


        const checkNextPage = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

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
        const endCheckPage = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
        const timeCheckPage = endCheckPage.diff(checkNextPage, 'seconds')
        console.log('time check nextPage: ', timeCheckPage)

        const nextPage = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')

        const nextPageButton = (await page.$$('div._28HMx div.pcHFO [target="_self"] svg._31SPq._2SfaR'))[NEXT_PAGE_BUTTON_INDEX]
        await nextPageButton.click()
        await page.waitForTimeout(4000)
        const endNextPage = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
        const timeNextPage = endNextPage.diff(nextPage, 'seconds')
        console.log('time nextPage: ', timeNextPage)
      }
      const endCrawl = moment(moment(), 'YYYY-MM-DDTHH:mm:ssZ')
      const timeCrl = endCrawl.diff(getDataRecord, 'seconds')
      console.log('time Crawl: ', timeCrl)
    }


    return listData
  } catch (error) {
    console.log(error)
    return false
  }
}

// convert data
function _convertStringToObj(data, transactionObj) {
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
