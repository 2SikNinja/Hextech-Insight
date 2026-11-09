import { expect, test } from '@playwright/test'

test('compare form needs both Riot IDs', async ({ page }) => {
  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Compare players' })).toBeVisible()
  await page.getByRole('button', { name: 'Compare' }).click()
  await expect(page.getByText('Enter both Riot IDs with their tags, like Faker#KR1.')).toBeVisible()
})

test('favorites start empty', async ({ page }) => {
  await page.goto('/favorites')
  await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible()
  await expect(page.getByText('No saved players yet.')).toBeVisible()
})

test('favorites list players saved in this browser', async ({ page }) => {
  await page.goto('/favorites')
  await page.evaluate(() => {
    window.localStorage.setItem(
      'hextech:favorites',
      JSON.stringify([
        {
          regionSlug: 'na',
          regionLabel: 'North America',
          gameName: 'Example',
          tagLine: 'NA1',
          iconUrl: '',
          rankLabel: 'Unranked',
          savedAt: new Date().toISOString(),
        },
      ]),
    )
  })
  await page.reload()
  await expect(page.getByRole('link', { name: /Example/ })).toBeVisible()
  await page.getByRole('button', { name: /Remove Example/ }).click()
  await expect(page.getByText('No saved players yet.')).toBeVisible()
})

test('about page covers privacy and Riot policies', async ({ page }) => {
  await page.goto('/legal')
  await expect(page.getByRole('heading', { name: 'About and privacy' })).toBeVisible()
})

test('unknown pages show a helpful 404', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Search for a player' }).click()
  await expect(page).toHaveURL('/')
})

test('player links with a bad region are not found', async ({ page }) => {
  // Profiles stream in, so the status is already sent; check what renders.
  await page.goto('/summoner/nowhere/Example-NA1')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})
