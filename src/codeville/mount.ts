import { createApp, h, reactive } from 'vue'
import Explore from './App.vue'
import './style.css'

export function mountTown(container: HTMLElement, compact: boolean) {
  const state = reactive({ compact, navigation: 0 })
  const app = createApp({ render: () => h(Explore, { ...state }) })
  app.mount(container)
  return {
    navigate(preview: boolean) {
      state.compact = preview
      state.navigation++
    },
    dispose() {
      app.unmount()
    },
  }
}
