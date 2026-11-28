// Three.js world space in metres, Y up. Each offset is relative to its target.
type Shot = { target: [number, number, number]; offset: [number, number, number]; width: number; height: number }
export const townViews = {
  home: { target: [-0.8, 0.6, -2.1], offset: [13, 48, 47], width: 72, height: 45 },
  portrait: { target: [0.06, 0.31, -3.78], offset: [54.7, 58, 5.75], width: 43.3, height: 46 },
  plan: { target: [-0.53, 0.15, -2.9], offset: [0, 66, 0.001], width: 59, height: 41 },
  reverse: { target: [-0.7, 0.6, -2.1], offset: [-15, 45, -50], width: 60, height: 35 },
  residential: { target: [-9.4, 1.2, -17.6], offset: [3, 8, 12], width: 21, height: 12 },
  market: { target: [23.8, 0.8, -1.2], offset: [6, 10, 13], width: 16, height: 10.3 },
  quay: { target: [-22.4, 0.7, 0.45], offset: [-7, 9, 11], width: 18, height: 11.5 },
} satisfies Record<string, Shot>
export const districtNames = { residential: '住宅街', market: '街市', quay: '滨水公园' } as const
export type TownView = Exclude<keyof typeof townViews, 'portrait'>
