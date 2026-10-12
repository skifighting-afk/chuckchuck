import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../site/home.css',import.meta.url),'utf8');
const luminance=hex=>{const rgb=hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
const contrast=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
const colors=[...css.matchAll(/(?<![-\w])color:(#[0-9a-f]{6})(?=[;}!])/gi)].map(m=>m[1].toLowerCase());
// These muted colors were measured below4.5 against the actual paper/panel backgrounds.
for(const color of ['#7a8977','#6b7b6d','#89917f','#627060','#65745b','#728071','#8b9482','#84917c','#9ba58c','#7c8974','#6d7e62']){
 if(colors.includes(color))assert(contrast(color,'#e5eadf')>=4.5,`unreadable secondary text ${color}`);
}
const secondary=css.match(/--secondary-ink:(#[0-9a-f]{6})/i)?.[1];
assert(secondary,'secondary text has a shared color');
assert(contrast(secondary,'#e5eadf')>=4.5,'secondary text works on the darkest information panel');
assert(!/\.exp-disclaimer\{[^}]*font-size:10px!important/.test(css),'example notice can be enlarged');
const heroTarget=Number(css.match(/\.hero \.cta-row \.btn-ghost\{min-height:(\d+)px/)?.[1]);
assert(heroTarget>=48,'mobile hero secondary CTA must be at least48px');
console.log('PASS homepage secondary-text contrast, notice minimum and48px hero target');
