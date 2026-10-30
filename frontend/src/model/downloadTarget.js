// The Library playlist new downloads are added to, picked before
// downloading. Every song sent to the server carries it as
// `downtify_target_playlist`; the server adds each song to that playlist
// the moment it is downloaded, so the playlist fills up as the queue runs.
import { ref, watch } from 'vue'

const STORAGE_KEY = 'downtify-download-target'

/** The song-row field the server reads (see downtify/api.py). */
export const TARGET_FIELD = 'downtify_target_playlist'

function stored() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

// The playlist's stored name (what the server knows it by), or ''.
const target = ref(stored())

watch(
  target,
  (name) => {
    try {
      if (name) localStorage.setItem(STORAGE_KEY, name)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Private mode: the choice just lasts until the page closes.
    }
  },
  { flush: 'sync' }
)

/**
 * The song with the chosen playlist on it. A song that already names one
 * (a retried download) keeps it; without a choice the song is untouched.
 */
export function withTarget(song) {
  if (!song || typeof song !== 'object') return song
  if (TARGET_FIELD in song || !target.value) return song
  return { ...song, [TARGET_FIELD]: target.value }
}

export function useDownloadTarget() {
  function set(name) {
    target.value = String(name || '').trim()
  }
  function clear() {
    target.value = ''
  }
  return { target, set, clear, withTarget }
}
