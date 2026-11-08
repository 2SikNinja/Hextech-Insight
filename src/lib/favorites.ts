'use client'

import { useSyncExternalStore } from 'react'

// Favorites live in the visitor's browser (localStorage), since the site has no
// accounts. Components subscribe through useFavorites so every star button and
// the favorites page stay in sync, including across browser tabs.

export interface Favorite {
  regionSlug: string
  regionLabel: string
  gameName: string
  tagLine: string
  iconUrl: string
  rankLabel: string
  savedAt: string
}

const storageKey = 'hextech:favorites'
const changeEvent = 'hextech:favorites-changed'
const maxFavorites = 50
const emptyList: Favorite[] = []

let cachedRaw: string | null = null
let cachedList: Favorite[] = emptyList

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function getSnapshot(): Favorite[] {
  const raw = readRaw()
  // Return the same array while storage is unchanged so React does not re-render.
  if (raw === cachedRaw) return cachedList
  cachedRaw = raw
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    cachedList = Array.isArray(parsed) ? (parsed as Favorite[]) : emptyList
  } catch {
    cachedList = emptyList
  }
  return cachedList
}

function getServerSnapshot(): Favorite[] {
  return emptyList
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange)
  window.addEventListener(changeEvent, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(changeEvent, onChange)
  }
}

function write(list: Favorite[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(list.slice(0, maxFavorites)))
  } catch {
    // Storage full or blocked: nothing else we can do in the browser.
  }
  window.dispatchEvent(new Event(changeEvent))
}

export function favoriteKey(favorite: Pick<Favorite, 'regionSlug' | 'gameName' | 'tagLine'>): string {
  return `${favorite.regionSlug}:${favorite.gameName}#${favorite.tagLine}`.toLowerCase()
}

export function useFavorites(): Favorite[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function addFavorite(favorite: Favorite) {
  const key = favoriteKey(favorite)
  write([favorite, ...getSnapshot().filter((existing) => favoriteKey(existing) !== key)])
}

export function removeFavorite(key: string) {
  write(getSnapshot().filter((existing) => favoriteKey(existing) !== key))
}
