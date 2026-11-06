<template>
  <UiModal
    :open="open"
    :title="t('playlists.addSongsTitle', { name: playlist?.title || '' })"
    :description="t('playlists.addSongsHint')"
    width="sm:max-w-lg"
    @close="close"
  >
    <div class="flex flex-col gap-3">
      <label
        class="flex h-10 items-center gap-2.5 rounded-control border border-line-2 bg-surface px-3"
      >
        <AppIcon name="filter" :size="16" class="text-faint" />
        <input
          v-model="query"
          type="search"
          :placeholder="t('library.filterPlaceholder')"
          class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </label>
      <select
        v-model="source"
        :aria-label="t('playlists.addFromSource')"
        class="h-10 rounded-control border border-line-2 bg-surface px-3 text-sm outline-none"
      >
        <option value="">{{ t('playlists.addFromAll') }}</option>
        <option
          v-for="item in sourceOptions"
          :key="item.name"
          :value="item.name"
        >
          {{ item.title }} ({{ item.fileCount }})
        </option>
      </select>
      <label
        v-if="visible.length"
        class="flex h-9 cursor-pointer items-center gap-3 px-1 text-sm font-semibold"
      >
        <input
          type="checkbox"
          class="size-4 accent-accent"
          :checked="allPicked"
          :indeterminate.prop="somePicked && !allPicked"
          @change="toggleAll"
        />
        {{ t('playlists.addSelectFiltered', { count: visible.length }) }}
      </label>
      <ul class="max-h-80 overflow-y-auto">
        <li
          v-for="track in visible"
          :key="track.file"
          class="flex h-12 items-center gap-3 rounded-[10px] px-1 hover:bg-surface-2"
        >
          <input
            :id="`add-${track.file}`"
            v-model="picked"
            type="checkbox"
            :value="track.file"
            class="size-4 accent-accent"
          />
          <label
            :for="`add-${track.file}`"
            class="min-w-0 flex-1 cursor-pointer"
          >
            <p class="truncate text-sm font-semibold">{{ track.title }}</p>
            <p class="truncate text-[13px] text-muted">{{ track.artist }}</p>
          </label>
        </li>
      </ul>
    </div>
    <template #footer>
      <UiButton variant="ghost" @click="close">{{
        t('common.cancel')
      }}</UiButton>
      <UiButton
        variant="primary"
        icon="plus"
        :disabled="!picked.length || saving"
        :loading="saving"
        @click="submit"
      >
        {{ t('playlists.addSongs') }}
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import AppIcon from '../ui/AppIcon.vue'
import UiButton from '../ui/UiButton.vue'
import UiModal from '../ui/UiModal.vue'
import { useLibrary } from '/src/model/library'
import { usePlaylistActions } from '/src/model/playlistActions'
import { useI18n } from '/src/i18n'

const { t } = useI18n()
const library = useLibrary()
const actions = usePlaylistActions()
const query = ref('')
const hits = ref([])
const picked = ref([])
const saving = ref(false)
// '' = whole library; otherwise the name of the playlist to copy from.
const source = ref('')
const sourceTracks = ref([])

const open = computed({
  get: () => actions.addOpen.value,
  set: (value) => {
    actions.addOpen.value = value
  },
})
const playlist = computed(() => actions.addPlaylist.value)

const sourceOptions = computed(() =>
  library.playlists.value.filter(
    (item) => item.name !== playlist.value?.name && item.fileCount > 0
  )
)

const visible = computed(() => {
  // Songs the destination playlist already has: the server skips them.
  const have = new Set((playlist.value?.tracks || []).map((item) => item.file))
  const list = source.value ? sourceTracks.value : hits.value
  return list.filter((track) => !have.has(track.file))
})

const allPicked = computed(
  () =>
    visible.value.length > 0 &&
    visible.value.every((track) => picked.value.includes(track.file))
)
const somePicked = computed(() =>
  visible.value.some((track) => picked.value.includes(track.file))
)

function toggleAll() {
  const files = visible.value.map((track) => track.file)
  if (allPicked.value) {
    const drop = new Set(files)
    picked.value = picked.value.filter((file) => !drop.has(file))
  } else {
    picked.value = [...new Set([...picked.value, ...files])]
  }
}

async function searchLibrary(text) {
  hits.value = await library.searchTracks(text, { limit: 80 })
}

// Every song of the chosen playlist (no 80 limit), filtered by the text.
async function loadSource() {
  if (!source.value) {
    sourceTracks.value = []
    return
  }
  const name = source.value
  await library.loadPlaylistTracks(name)
  if (source.value !== name) return
  const all = library.findPlaylist(name)?.tracks || []
  const text = query.value.trim().toLowerCase()
  sourceTracks.value = text
    ? all.filter((track) =>
        `${track.title} ${track.artist}`.toLowerCase().includes(text)
      )
    : all
}

watch(open, (value) => {
  if (value) {
    query.value = ''
    picked.value = []
    source.value = ''
    sourceTracks.value = []
    searchLibrary('')
  }
})

watch(source, () => {
  if (open.value) loadSource()
})

watchDebounced(
  query,
  (text) => {
    if (!open.value) return
    if (source.value) loadSource()
    else searchLibrary(text)
  },
  { debounce: 200 }
)

function close() {
  open.value = false
}

async function submit() {
  if (!playlist.value || !picked.value.length || saving.value) return
  saving.value = true
  try {
    await actions.addFiles(playlist.value, picked.value)
    close()
  } finally {
    saving.value = false
  }
}
</script>
