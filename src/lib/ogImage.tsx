import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReactNode } from 'react'

// Shared look for link-preview images (Discord, LinkedIn, iMessage...).

export const ogSize = { width: 1200, height: 630 }
export const ogContentType = 'image/png'

export const ogColors = {
  canvas: '#15131a',
  surface: '#1e1b25',
  line: '#322d3c',
  ink: '#f3eff8',
  muted: '#9b93a9',
  accent: '#9b7cf5',
}

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 500 | 700; style: 'normal' }[]> | null = null

export function loadOgFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/Barlow-Medium.woff')),
    readFile(join(process.cwd(), 'assets/fonts/Barlow-Bold.woff')),
  ]).then(([medium, bold]) => [
    { name: 'Barlow', data: medium, weight: 500 as const, style: 'normal' as const },
    { name: 'Barlow', data: bold, weight: 700 as const, style: 'normal' as const },
  ])
  return fontsPromise
}

export function OgFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        background: ogColors.canvas,
        color: ogColors.ink,
        fontFamily: 'Barlow',
      }}
    >
      {children}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30, fontWeight: 700, color: ogColors.muted }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: ogColors.accent,
            color: ogColors.canvas,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
          }}
        >
          H
        </div>
        Hextech Insight
      </div>
    </div>
  )
}
