import test from 'node:test';
import assert from 'node:assert/strict';
import {transliterate as convert, readingForCard, READING_SCHEMES} from '../public/nabu-transliteration.js';
import * as C from '../public/nabu-core.js';
const reading=(text,sourceLanguage,more={})=>convert({text,sourceLanguage,...more});
const cases=[
 ['ru','\u041f\u0440\u0438\u0432\u0435\u0442, Nabu!','Privet, Nabu!'],
 ['ru','\u0429\u0423\u041a\u0410','SHCHUKA'],
 ['ru','\u0429\u0443\u043a\u0430','Shchuka'],
 ['ru','\u0435\u0308\u043b\u043a\u0430','yolka'],
 ['ru','\u043c\u0430\u0301\u043c\u0430','m\u00e1ma'],
 ['ru','\u043e\u0431\u044a\u0435\u043a\u0442, \u0441\u0435\u043c\u044c','ob\u02baekt, sem\u02b9'],
 ['ar','\u0643\u062a\u0628','ktb'],
 ['ar','\u0643\u064e\u062a\u064e\u0628\u064e','kataba'],
 ['ar','\u0643\u0650\u062a\u064e\u0627\u0628\u064c','kit\u0101bun'],
 ['ar','\u0645\u064f\u062f\u064e\u0631\u0650\u0651\u0633','mudarris'],
 ['ar','\u0645\u064f\u062f\u064e\u0631\u0651\u0650\u0633','mudarris'],
 ['ar','\u0623\u062d\u0645\u062f','\u02be\u1e25md'],
 ['ar','\u0623\u064e\u062d\u0652\u0645\u064e\u062f','\u02bea\u1e25mad'],
 ['ar','\u0646\u064f\u0648\u0631','n\u016br'],
 ['ar','\u0641\u0650\u064a','f\u012b'],
 ['ar','\u0645\u0640\u0627\u0621\u060c Nabu 2026.','m\u0101\u02be\u060c Nabu 2026.'],
 ['ko','\ud55c\uae00','hangeul'],
 ['ko','\u1100\u1161','ga'],
 ['ko','\ud55c\uae00, Nabu 42!','hangeul, Nabu 42!'],
 ['ja','\u307f\u305a','mizu'],
 ['ja','\u304d\u3083\u304f','kyaku'],
 ['ja','\u304c\u3063\u3053\u3046','gakkou'],
 ['ja','\u30b3\u30fc\u30d2\u30fc','koohii'],
 ['ja','\u3057\u3093\u3088\u3046','shin\u0027you'],
 ['ja','\u3067\u3093\u3042\u3064','den\u0027atsu'],
 ['ja','\uff76\uff80\uff76\uff85','katakana'],
 ['ja','Nabu: \u30c6\u30a3\u30fc!','Nabu: tii!'],
 ['ja','\u306f\u3001\u3078\u3001\u3092\u3002','ha\u3001he\u3001wo\u3002'],
 ['ja','\u3061\u3083\u3063\u3068','chatto'],
 ['ja','\u304d\u3093\u3044\u308d',"kin'iro"],
 ['ar','\u0634\u064f\u0643\u0652\u0631\u064b\u0627','shukran'],
 ['ar','\u0634\u064f\u0643\u0652\u0631\u0627\u064b','shukran'],
 ['ja','\u304a\u3063\u3061\u3083\u3093','otchan'],
];
for(const [lang,input,output] of cases)test(`reading fixture ${lang}: ${input}`,()=>{const r=reading(input,lang);assert(r.available,r.warning);assert.equal(r.output,output);assert.equal(r.text,output);assert.equal(r.input,input.normalize('NFC'));assert.equal(r.targetScript,'Latn');});
for(const [lang,text] of [['en','OpenAI 42.'],['es','alcanc\u00e9'],['fr','\u00e9t\u00e9'],['de','Gr\u00fc\u00dfe'],['it','citt\u00e0'],['pt','a\u00e7\u00e3o'],['tr','\u0130stanbul, \u0131\u015f\u0131k']])test(`original ${lang} preserves diacritics without pronunciation claim`,()=>{const r=reading(text,lang);assert.equal(r.output,text);assert.equal(r.scheme,'original-latin-v1');assert.match(r.warning,/not a pronunciation/);});
test('all and only the twelve app languages have declared behavior',()=>assert.deepEqual(Object.keys(READING_SCHEMES).sort(),C.LANGUAGES.map(x=>x[0]).sort()));
test('empty, unsupported languages, wrong scripts and schemes return honest unavailable',()=>{for(const spec of [{text:'',sourceLanguage:'ru'},{text:'test',sourceLanguage:'xx'},{text:'\u041f\u0440\u0438\u0432\u0435\u0442',sourceLanguage:'ar'},{text:'hello',sourceLanguage:'ru'},{text:'\u0643\u062a\u0628',sourceLanguage:'ar',targetScript:'Cyrl'},{text:'\u0643\u062a\u0628',sourceLanguage:'ar',scheme:'ISO-233'},{text:'\u0643\u062a\u0628',sourceLanguage:'ar',sourceScript:'Cyrl'}]){const r=convert(spec);assert.equal(r.status,'unavailable',JSON.stringify(spec));assert.equal(r.output,'');assert(r.warning);}});
test('Arabic does not invent missing vowels and orders shadda independently of input ordering',()=>{const plain=reading('\u0643\u062a\u0628','ar');assert.equal(plain.status,'approximate');assert.match(plain.warning,/Missing vowels/);assert.equal(reading('\u062f\u0651\u064e','ar').text,reading('\u062f\u064e\u0651','ar').text);assert.equal(reading('\u062f\u0651\u064e','ar').text,'dda');});
test('unmapped Arabic letters and marks stay visible with a partial warning',()=>{const r=reading('\u0628\u067e\u06e3','ar');assert(r.partial);assert.match(r.output,/\u067e/);assert.match(r.warning,/Unsupported/);});
test('mixed Russian and unrelated scripts are not silently relabelled',()=>{const r=reading('\u041f\u0440\u0438\u0432\u0435\u0442 \u4e2d\u6587','ru');assert(r.partial);assert.equal(r.status,'approximate');assert.match(r.text,/\u4e2d\u6587/);});
test('Korean declared scheme does not claim sound-change Romanization',()=>{assert.match(reading('\ud55c\uae00','ko').warning,/not official Revised Romanization/);assert.equal(reading('\u3131','ko').status,'unavailable');});
test('Japanese kanji require a genuine whole-word reading even if a generic bank hint exists',()=>{assert.equal(readingForCard({front:'\u9280\u884c',sourceLang:'ja'},'Yin Xing').available,false);assert.equal(reading('\u6c34\u3092\u306e\u3080','ja').available,false);});
test('Chinese generic character conversion is not relabelled dictionary-derived',()=>assert.equal(readingForCard({front:'\u94f6\u884c',sourceLang:'zh-CN'},'Yin Xing').status,'unavailable'));
test('dictionary adapter binds the entire word, language, scheme and provenance',()=>{const d={input:'\u9280\u884c',sourceLanguage:'ja',reading:'ginkou',source:'TEST fixture word dictionary',targetScript:'Latn',scheme:'TEST-word-reading',verified:true};const r=reading(d.input,'ja',{dictionaryReading:d});assert.equal(r.status,'dictionary-derived');assert.equal(r.output,d.reading);assert.equal(r.dictionarySource,d.source);assert.equal(reading('\u6c34','ja',{dictionaryReading:d}).status,'unavailable');assert.equal(reading(d.input,'ja',{dictionaryReading:{...d,verified:false}}).status,'unavailable');});
test('Japanese unhandled small kana and dangling gemination are visible, not invented',()=>{const r=reading('\u3041\u3063','ja');assert(r.partial);assert.equal(r.output,'\u3041\u3063');});
test('saved correction wins even for unavailable kanji; original word/context unchanged',()=>{const c={front:'\u6c34',sourceLang:'ja',context:'\u6c34\u3092\u98f2\u3080\u3002',reading:'my checked reading',readingMethod:'User reading aid'};const before=JSON.stringify(c);const r=readingForCard(c,'Shui');assert.equal(r.status,'user-provided');assert.equal(r.output,c.reading);assert.equal(JSON.stringify(c),before);});
test('cleared reading is not replaced by automatic output',()=>{const r=readingForCard({front:'\u041f\u0440\u0438\u0432\u0435\u0442',sourceLang:'ru',reading:'',readingMethod:'User reading aid (hidden)'});assert.equal(r.hidden,true);assert.equal(r.available,false);assert.equal(r.text,'');});
test('oversized reading input is rejected without truncating the original',()=>assert.equal(reading('a'.repeat(10001),'en').status,'unavailable'));

test('an explicit dictionary request never silently uses a different kana scheme',()=>assert.equal(reading('\u307f\u305a','ja',{scheme:'dictionary'}).status,'unavailable'));

test('scheme hamza, ayn and soft/hard sign symbols are not mistaken for unmapped script',()=>{assert.equal(reading('\u0645\u0627\u0621','ar').partial,false);assert.equal(reading('\u0639\u064e\u0644\u064e\u0645','ar').partial,false);assert.equal(reading('\u0441\u0435\u043c\u044c','ru').partial,false);});

import {readFileSync} from 'node:fs';
test('web app and packaged extension use identical reading and media implementations',()=>{for(const name of ['nabu-media.js','nabu-transliteration.js'])assert.equal(readFileSync(new URL('../public/'+name,import.meta.url),'utf8'),readFileSync(new URL('../chrome-extension/'+name,import.meta.url),'utf8'));});
