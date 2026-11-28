import * as T from 'three'
const rim = [
  [-22.9, -13.5], [-22.9, -16.5], [-21.1, -16.5], [-21.1, -20.3],
  [-13.7, -22], [4.2, -22], [6.1, -20.75], [6.1, -16.52], [7.35, -16.52], [7.35, -20.55], [10.2, -21.6], [19.8, -22.1],
  [22.7, -20.1], [23.38, -15.95], [25.04, -12.21],
  [25.55, -7.47], [27.35, -4.98], [27.35, 5.22], [25.63, 6.9],
  [21.26, 6.9], [21.26, 16.43], [3.1, 16.22], [-3.7, 16.14], [-8.8, 14.68], [-17.17, 14.68],
  [-18, 14.35], [-21.55, 14.35], [-24, 11], [-26, 9.8], [-28.4, 4.8],
  [-28, -3.3], [-25, -7.6], [-24, -9.3],
]

// Encode the signed distance once. A metre of shore is about two mask texels.
export function shoreDistance() {
  const side = 144, data = new Uint8Array(side * side)
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) {
    const x = (i + .5) * 72 / side - 36, z = (j + .5) * 72 / side - 36
    let nearest = Infinity, inside = false
    for (let k = 0; k < rim.length; k++) {
      const [a, b] = rim[k], [c, d] = rim[(k + 1) % rim.length]
      const dx = c - a, dz = d - b
      const f = Math.max(0, Math.min(1, ((x - a) * dx + (z - b) * dz) / (dx * dx + dz * dz)))
      nearest = Math.min(nearest, (x - a - dx * f) ** 2 + (z - b - dz * f) ** 2)
      if ((b > z) !== (d > z) && x < a + dx * (z - b) / dz) inside = !inside
    }
    const signed = Math.sqrt(nearest) * (inside ? -1 : 1)
    data[j * side + i] = Math.round(255 * Math.max(0, Math.min(1, .5 + signed / 16)))
  }
  const map = new T.DataTexture(data, side, side, T.RedFormat)
  map.minFilter = map.magFilter = T.LinearFilter
  map.needsUpdate = true
  return map
}
