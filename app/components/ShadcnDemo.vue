<script setup>
import { computed, ref } from 'vue'

const name = ref('')
const count = ref(0)

const greeting = computed(() => name.value.trim() ? `Hello, ${name.value.trim()}!` : 'Type your name below')
</script>

<template>
  <div class="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle class="flex items-center justify-between">
          shadcn-nuxt + JavaScript
          <Badge variant="secondary">JS</Badge>
        </CardTitle>
        <CardDescription>{{ greeting }}</CardDescription>
      </CardHeader>

      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="name">Your name</Label>
          <Input id="name" v-model="name" placeholder="Ada Lovelace" />
        </div>

        <div class="flex items-center gap-3">
          <Button @click="count++">Clicked {{ count }} times</Button>
          <Button variant="outline" @click="count = 0">Reset</Button>
        </div>
      </CardContent>

      <CardFooter>
        <p class="text-sm text-muted-foreground">
          All components above are auto-imported and written in plain JavaScript.
        </p>
      </CardFooter>
    </Card>
  </div>
</template>
