import { expect, test } from '@playwright/test'

const suggestions = [
  { gameName: '2Sik', tagLine: 'NA1', iconUrl: null, hasProfile: true },
  { gameName: '2Sik', tagLine: 'EUW', iconUrl: null, hasProfile: false },
  { gameName: '2Sikk', tagLine: '0001', iconUrl: null, hasProfile: false },
]

test.beforeEach(async ({ page }) => {
  await page.route('**/suggest?*', (route) => route.fulfill({ json: { suggestions } }))
  await page.goto('/')
})

function heroSearch(page: import('@playwright/test').Page) {
  return page.getByPlaceholder('Riot ID, like Faker#KR1')
}

test('home page explains the site and shows the Riot disclaimer', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText(/isn.t endorsed by Riot Games/i)).toBeVisible()
})

test('asks for a tag when the Riot ID is incomplete', async ({ page }) => {
  await page.unroute('**/suggest?*')
  await page.route('**/suggest?*', (route) => route.fulfill({ json: { suggestions: [] } }))
  await heroSearch(page).fill('Faker')
  await heroSearch(page).press('Enter')
  await expect(page.locator('form[role=search] [role=alert]').first()).toHaveText('Enter a Riot ID with its tag, like Faker#KR1.')
})

test('shows live suggestions after three letters', async ({ page }) => {
  const input = heroSearch(page)
  await input.fill('2S')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(0)

  await input.fill('2Si')
  const options = page.getByRole('listbox').getByRole('option')
  await expect(options).toHaveCount(3)
  await expect(options.first()).toContainText('2Sik')
  await expect(options.first()).toContainText('#NA1')

  await input.press('ArrowDown')
  await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  await input.press('Escape')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(0)
})

test('asks the visitor to pick when several players share a name', async ({ page }) => {
  await heroSearch(page).fill('2Sik')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(3)
  await heroSearch(page).press('Enter')
  await expect(page.locator('form[role=search] [role=alert]').first()).toHaveText('Pick a player from the list, or add the tag after #.')
})
