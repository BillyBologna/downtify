<template>
  <UiModal :open="open" :title="t('downloadTarget.heading')" @close="cancel">
    <ul class="flex flex-col gap-1">
      <li>
        <button
          type="button"
          class="flex h-11 w-full items-center gap-3 rounded-[10px] px-2 text-left text-sm hover:bg-surface-2"
          @click="answerPrompt('')"
        >
          <AppIcon name="library" :size="17" />
          <span class="min-w-0 flex-1 truncate">{{
            t('downloadTarget.none')
          }}</span>
        </button>
      </li>
      <li v-for="playlist in playlists" :key="playlist.name">
        <button
          type="button"
          class="flex h-11 w-full items-center gap-3 rounded-[10px] px-2 text-left text-sm hover:bg-surface-2"
          @click="answerPrompt(playlist.name)"
        >
          <AppIcon name="playlist" :size="17" />
          <span class="min-w-0 flex-1 truncate">{{ playlist.title }}</span>
        </button>
      </li>
      <li>
        <button
          type="button"
          class="flex h-11 w-full items-center gap-3 rounded-[10px] px-2 text-left text-sm hover:bg-surface-2"
          @click="createNew"
        >
          <AppIcon name="plus" :size="17" />
          <span class="min-w-0 flex-1 truncate">{{
            t('downloadTarget.new')
          }}</span>
        </button>
      </li>
    </ul>
  </UiModal>
</template>

<script setup>
import { computed, watch } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import UiModal from '../ui/UiModal.vue'
import {
  answerPrompt,
  pausePrompt,
  promptOpen as open,
} from '/src/model/downloadPrompt'
import { useLibrary } from '/src/model/library'
import { usePlaylistActions } from '/src/model/playlistActions'
import { useI18n } from '/src/i18n'

const { t } = useI18n()
const library = useLibrary()
const actions = usePlaylistActions()
const playlists = computed(() => actions.manuals())

// The playlists come with the library; it is loaded once and shared.
watch(open, (value) => {
  if (value) library.load()
})

function cancel() {
  answerPrompt(null)
}

function createNew() {
  // The question stays open until the new playlist exists; the download
  // then goes to it. Closing the create dialog without making one leaves
  // the download unqueued.
  pausePrompt()
  actions.openCreate([], { onCreated: (name) => answerPrompt(name) })
}
</script>
