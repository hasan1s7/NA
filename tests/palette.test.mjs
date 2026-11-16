import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PALETTES,normalizePalette,isPagesHost} from '../public/nabu-palette.js';
test('palette preferences accept only bundled templates and default to original green',()=>{
 assert.equal(normalizePalette(undefined),'green');
 for(const value of ['bad','__proto__','<style>','GREEN',{},null])assert.equal(normalizePalette(value),'green');
 for(const p of PALETTES)assert.equal(normalizePalette(p.id),p.id);
 assert.equal(PALETTES.find(p=>p.id==='green').accent,'#24624f');
});
test('Pages classification does not classify a server or lookalike domain as static hosting',()=>{
 for(const h of ['hasan1s7.github.io','github.io'])assert.equal(isPagesHost(h),true);
 for(const h of ['localhost','127.0.0.1','github.io.attacker.invalid','fakegithub.io','nabu.example'])assert.equal(isPagesHost(h),false);
});
test('palette template text and primary buttons meet WCAG AA normal-text contrast',()=>{
 const css=readFileSync(new URL('../public/nabu-palette.css',import.meta.url),'utf8');
 const luminance=hex=>{const values=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
 const contrast=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 for(const p of PALETTES){const block=css.match(new RegExp(':root\\[data-nabu-palette="'+p.id+'"\\]\\{([^}]+)\\}'))[1];const vars=Object.fromEntries([...block.matchAll(/--([a-z-]+):(#[0-9a-f]{6})/g)].map(m=>[m[1],m[2]]));
  assert.ok(contrast(vars.ink,vars.paper)>=4.5,p.id+' body');assert.ok(contrast(vars.muted,vars.white)>=4.5,p.id+' muted');assert.ok(contrast('#ffffff',vars.green)>=4.5,p.id+' button');assert.ok(contrast(vars.green,vars.paper)>=4.5,p.id+' link');
 }
});
