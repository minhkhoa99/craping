const knex = require('knex')
const { knexConfig } = require('../configs/index')

module.exports = knex(knexConfig.development)
