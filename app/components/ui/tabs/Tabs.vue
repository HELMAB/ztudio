<script setup>
import { reactiveOmit } from "@vueuse/core";
import { TabsRoot, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  defaultValue: { type: [String, Number], required: false },
  orientation: { type: String, required: false },
  dir: { type: String, required: false },
  activationMode: { type: String, required: false },
  modelValue: { type: [String, Number], required: false },
  unmountOnHide: { type: Boolean, required: false, default: true },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});

const emits = defineEmits(["update:modelValue"]);

const delegatedProps = reactiveOmit(props, "class");
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <TabsRoot
    data-slot="tabs"
    v-bind="forwarded"
    :class="cn('flex flex-col gap-2', props.class)"
  >
    <slot />
  </TabsRoot>
</template>
