const { chromium } = require('playwright')
const { code, message, dateFormat, flag, resMessage, scrapLogMessage, modeAPI } = require('../constant')
const { createResponse, readingConfigIni, saveScrapLog, getListDays } = require('../utils')
const moment = require('moment')

const repository = require('../repository')

const querystring = require('querystring')

let isFunctionActive = false
const URL_PAGE = 'exness'
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
    res.status(code.SUCCESS).json({ message: resMessage.exness })

    // get page config ini
    const iniConfig = await readingConfigIni()
    if (!iniConfig) {
      const dateNow = moment().format(dateFormat.DATE)
      await saveScrapLog(URL_PAGE, dateNow, dateNow, flag.FALSE, scrapLogMessage.reading_file_error)
      await browser.close()
      isFunctionActive = false
      return
    }
    const { USERNAME, PASSWORD, URL_LOGIN, URL_CRAWL_REWARDS, URL_CRAWL_ORDER, LIMIT_FIRST_DATE } = iniConfig.EXNESS

    // Get list date
    let listDate = []
    if (req.query.mode === modeAPI.MANUAL) {
      const { dateFrom, dateTo } = req.query
      const isErrorDate = repository.isExistDayError(URL_PAGE, dateFrom, dateTo)
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
      const isFirstRunning = repository.isExistDataOfPage(URL_PAGE)
      if (isFirstRunning) {
        listDate.push({
          fromDate: LIMIT_FIRST_DATE,
          toDate: yesterdayDate,
        })
      } else {
        listDate = getListDays(yesterdayDate, yesterdayDate, URL_PAGE)
      }
    }

    // login
    const context = await browser.newContext()
    const page = await context.newPage()
    const isLogin = await login(page, URL_LOGIN, USERNAME, PASSWORD)
    if (!isLogin) {
      const dateNow = moment().format(dateFormat.DATE)
      await saveScrapLog(URL_PAGE, dateNow, dateNow, flag.FALSE, scrapLogMessage.login_error)
      await browser.close()
      isFunctionActive = false
      return createResponse(res, false, null, code.ERROR, message.cannot_login_page)
    }

    // const listDate = [{
    //   fromDate: '2023-05-20',
    //   toDate: '2023-05-20',
    // }]
const listDateAuto = calculateDateRanges();

    for (const {start,end} of listDateAuto) {
      // TODO plus 1 day to obj.fromDate, obj.toDate
      const queryParams = {
        'reward_date_from': start,
        'reward_date_to': end,
        'sorting[reward_date]': 'DESC',
        'page': 0,
        'limit': 4,
      }

      // Crawl data from page
      await getDataExness(page, URL_CRAWL_REWARDS, URL_CRAWL_ORDER, queryParams)
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

// login
async function login(page, urlLogin, username, password) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    await page.goto(urlLogin)
    await page.waitForLoadState('networkidle')
    await page.click('[data-auto="language_switcher_button"]')

    await page.click('#language_select_values_en > ._1Fc6m')


    await page.fill('input[name = "login"]', username)
    await page.fill('input[name = "password"]', password)


    await page.click('#mui-1')
    await page.waitForNavigation()
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

// getData
async function getDataExness(page, urlCrawlRewards, urlCrawlOrder, queryParams) {
  try {
    const listData = []
    const { reward_date_from, reward_date_to } = queryParams

    const queryString = querystring.stringify(queryParams)
    const urlReportRewards = `${urlCrawlRewards}/?${queryString}`
    await page.goto(urlReportRewards)

   await page.waitForTimeout(3000)

    const listAccountInfo = []
    while (true) {
      const parentElements = await page.$$('div[data-auto="row"]')
      if (parentElements.length === 0) {
        await saveScrapLog(URL_PAGE, reward_date_from, reward_date_to, flag.TRUE, scrapLogMessage.data_empty)
        return
      }

      for (const child of parentElements) {
        const accountInfo = {}
        const preElement = await child.$$('pre')
        for (let index = 0; index < preElement.length; index++) {
          switch (index) {
            case 0:
              accountInfo.date = await preElement[index].textContent()
            case 7:
              accountInfo.accountId = await preElement[index].textContent()
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
      const initialDate = moment(accountInfo.date, 'DD MMM YYYY').format('YYYY-MM-DD')
      const initialDatePath = `initial_start_day/${initialDate}/initial_end_day/${initialDate}/`
      const dateFilter = `date_from=${initialDate}&date_to=${initialDate}`
      const urlReportOrders = `${urlCrawlOrder}/${initialDatePath}?${dateFilter}&client_account=${accountInfo.accountId}`
      await page.goto(urlReportOrders)
      await page.waitForTimeout(3000)

      const getUsd = await page.getByText('USDJPYm').first().textContent()
      await page.waitForTimeout(2000)

      const listDetailElements = await page.$$('div.ke3xz div._2i-_7 div._2WW5r div._3SxZ6')
      for (const detailElement of listDetailElements) {
        const transactionObj = {
          account_id: accountInfo.accountId,
          account_type: accountInfo.accountType,
          instrument: getUsd,
        }
        const click = await detailElement.$('span._1ZDRI')
        await click.click()
        await detailElement.waitForSelector('div._2fam6', { state: 'visible' })
        await page.waitForTimeout(3000)
        const result = await detailElement.$eval('div._2pyAa', (element) => element.textContent)

        convertStringToObj(result, transactionObj)
        listData.push(transactionObj)

        await page.waitForTimeout(3000)
      }
    }

    // save to db
    if (listData.length === 0) {
      await saveScrapLog(URL_PAGE, reward_date_from, reward_date_to, flag.TRUE, scrapLogMessage.data_empty)
    } else {
      const isInsertExness = await repository.insertScrapExness(listData, reward_date_from, reward_date_to)
      if (!isInsertExness) {
        await saveScrapLog(URL_PAGE, reward_date_from, reward_date_to, flag.FALSE, scrapLogMessage.save_data_error )
      }
    }
    return
  } catch (error) {
    console.error(error)
    await saveScrapLog(URL_PAGE, queryParams.reward_date_from, queryParams.reward_date_to, flag.FALSE, scrapLogMessage.cannot_crawl_data)
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
    const volumeLots = volumeMatch ? volumeMatch[1].trim() + ' ' + 'Lots' : null
    const volumeMlnMatch = data.match(/Lots(.+?)Mln\. USD/)
    const volumeMln = volumeMlnMatch ? volumeMlnMatch[1].trim() + ' ' + 'Mln. USD' : null

    transactionObj.order_in_mt = orderMatch ? orderMatch[1] : null
    transactionObj.profit = profitMatch ? profitMatch[1].trim() : null
    transactionObj.open_date = openTimeMatch ? moment(openTimeMatch[1].trim(), dateFormat.DATE_TIME_3).format(dateFormat.DATE_TIME) : null
    transactionObj.close_date = closeTimeMatch ? moment(closeTimeMatch[1].trim(), dateFormat.DATE_TIME_3).format(dateFormat.DATE_TIME) : null
    transactionObj.volume_lots = volumeLots
    transactionObj.volume_mln_usd = volumeMln
  } catch (error) {
    console.error(error)
  }
}
//get date previous
function calculateDateRanges() {
  const today = moment().subtract(1, 'day'); // return 1 day with today
  const finalEndDate = moment("2023-01-01");
  const queryParamsList = [];
  let endDate = moment(today);

  while (endDate.diff(finalEndDate, 'days') >= 0) { // check endDate
    const startDate = moment(endDate).subtract(6, 'days'); //last week

    queryParamsList.push({
      start: moment.max(startDate, finalEndDate).format("YYYY-MM-DD"), // select max days after startDate and finalEndDate
      end: endDate.format("YYYY-MM-DD")
    });

    

    endDate = moment(startDate).subtract(1, 'day'); // return 1 day create new endDate
  }

  return queryParamsList;
}
module.exports = {
  crawlDataExness,
}
