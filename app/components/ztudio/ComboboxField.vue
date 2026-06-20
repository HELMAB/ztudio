<script setup>
import { CheckIcon, ChevronDownIcon } from '@lucide/vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const displayValue = value => props.options.find(o => o.value === value)?.label ?? ''
</script>

<template>
  <ComboboxRoot
    :model-value="modelValue"
    open-on-click
    open-on-focus
    @update:model-value="emit('update:modelValue', $event)"
  >
    <ComboboxAnchor
      class="border-input focus-within:border-ring focus-within:ring-ring/50 flex h-9 w-full items-center justify-between gap-1.5 rounded-md border bg-transparent pr-2 pl-2.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:ring-3"
    >
      <ComboboxInput
        class="placeholder:text-muted-foreground flex-1 bg-transparent outline-none"
        :placeholder="placeholder || $t('select.placeholder')"
        :display-value="displayValue"
        autocomplete="off"
        @focus="$event.target.select()"
      />
      <ComboboxTrigger>
        <ChevronDownIcon class="text-muted-foreground size-4 shrink-0" />
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="4"
        class="bg-popover text-popover-foreground ring-foreground/10 relative z-50 max-h-60 w-(--reka-combobox-trigger-width) overflow-hidden rounded-md shadow-md ring-1"
      >
        <ComboboxViewport class="max-h-60 overflow-y-auto p-1">
          <ComboboxEmpty class="text-muted-foreground py-6 text-center text-sm">
            {{ $t('select.empty') }}
          </ComboboxEmpty>
          <ComboboxItem
            v-for="opt in options"
            :key="opt.value"
            :value="opt.value"
            class="focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          >
            {{ opt.label }}
            <ComboboxItemIndicator
              class="absolute right-2 flex size-4 items-center justify-center"
            >
              <CheckIcon class="size-4" />
            </ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
