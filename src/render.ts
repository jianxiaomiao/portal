import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import App from './App.vue'
import { pageTitles } from './catalog'
export const routes = Object.keys(pageTitles)
export async function render(route: string, template: string) {
  const html = await renderToString(createSSRApp(App, { route }))
  return template
    .replace('PORTAL_PAGE_TITLE', pageTitles[route])
    .replace('<!--portal-content-->', () => html)
}
