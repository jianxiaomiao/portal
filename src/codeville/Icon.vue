<script setup lang="ts">
defineProps<{ name: string }>()
const paths: Record<string, string> = {
  town: 'M2 20h20M3 19V9l5-4 5 4v10M13 10l4-3 4 3v9M6 12h3m-3 3h3m7-2h2M7 5V3',
  home: 'M3 11l9-8 9 8M5 10v10h14V10M9 20v-7h6v7',
  stats: 'M3 19h18M5 15l4-5 4 3 6-8',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15',
  orbit:
    'M3 12c0-4 4-7 9-7s9 3 9 7-4 7-9 7-9-3-9-7zm6 0c0-5 1-9 3-9s3 4 3 9-1 9-3 9-3-4-3-9z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'M19 12H5m6-6-6 6 6 6',
  out: 'M6 18 18 6M8 6h10v10',
  plus: 'M5 12h14M12 5v14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M6 18 18 6',
  sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.5 5.5 7 7m10 10 1.5 1.5M5.5 18.5 7 17m10-10 1.5-1.5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  target:
    'M3 9V4h5m8 0h5v5m0 6v5h-5m-8 0H3v-5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  chev: 'M9 5l7 7-7 7',
}
</script>
<template>
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name]" />
  </svg>
</template>
