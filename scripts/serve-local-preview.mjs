// Keep manual preview progress separate from the browser tests, which reset their fixture.
process.env.KOTOBA_LOCAL_PREVIEW = '1';
await import('./serve-browser-tests.mjs');
