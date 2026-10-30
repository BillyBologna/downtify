// "Which playlist?" for a download button pressed where no playlist picker
// is on screen. The question is a dialog (DownloadTargetPrompt.vue, in the
// app shell); the answer is for that one download.
import { ref } from 'vue'
import { useDownloadTarget } from '/src/model/downloadTarget'

export const promptOpen = ref(false)
let pending = null

/**
 * Resolves with the playlist's name, '' for just the library, `null` when
 * the user backs out, or `undefined` when a picker on screen already
 * decides (pass it straight on: the download then follows the picker).
 */
export function chooseTarget() {
  if (useDownloadTarget().pickers.value > 0) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    if (pending) pending(null)
    pending = resolve
    promptOpen.value = true
  })
}

/** Close the dialog; `value` is what chooseTarget() resolves with. */
export function answerPrompt(value) {
  const done = pending
  pending = null
  promptOpen.value = false
  done?.(value)
}

/** Hide the dialog but keep the question open (a playlist is being made). */
export function pausePrompt() {
  promptOpen.value = false
}
