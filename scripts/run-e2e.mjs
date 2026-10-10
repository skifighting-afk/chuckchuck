// Portable environment setup; shell-style VAR=value fails on Windows.
process.env.SUPABASE_URL='http://localhost:8790';
process.env.SUPABASE_ANON_KEY='anon-test-key';
process.env.APP_DOMAIN='';
await import('./portable-build.mjs');
await import('./e2e.mjs');
