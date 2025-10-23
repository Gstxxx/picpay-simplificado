import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { authApp } from './routes/auth/index.js'
import { transactionsApp } from './routes/transactions/index.js'
const mainApp = new Hono()

mainApp.use('/*', cors()).use(logger()).basePath('/api/v1')

const routes = mainApp.route('/', authApp).route('/', transactionsApp)

export type AppType = typeof routes
const port = 3005
console.log(`Server is running on port ${port}`)

serve({
  fetch: mainApp.fetch,
  port,
})
