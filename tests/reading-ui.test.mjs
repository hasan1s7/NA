import test from 'node:test';
import assert from 'node:assert/strict';
import * as U from '../public/nabu-reading-ui.js';
import * as C from '../public/nabu-core.js';

test('source excerpt preserves the actual selected sentence, including punctuation',()=>{
 const text='First sentence. The water is cold. Last sentence.';
 assert.equal(U.sourceExcerpt(text,text.indexOf('water'),5),'The water is cold.');
});
test('Arabic question marks delimit source sentences without stripping diacritics',()=>{
 const text='\u0645\u062a\u0649\u061f \u0627\u0644\u0645\u064e\u0627\u0621\u064f \u0628\u0627\u0631\u062f. Next.';
 const word='\u0627\u0644\u0645\u064e\u0627\u0621\u064f';
 assert.equal(U.sourceExcerpt(text,text.indexOf(word),word.length),word+' \u0628\u0627\u0631\u062f.');
});
test('CJK sentence boundaries and paragraphs stay in the original source',()=>{
 const t='\u4f60\u597d\u3002\u6211\u559d\u6c34\u3002\nEnglish next.';
 assert.equal(U.sourceExcerpt(t,t.indexOf('\u6c34'),1),'\u6211\u559d\u6c34\u3002');
});
test('long source is bounded while retaining a late selection',()=>{
 const t='prefix '.repeat(400)+'selected'+' suffix'.repeat(400);
 const x=U.sourceExcerpt(t,t.indexOf('selected'),8);
 assert(x.length<=1500);assert(x.includes('selected'));assert(t.includes(x));
});
test('plain markup is escaped before highlighting',()=>{
 assert.equal(U.highlightContext('<script>water & tea</script>','water'), '&lt;script&gt;<mark>water</mark> &amp; tea&lt;/script&gt;');
});
test('no source match does not fabricate a quote or highlight',()=>{
 assert.equal(U.highlightContext('Actual source.','Not here'),'Actual source.');
 assert.equal(U.highlightContext('', 'word'),'');
});
test('only an exact spelling match is highlighted and no accent is folded',()=>{
 assert.equal(U.highlightContext('alcance / alcanc\u00e9','alcanc\u00e9'), 'alcance / <mark>alcanc\u00e9</mark>');
});
test('comparison uses real card identity and returns false for incomplete items',()=>{
 const a={front:'water',back:'agua',sourceLang:'en',targetLang:'es'};
 assert(U.sameIdentity(a,{...a},C.identity));
 assert(!U.sameIdentity(a,{...a,back:'other'},C.identity));
 assert(!U.sameIdentity(a,{...a,back:''},C.identity));
 assert(!U.sameIdentity(a,a,()=>{throw new Error('invalid')}));
});
test('selection capture refuses missing, outside, empty and oversized selections',()=>{
 assert.equal(U.captureSelection(null,{},''),null);
 const root={contains:()=>false};assert.equal(U.captureSelection({rangeCount:1},root,''),null);
 const inside={contains:()=>true};assert.equal(U.captureSelection({rangeCount:1,toString:()=>''},inside,''),null);
 assert.equal(U.captureSelection({rangeCount:1,toString:()=> 'a'.repeat(1001)},inside,''),null);
});
test('mixed-script markup isolates whole runs while preserving offsets and text',()=>{
 const words=['\u0647\u0646\u0627',' ','Nabu',' ','helps',' ','me',' ','read','. ','\u0645\u0627\u0621'];
 const tokens=words.map((text,i)=>({text,word:i%2===0}));const html=U.readingMarkup(tokens,4);
 assert(html.includes('<bdi class="reading-run" dir="rtl">'));
 assert(html.includes('<bdi class="reading-run" dir="ltr">'));
 assert.equal(html.replace(/<[^>]*>/g,''),words.join(''));
 assert(html.includes('data-index="4"'));
 assert.equal((html.match(/reading-run/g)||[]).length,3);
 assert(html.includes('</bdi> <bdi'), 'Whitespace stays between opposite-direction runs');
});
test('document direction uses untouched source instead of ignoring bdi children',()=>{
 assert.equal(U.textDirection('2026 / \u0623\u0642\u0631\u0623 Nabu'),'rtl');
 assert.equal(U.textDirection('Nabu / \u0645\u0627\u0621'),'ltr');
 assert.equal(U.textDirection('...123'),'ltr');
});
