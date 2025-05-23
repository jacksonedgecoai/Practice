(async () => {
  const open = await import('open');

  open.default('https://google.com')
    .then(() => console.log('✅ Browser opened successfully'))
    .catch(err => console.error('❌ Failed to open browser:', err.message));
})();