import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const source = (await readFile(new URL('./public/profile-storage.js', import.meta.url), 'utf8'))
  .replaceAll('export const ', 'const ').replace('export { id, keyFor };', '')
  + '\nreturn {profileStorage, guestSession, id, keyFor, warnings};';
const store = () => { const values = new Map(); return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}; };
async function page(sessionStorage, localStorage, id = null, denied = null) {
  const warnings = [];
  const context = {
    fetch:async()=>({ok:true,json:async()=>({id})}), AbortSignal, crypto,
    sessionStorage, localStorage, warnings, window:{addEventListener(){}},
    document:{querySelector:()=>null,createElement:()=>({setAttribute(){}}),body:{prepend:node=>warnings.push(node)}}
  };
  if (denied) Object.defineProperty(context, denied, { get(){throw new Error('Storage access denied');} });
  return runInNewContext('(async()=>{' + source + '})()', context);
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

test('blocked session and local storage getters fall back without failing startup', async()=>{
  for (const [id, denied] of [[null,'sessionStorage'],['one','localStorage']]) {
    const result = await page(store(),store(),id,denied);
    result.profileStorage.setItem('draft','temporary');
    assert.equal(result.profileStorage.getItem('draft'),'temporary');
    assert.equal(result.warnings.length,1);
    assert.match(result.warnings[0].textContent,/lost when you refresh or leave/);
    assert.match(result.profileStorage.notice('Saved.'),/temporarily on this page only/);
    result.profileStorage.removeItem('draft');
    assert.equal(result.profileStorage.getItem('draft'),null);
    assert.equal((await page(store(),store(),id,denied)).profileStorage.getItem('draft'),null);
  }
});
test('read, write and removal failures fall back to temporary storage', async()=>{
  for (const method of ['getItem','setItem','removeItem']) {
    const broken = store(); broken[method] = ()=>{throw new Error('Storage blocked');};
    const result = await page(broken,store());
    result.profileStorage.setItem('draft','retained within this page');
    assert.equal(result.profileStorage.getItem('draft'),'retained within this page');
    assert.equal(result.warnings.length,1);
    result.profileStorage.removeItem('draft');
    assert.equal(result.profileStorage.getItem('draft'),null);
  }
});
test('storage becoming unavailable preserves work already read on the current page', async()=>{
  const session = store(); const result = await page(session,store());
  result.profileStorage.setItem('draft','existing work');
  assert.equal(result.profileStorage.getItem('draft'),'existing work');
  session.setItem = ()=>{throw new Error('Quota exceeded');};
  result.profileStorage.setItem('new draft','new work');
  assert.equal(result.profileStorage.getItem('draft'),'existing work');
  assert.equal(result.profileStorage.getItem('new draft'),'new work');
  assert.equal(result.warnings.length,1);
  assert.match(result.profileStorage.notice('Saved.'),/temporarily/);
});
