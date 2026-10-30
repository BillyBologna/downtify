// The Library playlist downloads are added to. Every song sent to the
// server carries it as `downtify_target_playlist`; the server adds each
// song to that playlist the moment it is downloaded, so the playlist
// fills up as the queue runs.
//
// Two ways to choose it:
// - A playlist picker on screen (album, artist and top-songs pages) holds
//   the choice for the whole page: its download buttons use it silently.
// - Anywhere else, a download button asks which playlist when pressed
//   (see downloadPrompt.js) and passes the answer for that download only.
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

// The playlist's stored name (what the server knows it by), or ''. It is
// the picker's last choice and only counts while a picker is on screen.
const target = ref(stored())
const pickers = ref(0)

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
 * The song with its playlist on it.
 *
 * `explicit` is a choice made for this download alone ('' = just the
 * library). Without one, a song that already names a playlist (a retried
 * download) keeps it, and the picker's choice applies only while a picker
 * is on screen; otherwise the song is untouched.
 */
export function withTarget(song, explicit) {
  if (!song || typeof song !== 'object') return song
  if (explicit !== undefined) {
    const { [TARGET_FIELD]: _dropped, ...rest } = song
    return explicit ? { ...rest, [TARGET_FIELD]: explicit } : rest
  }
  if (TARGET_FIELD in song || !pickers.value || !target.value) return song
  return { ...song, [TARGET_FIELD]: target.value }
}

export function useDownloadTarget() {
  function set(name) {
    target.value = String(name || '').trim()
  }
  function clear() {
    target.value = ''
  }
  // A picker calls these as it appears and disappears from the screen.
  function enter() {
    pickers.value += 1
  }
  function leave() {
    pickers.value = Math.max(0, pickers.value - 1)
  }
  return { target, pickers, set, clear, enter, leave, withTarget }
}
