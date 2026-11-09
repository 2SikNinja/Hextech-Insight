import { describe, expect, it } from 'vitest'
import { apexBase, ladderLabel, ladderValue } from '@/lib/ladder'

describe('ladderValue', () => {
  it('places divisions 100 apart', () => {
    expect(ladderValue('IRON', 'IV', 0)).toBe(0)
    expect(ladderValue('GOLD', 'IV', 40)).toBe(1240)
    expect(ladderValue('GOLD', 'I', 99)).toBe(1599)
    expect(ladderValue('PLATINUM', 'IV', 0)).toBe(1600)
  })

  it('puts apex tiers on one LP scale above Diamond I', () => {
    expect(ladderValue('DIAMOND', 'I', 100)).toBe(apexBase)
    expect(ladderValue('MASTER', 'I', 150)).toBe(apexBase + 150)
    expect(ladderValue('CHALLENGER', 'I', 1581)).toBe(apexBase + 1581)
  })

  it('handles unknown tiers safely', () => {
    expect(ladderValue('UNKNOWN', 'II', 50)).toBe(0)
  })
})

describe('ladderLabel', () => {
  it('names the division that starts at a value', () => {
    expect(ladderLabel(1200)).toBe('Gold IV')
    expect(ladderLabel(1500)).toBe('Gold I')
    expect(ladderLabel(apexBase)).toBe('Master')
  })
})
