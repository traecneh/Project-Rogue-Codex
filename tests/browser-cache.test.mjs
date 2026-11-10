import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../js/utils.js',import.meta.url),'utf8');
function page({session=new Map(),revision='release-one',manifestOK=true,storageOK=true,pages={}}={}) {
  const calls=[];
  let value=1;
  const context=vm.createContext({URL,console:{warn(){}},document:{baseURI:'https://codex.test/Project-Rogue-Codex/'},window:{location:{href:'https://codex.test/Project-Rogue-Codex/index.html',pathname:'/Project-Rogue-Codex/index.html'}},
    sessionStorage:{getItem:key=>{if(!storageOK)throw Error('blocked');return session.get(key)||null},setItem:(key,data)=>{if(!storageOK)throw Error('quota');session.set(key,data)}},
    fetch:async(url,options)=>{
      calls.push({url,options});
      if(url.includes('browser-release.json'))return {ok:manifestOK,json:async()=>({schema:1,files:{'pages/items/weapons_data05.json':revision},pages})};
      return {ok:true,json:async()=>({value:value++}),arrayBuffer:async()=>new ArrayBuffer(0)};
    }
  });
  vm.runInContext(source,context);
  return {api:context.window.RogueCodexUtils,calls,session};
}
const data='pages/items/weapons_data05.json';
const dataCalls=p=>p.calls.filter(c=>!c.url.includes('browser-release.json'));

test('shares concurrent requests across legacy schema URLs and cache aliases',async()=>{
  const p=page();
  const [a,b]=await Promise.all([p.api.fetchJsonCached(data+'?v=3',{cacheKey:'old'}),p.api.fetchJsonCached(data+'?v=5',{cacheKey:'other'})]);
  assert.equal(a,b);
  assert.equal(dataCalls(p).length,1);
  assert.equal(new URL(dataCalls(p)[0].url).searchParams.get('v'),'release-one');
  assert.equal(p.calls.filter(c=>c.url.includes('browser-release.json')).length,1);
});
test('reuses session data on another document but invalidates a changed content version',async()=>{
  const first=page();await first.api.fetchJsonCached(data);
  const next=page({session:first.session});await next.api.fetchJsonCached(data+'?v=9');
  assert.equal(dataCalls(next).length,0);
  const changed=page({session:first.session,revision:'release-two'});await changed.api.fetchJsonCached(data);
  assert.equal(dataCalls(changed).length,1);
  assert.equal(new URL(dataCalls(changed)[0].url).searchParams.get('v'),'release-two');
});
test('revalidates data when the release manifest cannot be checked',async()=>{
  const first=page();await first.api.fetchJsonCached(data);
  const failure=page({session:first.session,manifestOK:false});
  await failure.api.fetchJsonCached(data);
  assert.equal(dataCalls(failure).length,1);
  assert.equal(dataCalls(failure)[0].options.cache,'no-cache');
});
test('still shares in-memory data when browser storage is unavailable',async()=>{
  const p=page({storageOK:false});await p.api.fetchJsonCached(data);await p.api.fetchJsonCached(data);
  assert.equal(dataCalls(p).length,1);
});
test('an explicit refresh updates subsequent cached reads',async()=>{
  const p=page();await p.api.fetchJsonCached(data);
  const fresh=await p.api.fetchJsonCached(data,{forceFresh:true});
  assert.equal(fresh.value,2);
  assert.equal((await p.api.fetchJsonCached(data)).value,2);
  assert.equal(dataCalls(p).length,2);
  assert.equal(dataCalls(p)[1].options.cache,'no-cache');
});

test('prefetch warms the same versioned data used by the next page and deduplicates shared assets',async()=>{
  const descriptor={assets:['js/utils.js?v=test'],data:[data],images:[]};
  const p=page({pages:{'pages/items/weapons.html':descriptor,'pages/items/armors.html':descriptor}});
  await Promise.all([p.api.prefetchPage('pages/items/weapons.html'),p.api.prefetchPage('pages/items/weapons.html')]);
  await p.api.prefetchPage('pages/items/armors.html');
  await p.api.fetchJsonCached(data+'?v=5');
  assert.equal(p.calls.filter(c=>c.url.includes('weapons_data05.json')).length,1);
  assert.equal(p.calls.filter(c=>c.url.includes('js/utils.js')).length,1);
  assert.equal(p.calls.find(c=>c.url.includes('weapons_data05.json')).options.priority,'low');
});
test('prefetch ignores external, current-page, and unknown destinations',async()=>{
  const p=page();
  assert.equal(await p.api.prefetchPage('https://outside.test/page.html'),false);
  assert.equal(await p.api.prefetchPage('index.html#story'),false);
  assert.equal(await p.api.prefetchPage('pages/missing.html'),false);
  assert.equal(dataCalls(p).length,0);
});
