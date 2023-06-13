const { flag } = require('../constant')
const db = require('../services/db.service')

async function getTokenbyId(userId) {
  try {
    const result = await db('users').select('access_token', 'is_locked').where({
      id: userId,
      site_id: 1,
      delete_flag: flag.FALSE,
    })
    return result ? result[0] : null
  } catch (error) {
    console.error(error)
    return null
  }
}

module.exports = {
  getTokenbyId,
}
