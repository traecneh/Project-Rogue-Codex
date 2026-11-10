import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Target {
  isConnected=true;
  attributes=new Map();
  textContent='';
  replaceChildren(...children){this.textContent=children.map(c=>c.textContent||'').join('')}
  setAttribute(k,v){this.attributes.set(k,v)}
  removeAttribute(k){this.attributes.delete(k)}
}
function loader(load){
  const context=vm.createContext({URL,console:{warn(){}},window:{location:{href:'https://codex.test/index.html'}},document:{baseURI:'https://codex.test/',createTextNode:text=>({textContent:text})},fetch:async()=>({ok:false})});
  vm.runInContext(fs.readFileSync(new URL('../js/utils.js',import.meta.url),'utf8'),context);
  return context.window.RogueCodexUtils.createDeferredData(load);
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('a late response updates only the latest selected record',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve});
  const deferred=loader(()=>gate);const target=new Target();const rendered=[];
  deferred.fill(target,()=>rendered.push('old'));
  deferred.fill(target,()=>rendered.push('current'));
  assert.equal(target.textContent,'Loading…');
  release();await deferred.load();await tick();
  assert.deepEqual(rendered,['current']);
  assert.equal(target.attributes.has('aria-busy'),false);
});
test('removed details are not rendered after loading completes',async()=>{
  let release;const deferred=loader(()=>new Promise(resolve=>{release=resolve}));
  const target=new Target();let rendered=false;
  deferred.fill(target,()=>{rendered=true});await tick();
  target.isConnected=false;release();await deferred.load();await tick();
  assert.equal(rendered,false);
});
test('optional failures stay inside their detail section',async()=>{
  const deferred=loader(()=>Promise.reject(Error('offline')));const target=new Target();
  deferred.fill(target,()=>assert.fail('failed data must not render'),{errorText:'Sources unavailable'});
  await tick();
  assert.equal(target.textContent,'Sources unavailable');
  assert.equal(target.attributes.has('aria-busy'),false);
});
