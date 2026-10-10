import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('배포 HTML은 내용이 바뀔 때 새 주소로 JS·CSS를 요청한다', async () => {
  const version = createHash('sha256').update(await readFile('dist/client/app.js')).update(await readFile('dist/client/app.css')).digest('hex').slice(0,16);
  for (const file of ['404.html','app.html','start.html','pricing.html']) {
    const html = await readFile('dist/client/'+file,'utf8');
    assert.ok(html.includes('/app.js?v='+version), file+' script version');
    assert.ok(html.includes('/app.css?v='+version), file+' style version');
  }
});
