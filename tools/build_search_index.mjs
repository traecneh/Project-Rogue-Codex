import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Reuse the catalog's existing normalization and visibility rules during publishing.
const root = path.resolve(process.argv[2] || '.');
const pageText = JSON.parse(fs.readFileSync(0, 'utf8'));
const readJson = url => JSON.parse(fs.readFileSync(path.join(root, new URL(url, 'https://codex.local/').pathname), 'utf8'));
const allow = readJson('data/allowlists.json');
const failures=[];
const fetchJson = async url => {
  try {return readJson(url)} catch(error) { failures.push(`${url}: ${error.message}`); throw error; }
};
const context = vm.createContext({URL, URLSearchParams, console, fetch:async url => ({ok:true,json:()=>fetchJson(url)}), window:{location:{origin:'https://codex.local',pathname:'/index.html',href:'https://codex.local/index.html'},RogueCodexUtils:{
  fetchJsonCached:fetchJson,
  loadAllowlists:async()=>({...allow,monsters:{...allow.monsters,blockIds:allow.monsters?.block_ids||[]},weapons:{...allow.weapons,blockIds:allow.weapons?.block_ids||[]}})
}}});
const runtime=fs.readFileSync(path.join(root,'js/site-search.js'),'utf8');
const catalog=runtime.slice(0,runtime.indexOf('const MAX_SEARCH_RESULTS'));
vm.runInContext(catalog+fs.readFileSync(path.join(root,'tools/search-index-source.js'),'utf8'), context);
const result=await vm.runInContext(`(async()=>{
  await Promise.all([loadMonsterSearchIndex(),loadWeaponSearchIndex(),loadArmorSearchIndex(),loadQuestSearchIndex(),loadMiscItemSearchIndex(COLLECTABLE_SEARCH_CONFIG),loadMiscItemSearchIndex(USEABLE_SEARCH_CONFIG),loadPerkIndex()]);
  return {
    entries:NORMALIZED_SEARCH_INDEX.concat(MONSTER_SEARCH_INDEX,WEAPON_SEARCH_INDEX,ARMOR_SEARCH_INDEX,QUEST_SEARCH_INDEX,COLLECTABLE_SEARCH_CONFIG.index,USEABLE_SEARCH_CONFIG.index),
    perks:[...PERK_NAME_INDEX.values()].map(p=>({...p,details:p.details.slice(0,1)})),
    tatters:[...MONSTER_TATTER_INDEX.entries()].map(([name,list])=>[name,list.map(e=>({...e,monster:{name:e.monster.name,slug:e.monster.slug}}))])
  };
})()`,context);
if(failures.length)throw new Error(failures.join('\n'));
if(result.entries.length<100)throw new Error('Search index is unexpectedly empty');
for(const entry of result.entries){
  for(const key of ['titleLower','descriptionLower','categoryLower','keywordsLower'])delete entry[key];
  if(pageText[entry.url])entry.fullText=pageText[entry.url].toLowerCase();
}
process.stdout.write(JSON.stringify({schema:1,...result}));
