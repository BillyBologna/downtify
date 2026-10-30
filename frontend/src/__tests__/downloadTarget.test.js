import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  store: new Map(),
  api: {
    getQueue: vi.fn(),
    downloadFileURL: (file) => `/media/${file}`,
    onMessage: vi.fn(),
    download: vi.fn(),
    downloadBatch: vi.fn(),
  },
}))

vi.mock('/src/model/api', () => ({ default: fixture.api }))
vi.mock('/src/model/settings', () => ({
  useSettingsManager: () => ({ settings: { value: { generate_m3u: true } } }),
}))

const FIELD = 'downtify_target_playlist'
let targetModel
let manager
let tracker

function songs(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    song_id: `track-${i + 1}`,
    name: `Track ${i + 1}`,
    artists: ['Eminem'],
  }))
}

async function load() {
  vi.resetModules()
  targetModel = await import('../model/downloadTarget')
  const download = await import('../model/download')
  manager = download.useDownloadManager()
  tracker = download.useProgressTracker()
}

beforeEach(async () => {
  fixture.store.clear()
  vi.clearAllMocks()
  vi.stubGlobal('localStorage', {
    getItem: (key) => fixture.store.get(key) ?? null,
    setItem: (key, value) => fixture.store.set(key, String(value)),
    removeItem: (key) => fixture.store.delete(key),
  })
  fixture.api.getQueue.mockResolvedValue({ data: [] })
  fixture.api.download.mockResolvedValue({ data: 'one.mp3' })
  fixture.api.downloadBatch.mockResolvedValue({ data: {} })
  await load()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the playlist downloads are added to', () => {
  it('stamps every song of a batch with the chosen playlist', async () => {
    targetModel.useDownloadTarget().set('Gym')
    await manager.fromSongs(songs())
    const sent = fixture.api.downloadBatch.mock.calls[0][0].songs
    expect(sent.map((song) => song[FIELD])).toEqual(['Gym', 'Gym', 'Gym'])
    // Album order is kept next to it: the server files songs by it.
    expect(sent.map((song) => song.downtify_track_order)).toEqual([0, 1, 2])
  })

  it('leaves songs untouched while no playlist is chosen', async () => {
    await manager.fromSongs(songs(2))
    const sent = fixture.api.downloadBatch.mock.calls[0][0].songs
    for (const song of sent) expect(FIELD in song).toBe(false)
  })

  it('keeps the playlist a song already names (a retry)', () => {
    const { set, withTarget } = targetModel.useDownloadTarget()
    set('Gym')
    const kept = withTarget({ song_id: 'a', [FIELD]: 'Road trip' })
    expect(kept[FIELD]).toBe('Road trip')
  })

  it('sends a single download with the playlist and keeps it for a retry', async () => {
    targetModel.useDownloadTarget().set('Gym')
    await manager.queue({ song_id: 'one', name: 'One', url: 'https://x/one' })
    expect(fixture.api.download.mock.calls[0][0][FIELD]).toBe('Gym')
    const item = tracker.getBySong({ song_id: 'one' })
    expect(item.song[FIELD]).toBe('Gym')
    // The user changes their mind: the retry still goes where it was meant.
    targetModel.useDownloadTarget().set('Road trip')
    await manager.retry(item.song)
    expect(fixture.api.download.mock.calls[1][0][FIELD]).toBe('Gym')
  })

  it('does not mutate the songs it was given', async () => {
    targetModel.useDownloadTarget().set('Gym')
    const original = songs(1)
    await manager.fromSongs(original)
    expect(FIELD in original[0]).toBe(false)
  })

  it('is remembered across page loads until cleared', async () => {
    targetModel.useDownloadTarget().set('  Gym ')
    expect(fixture.store.get('downtify-download-target')).toBe('Gym')
    await load()
    expect(targetModel.useDownloadTarget().target.value).toBe('Gym')
    targetModel.useDownloadTarget().clear()
    expect(fixture.store.has('downtify-download-target')).toBe(false)
    await load()
    expect(targetModel.useDownloadTarget().target.value).toBe('')
  })
})
