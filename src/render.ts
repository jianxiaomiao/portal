import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import App from './App.vue'
import { pageTitles } from './catalog'
import { DOMESTIC_SITE_NAME } from './config/projects'
export const routes = Object.keys(pageTitles)
export async function render(route: string, template: string) {
  const html = await renderToString(createSSRApp(App, { route, domestic: __PORTAL_DOMESTIC__ }))
  const title = __PORTAL_DOMESTIC__ && route === '/' ? DOMESTIC_SITE_NAME : pageTitles[route]
  return template
    .replace('PORTAL_PAGE_TITLE', title)
    .replace('<!--portal-content-->', () => html)
}
