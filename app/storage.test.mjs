import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const source = (await readFile(new URL('./public/profile-storage.js', import.meta.url), 'utf8'))
  .replace('const session = await fetch', 'const session = await fetch')
  .replaceAll('export const ', 'const ').replace('export { id, keyFor };', '')
  + '\nreturn {profileStorage, guestSession, id, keyFor};';
const store = () => { const values = new Map(); return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}; };
async function page(sessionStorage, localStorage, id = null) {
  return runInNewContext('(async()=>{' + source + '})()', {
    fetch:async()=>({ok:true,json:async()=>({id})}), AbortSignal, crypto,
    sessionStorage, localStorage, window:{addEventListener(){}},document:{querySelector:()=>null}
  });
}
test('guest work survives reload and navigation while a new tab starts empty', async()=>{
  const session = store(), local = store();
  const first = await page(session, local);
  for (const key of ['commencely-profile-v1','commencely-budget-v1','commencely-resume-builder-v1']) first.profileStorage.setItem(key,'draft');
  const reload = await page(session, local);
  assert.equal(reload.guestSession,first.guestSession);
  assert.equal(reload.profileStorage.getItem('commencely-resume-builder-v1'),'draft');
  const anotherTab = await page(store(),local);
  assert.notEqual(anotherTab.guestSession, first.guestSession);
  assert.equal(anotherTab.profileStorage.getItem('commencely-resume-builder-v1'),null);
  reload.profileStorage.removeItem('commencely-resume-builder-v1');
  assert.equal((await page(session,local)).profileStorage.getItem('commencely-resume-builder-v1'),null);
});
test('account drafts are scoped to the signed-in account', async()=>{
  const session = store(), local = store();
  const first = await page(session,local,'one'); first.profileStorage.setItem('draft','account one');
  assert.equal((await page(session,local,'two')).profileStorage.getItem('draft'),null);
  assert.equal((await page(session,local)).profileStorage.getItem('draft'),null);
  assert.equal((await page(store(),local,'one')).profileStorage.getItem('draft'),'account one');
});
