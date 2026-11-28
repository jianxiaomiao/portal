import {snap,settle} from './common.mjs'
export const button=(p,name)=>p.getByRole('button',{name,exact:true})
export async function openChapter(p,id,scenario='normal',auto=false) {
  await p.locator('[data-place="hub"]').click()
  await button(p,{'chat':'实时客服通信',api:'API 请求',journey:'可靠工单投递'}[id]).click()
  if(id==='chat')await p.getByLabel('客服剧情').selectOption(scenario)
  if(id==='journey')await p.getByLabel('选择剧情').selectOption('normal')
  await button(p,auto?'自动播放':'分步播放').click()
  await p.waitForFunction(key=>Boolean(window.__cv.snapshot()[key]),id)
}
export async function next(p) {await button(p,'下一步').click();return (await snap(p)).chat}
export async function exit(p) {await p.keyboard.press('Escape');await settle(p)}
export const resources=p=>p.evaluate(()=>{
  const cv=window.__cv,s=cv.snapshot()
  return {geometry:s.geometries,material:cv.materialCount(),texture:s.textures,model:s.modelCount,owners:s.motion.owners}
})
