import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('배포 HTML은 내용이 바뀔 때 새 주소로 JS·CSS를 요청한다', async () => {
  const version = createHash('sha256').update(await readFile('dist/client/app.js')).update(await readFile('dist/client/app.css')).digest('hex').slice(0,16);
  const entry=(await readdir('dist/client')).find(f=>/^app-[A-Za-z0-9_-]+\.js$/.test(f));
  assert.ok(entry,'content-hashed entry exists');
  assert.deepEqual(await readFile('dist/client/'+entry),await readFile('dist/client/app.js'));
  for (const file of ['404.html','app.html','start.html','pricing.html']) {
    const html = await readFile('dist/client/'+file,'utf8');
    assert.ok(html.includes('/'+entry), file+' script version');
    assert.ok(html.includes('/app.css?v='+version), file+' style version');
  }
  for(const file of await readdir('dist/client/chunks')){
    const chunk=await readFile('dist/client/chunks/'+file,'utf8');
    assert.ok(!/['"]\.\.\/app\.js['"]/.test(chunk),file+' must share the versioned entry module');
  }
});
