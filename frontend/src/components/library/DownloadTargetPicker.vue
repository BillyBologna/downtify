<template>
  <UiMenu
    :items="items"
    :label="t('downloadTarget.choose')"
    align="start"
    size="sm"
  >
    <template #trigger>
      <UiButton
        :variant="target ? 'secondary' : 'ghost'"
        size="lg"
        icon="playlist"
        icon-right="chevron-down"
        :title="target ? t('downloadTarget.title', { name: title }) : undefined"
      >
        <span class="max-w-[12rem] truncate sm:max-w-[16rem]">{{
          target ? t('downloadTarget.current', { name: title }) : label
        }}</span>
      </UiButton>
    </template>
  </UiMenu>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import UiButton from '../ui/UiButton.vue'
import UiMenu from '../ui/UiMenu.vue'
import { useDownloadTarget } from '/src/model/downloadTarget'
import { useLibrary } from '/src/model/library'
import { usePlaylistActions } from '/src/model/playlistActions'
import { useUi } from '/src/model/ui'
import { useI18n } from '/src/i18n'

const { t } = useI18n()
const library = useLibrary()
const actions = usePlaylistActions()
const ui = useUi()
const { target, set, clear, enter, leave } = useDownloadTarget()

// The playlists the user can add songs to, by stored name.
const playlists = computed(() => actions.manuals())

const title = computed(
  () =>
    playlists.value.find((playlist) => playlist.name === target.value)?.title ||
    target.value
)
const label = computed(() => t('downloadTarget.choose'))

const items = computed(() => [
  { heading: t('downloadTarget.heading') },
  {
    label: t('downloadTarget.none'),
    icon: 'library',
    checked: !target.value,
    action: clear,
  },
  ...playlists.value.map((playlist) => ({
    label: playlist.title,
    icon: 'playlist',
    checked: playlist.name === target.value,
    action: () => set(playlist.name),
  })),
  { divider: true },
  {
    label: t('downloadTarget.new'),
    icon: 'plus',
    action: () => actions.openCreate([], { onCreated: set }),
  },
])

// While this picker is on screen it decides where the page's downloads
// go, so their buttons don't ask.
onMounted(() => {
  enter()
  // The playlists come with the library; it is loaded once and shared.
  library.load()
})
onBeforeUnmount(leave)

// A playlist that was deleted or renamed can't take downloads any more:
// forget it instead of failing every download after it.
watch(
  [library.loaded, playlists],
  ([loaded, lists]) => {
    if (!loaded || !target.value) return
    if (lists.some((playlist) => playlist.name === target.value)) return
    ui.toast(t('downloadTarget.gone', { name: target.value }), {
      kind: 'error',
    })
    clear()
  },
  { immediate: true }
)
</script>
