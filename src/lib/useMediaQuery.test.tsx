import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMediaQuery } from './useMediaQuery'

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches, media: '', onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

beforeEach(() => vi.unstubAllGlobals())

describe('useMediaQuery', () => {
  it('devuelve true cuando la media query matchea', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(true)
  })
  it('devuelve false cuando no matchea', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
  })
})
