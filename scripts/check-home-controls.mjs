import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

// Execute the production experience module with DOM event ordering:
// focusing the play button precedes its click, including on touch devices.
const elements=new Map(),listeners=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{id,textContent:'',innerHTML:'',dataset:{},classList:{toggle(){return false},remove(){}},setAttribute(k,v){this[k]=v}});return elements.get(id)};
const host={dataset:{},classList:{toggle(){return false},remove(){}},querySelector:element,addEventListener:(type,fn)=>listeners.set(type,fn)};
const context={document:{querySelector:()=>host,getElementById:element,addEventListener(){},hidden:false},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null},IntersectionObserver:class{observe(){}},setInterval(){},setTimeout(){},Date,console};
const source=stripTypeScriptTypes(await readFile('site/experience.ts','utf8'),{mode:'strip'}).replace(/^export\s*\{\s*\};?/m,'');
vm.runInNewContext(source,context);
const play=element('exp-play');play.closest=selector=>selector==='button'||selector==='#exp-play'?play:null;
assert.match(element('exp-screen').innerHTML,/월간 자동 편성은 개선 예정/,'planned monthly flow is disclosed before its action');
assert(element('exp-screen').innerHTML.indexOf('개선 예정')<element('exp-screen').innerHTML.indexOf('data-advance'),'availability appears above the action');
assert.equal(play['aria-pressed'],'true','autoplay starts enabled');
listeners.get('focusin')({target:play});listeners.get('click')({target:play});
assert.equal(play['aria-pressed'],'false','first focused click must stop autoplay');
listeners.get('click')({target:play});assert.equal(play['aria-pressed'],'true','next click resumes');
listeners.get('focusin')({target:{closest:()=>null}});assert.equal(play['aria-pressed'],'false','other controls pause to allow interaction');
console.log('PASS: homepage play/pause survives focus-before-click and other controls pause autoplay');
const manual={dataset:{chapter:'6'},closest(){return this}};
listeners.get('click')({target:manual});
assert.match(element('exp-screen').innerHTML,/사진·설명 매뉴얼은 이용할 수 있어요/);
assert.match(element('exp-screen').innerHTML,/영상 매뉴얼은 추가 예정/);
assert(element('exp-screen').innerHTML.indexOf('영상 매뉴얼은 추가 예정')<element('exp-screen').innerHTML.indexOf('data-advance'),'video status appears before manual actions');
console.log('PASS: current and planned feature availability precedes experience actions');
