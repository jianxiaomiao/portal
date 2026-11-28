<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const props = defineProps<{ controls: OrbitControls }>()
const face = ref<SVGSVGElement>()
const cardinals = [
  { label: 'N', x: 48, y: 18 },
  { label: 'E', x: 78, y: 48 },
  { label: 'S', x: 48, y: 78 },
  { label: 'W', x: 18, y: 48 },
]
let last: number | undefined
let bearing = 0

function orient() {
  // Map north is world -Z. Orbiting towards +X puts north to the right on a plan compass.
  const { object, target } = props.controls
  const dx = object.position.x - target.x
  const dz = object.position.z - target.z
  if (Math.hypot(dx, dz) < 1e-7) return
  const angle = Math.atan2(dx, dz)
  if (angle === last) return
  const delta = angle - (last ?? 0)
  bearing += Math.atan2(Math.sin(delta), Math.cos(delta))
  last = angle
  face.value?.style.setProperty('--bearing', bearing + 'rad')
}
onMounted(() => {
  orient()
  props.controls.addEventListener('change', orient)
})
onBeforeUnmount(() => props.controls.removeEventListener('change', orient))
</script>

<template>
  <svg ref="face" class="compass" viewBox="0 0 96 96" role="img" aria-label="地图指南针，红色针尖指北">
    <title>地图北向</title>
    <circle class="case-ring" cx="48" cy="48" r="46.4"/>
    <circle class="enamel" cx="48" cy="48" r="43.6"/>
    <circle class="engraving" cx="48" cy="48" r="35.8"/>
    <g class="card">
      <path v-for="i in 48" :key="i" class="tick" :class="{ major: i % 4 === 0 }"
        :d="i % 4 === 0 ? 'M48 6.6v4.8' : 'M48 7.2v2.2'" :transform="'rotate(' + (i * 7.5) + ' 48 48)'"/>
      <g v-for="point in cardinals" :key="point.label" :transform="'translate(' + point.x + ' ' + point.y + ')'">
        <text class="letter" :class="{ north: point.label === 'N' }" y="0.4">{{ point.label }}</text>
      </g>
      <path class="diagonals" d="m35 35 13 8 13-8-8 13 8 13-13-8-13 8 8-13Z"/>
      <path class="east-west" d="m25 48 23-5 23 5-23 5Z"/>
      <path class="facet" d="m25 48 23 5v-5h23l-23-5v5Z"/>
      <path class="south" d="m48 71-5.5-23L48 44l5.5 4Z"/>
      <path class="south-shadow" d="m48 71 5.5-23-5.5-4Z"/>
      <path class="needle" d="m48 24-6 24 6 4 6-4Z"/>
      <path class="needle-shadow" d="m48 24 6 24-6 4Z"/>
    </g>
    <circle class="pivot" cx="48" cy="48" r="3.35"/>
    <circle class="pin" cx="47.65" cy="47.6" r="1.1"/>
  </svg>
</template>

<style scoped>
.compass {
  --rim: #af9669;
  --paper: #faf6e9;
  --ink: #344a43;
  --line: #978969;
  --north: #974634;
  --bearing: 0rad;
  position: absolute;
  top: 14px;
  right: 15px;
  width: 76px;
  height: 76px;
  pointer-events: none;
  user-select: none;
  filter: drop-shadow(0 2px 2px #24322c30);
}
[data-theme='night'] .compass {
  --rim: #a58f65;
  --paper: #24373e;
  --ink: #e2e5d5;
  --line: #b2a588;
  --north: #ffac88;
}
.case-ring { fill: var(--rim); stroke: #766746; stroke-width: .9; }
.enamel { fill: var(--paper); stroke: #eee1be; stroke-width: 1; }
.engraving { fill: none; stroke: var(--line); stroke-width: .55; }
.card { transform-origin: 48px 48px; transform: rotate(var(--bearing)); }
.tick { fill: none; stroke: var(--line); stroke-width: .9; }
.major { stroke: var(--ink); stroke-width: 1.45; }
.letter {
  fill: var(--ink);
  font: bold 10px Georgia, serif;
  text-anchor: middle;
  dominant-baseline: central;
  transform-origin: 0 0;
  transform: rotate(calc(0rad - var(--bearing)));
}
.north { fill: var(--north); font-size: 11.5px; }
.diagonals { fill: #cfbb8b; }
.east-west { fill: #b89d68; }
.facet { fill: #e1cd9d; }
.south { fill: #849a8c; }
.south-shadow { fill: #4c6a60; }
.needle { fill: #de8260; }
.needle-shadow { fill: #ab513e; }
.pivot { fill: #b99c60; stroke: #645b42; stroke-width: .8; }
.pin { fill: #faeccd; }
@media (max-width: 720px), (pointer: coarse) {
  .compass { width: 58px; height: 58px; top: 9px; right: 9px; }
}
</style>
