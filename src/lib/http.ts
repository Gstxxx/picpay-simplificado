type ResilienceOptions = {
  method?: string
  headers?: Record<string, string>
  body?: any
  timeoutMs?: number
  retries?: number
  retryDelayBaseMs?: number
}

type CircuitState = {
  failures: number
  lastFailureAt: number
}

const circuit: Record<string, CircuitState> = {}
const OPEN_AFTER = 5
const COOL_DOWN_MS = 10_000

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchWithResilience(url: string, opts: ResilienceOptions = {}): Promise<Response> {
  const method = opts.method ?? 'GET'
  const headers = opts.headers ?? {}
  const body = opts.body
  const timeoutMs = opts.timeoutMs ?? 2000
  const retries = opts.retries ?? 0
  const retryDelayBaseMs = opts.retryDelayBaseMs ?? 200

  const now = Date.now()
  const state = circuit[url]
  if (state && state.failures >= OPEN_AFTER && now - state.lastFailureAt < COOL_DOWN_MS) {
    throw new Error('CIRCUIT_OPEN')
  }

  let attempt = 0
  let lastError: unknown
  while (attempt <= retries) {
    attempt++
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      } as RequestInit)
      clearTimeout(timer)
      if (!response.ok) {
        trackFailure(url)
      } else {
        resetCircuit(url)
      }
      return response
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      trackFailure(url)
      if (attempt > retries) break
      const backoff = retryDelayBaseMs * Math.pow(2, attempt - 1)
      await delay(backoff)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed')
}

function trackFailure(url: string) {
  const curr = circuit[url] ?? { failures: 0, lastFailureAt: 0 }
  circuit[url] = { failures: curr.failures + 1, lastFailureAt: Date.now() }
}

function resetCircuit(url: string) {
  circuit[url] = { failures: 0, lastFailureAt: 0 }
}


