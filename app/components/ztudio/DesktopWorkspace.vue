<template>
  <div class="flex flex-1 min-h-0 flex-col">
    <div class="flex flex-1 min-h-0">
      <ZtudioMediaPanel class="w-72 shrink-0 border-r border-border" />
      <ZtudioPreviewStage class="flex-1 min-w-0" />
      <ZtudioInspectorPanel class="w-80 shrink-0 border-l border-border" />
    </div>
    <ZtudioTimeline class="h-48 shrink-0 border-t border-border" />
  </div>
</template>
