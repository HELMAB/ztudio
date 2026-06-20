import { ref } from 'vue'

export function useActivityLog() {
  const entries = ref([])

  function log(message) {
    const time = new Date().toLocaleTimeString()
    entries.value.push(`[${time}] ${message}`)
  }

  return { entries, log }
}
