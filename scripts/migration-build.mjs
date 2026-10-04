import {build} from 'rolldown';
import {writeFile} from 'node:fs/promises';
await build({input:'db/schema.ts',external:['drizzle-orm/sqlite-core'],output:{file:'work/schema.cjs',format:'cjs'}});
await writeFile('work/drizzle.cjs',"module.exports={out:'./drizzle',schema:'./work/schema.cjs',dialect:'sqlite'}");
