import { test, expect } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'

const BASE = 'http://localhost:4891'

/**
 * Tabs in one browser context share localStorage and BroadcastChannel —
 * separate `browser.newPage()` calls would create isolated contexts.
 */
async function openContext(browser: Browser): Promise<[BrowserContext, Page, Page]> {
  const context = await browser.newContext()
  const a = await context.newPage()
  const b = await context.newPage()
  await a.goto(BASE)
  await b.goto(BASE)
  await expect(a.locator('#count')).toHaveText('0')
  await expect(b.locator('#count')).toHaveText('0')
  return [context, a, b]
}

test('runtime counter syncs across tabs via BroadcastChannel', async ({ browser }) => {
  const [context, a, b] = await openContext(browser)

  await a.locator('#inc').click()
  await expect(b.locator('#count')).toHaveText('1')

  await b.locator('#inc').click()
  await expect(a.locator('#count')).toHaveText('2')
  await context.close()
})

test('storage state syncs across tabs and persists to localStorage', async ({ browser }) => {
  const [context, a, b] = await openContext(browser)

  await a.locator('#theme').selectOption('dark')
  await expect(b.locator('#settings-view')).toContainText('"dark"')

  const stored = await a.evaluate(() => localStorage.getItem('cws:settings'))
  expect(stored).toContain('"theme":"dark"')
  await context.close()
})

test('a fresh tab restores persisted storage from localStorage', async ({ browser }) => {
  const context = await browser.newContext()
  const a = await context.newPage()
  await a.goto(BASE)
  await a.locator('#theme').selectOption('dark')
  await a.locator('#notifications').uncheck()

  const fresh = await context.newPage()
  await fresh.goto(BASE)
  await expect(fresh.locator('#theme')).toHaveValue('dark')
  await expect(fresh.locator('#notifications')).not.toBeChecked()
  await context.close()
})

test('runtime value does not survive reload (in-memory by design), storage does', async ({
  browser,
}) => {
  const context = await browser.newContext()
  const a = await context.newPage()
  await a.goto(BASE)
  await a.locator('#inc').click()
  await a.locator('#inc').click()
  await a.locator('#theme').selectOption('dark')

  await a.reload()
  await expect(a.locator('#count')).toHaveText('0') // runtime: memory only
  await expect(a.locator('#theme')).toHaveValue('dark') // storage: persisted
  await context.close()
})
