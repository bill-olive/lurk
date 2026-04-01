// =============================================================================
// Lurk Desktop — CLI entry point (standalone mode without Electron)
//
// For development/testing. Production uses the Electron main process.
// =============================================================================

import { LurkDaemon } from './daemon';

const daemon = new LurkDaemon();

daemon.start().then(() => {
  console.log();
  console.log('╔══════════════════════════════════════╗');
  console.log('║       Lurk Desktop Daemon v0.1       ║');
  console.log('╚══════════════════════════════════════╝');
  console.log();
  console.log('Running in standalone mode (no tray icon).');
  console.log('For the full menu bar app, run: npm run dev');
  console.log();

  const shutdown = async () => {
    await daemon.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
