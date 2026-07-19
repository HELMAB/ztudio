<script setup>
import { computed, ref } from 'vue'
import { CaptionsIcon, Music2Icon, MusicIcon, StampIcon, UploadIcon, XIcon } from '@lucide/vue'
import { IMAGE_DRAG_MIME } from '@/lib/ztudio/config'

// Unified assets view: every loaded medium in one list (voice, music bed, image
// clips, captions, logo) plus a single Import that routes mixed file types to
// the right loader (store.importFiles). This is the only upload surface except
// the music bed, which keeps its own uploader in the inspector's Audio tab (a
// plain import can't tell voice from music); that tab also has the mix controls.
const store = useZtudioStore()

const input = ref(null)

function onImport(event) {
  store.importFiles(event.target.files)
  // Reset so importing the same file again still fires a change event.
  event.target.value = ''
}

// Small thumbnail tiles for image clips, cached per bitmap so splits/duplicates
// share one data URL.
const THUMB_H = 72
const thumbCache = new WeakMap()
function thumbFor(bitmap) {
  if (!bitmap) {
    return ''
  }
  let url = thumbCache.get(bitmap)
  if (!url) {
    const tw = Math.max(1, Math.round((THUMB_H * bitmap.width) / bitmap.height))
    const cv = document.createElement('canvas')
    cv.width = tw
    cv.height = THUMB_H
    cv.getContext('2d').drawImage(bitmap, 0, 0, tw, THUMB_H)
    url = cv.toDataURL('image/jpeg', 0.75)
    thumbCache.set(bitmap, url)
  }
  return url
}

const rows = computed(() => {
  const out = []
  if (store.audioBuffer) {
    out.push({
      key: 'audio',
      icon: MusicIcon,
      label: store.audioPill.text,
      remove: () => store.loadAudio(null),
    })
  }
  if (store.hasMusic) {
    out.push({
      key: 'music',
      icon: Music2Icon,
      label: store.musicPill.text,
      remove: () => store.loadMusic(null),
    })
  }
  for (const im of store.images) {
    out.push({
      key: 'img' + im.id,
      thumb: thumbFor(im.bitmap),
      label: im.name,
      meta: `${im.width}×${im.height}`,
      selected: store.selectedImageId === im.id,
      select: () => store.selectImage(im.id),
      remove: () => store.removeImage(im.id),
      dragId: im.id,
    })
  }
  if (store.cues.length) {
    out.push({
      key: 'srt',
      icon: CaptionsIcon,
      label: store.srtPill.text,
      remove: () => store.loadSrt(null),
    })
  }
  if (store.hasLogo) {
    out.push({
      key: 'logo',
      icon: StampIcon,
      label: store.logoPill.text,
      remove: () => store.loadLogo(null),
    })
  }
  return out
})

// Image rows can be dragged onto the timeline (Timeline.vue reads this MIME on
// drop and re-places the clip at the drop time).
function onDragStart(event, r) {
  if (r.dragId == null || !event.dataTransfer) {
    return
  }
  event.dataTransfer.setData(IMAGE_DRAG_MIME, String(r.dragId))
  event.dataTransfer.effectAllowed = 'move'
}
</script>

<template>
  <div class="space-y-3">
    <input
      ref="input"
      type="file"
      multiple
      accept="audio/*,image/*,.srt,.ttf,.otf"
      class="sr-only"
      data-testid="assets-import"
      @change="onImport"
    />
    <Button variant="outline" size="sm" class="w-full" @click="input?.click()">
      <UploadIcon class="size-3.5" />
      {{ $t('media.import') }}
    </Button>

    <p v-if="!rows.length" class="px-1 py-6 text-center text-xs text-muted-foreground">
      {{ $t('media.assetsEmpty') }}
    </p>

    <div v-else class="space-y-1" data-testid="asset-list">
      <div
        v-for="r in rows"
        :key="r.key"
        data-testid="asset-row"
        class="group flex items-center gap-2.5 rounded-lg border p-1.5 transition-colors"
        :class="[
          r.selected ? 'border-brand/40 bg-brand-muted/50' : 'border-transparent hover:bg-muted/60',
          r.select ? 'cursor-pointer' : '',
        ]"
        :draggable="r.dragId != null || undefined"
        @dragstart="onDragStart($event, r)"
        @click="r.select?.()"
      >
        <img
          v-if="r.thumb"
          :src="r.thumb"
          alt=""
          class="h-9 w-12 shrink-0 rounded-md object-cover ring-1 ring-black/5 dark:ring-white/10"
        />
        <span v-else class="grid h-9 w-12 shrink-0 place-items-center rounded-md bg-muted">
          <component :is="r.icon" class="size-4 text-muted-foreground" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-xs font-medium">{{ r.label }}</span>
          <span v-if="r.meta" class="block truncate text-[10px] text-muted-foreground">
            {{ r.meta }}
          </span>
        </span>
        <button
          type="button"
          class="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          :aria-label="$t('media.clear')"
          :title="$t('media.clear')"
          @click.stop="r.remove()"
        >
          <XIcon class="size-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
