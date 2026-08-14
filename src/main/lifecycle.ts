import { app } from 'electron';

/**
 * `before-quit` rather than `will-quit`: it is the last event that can still be cancelled, which
 * is the only way async plugin teardown actually finishes before the process goes away.
 */
export function installAutoDispose(dispose: () => Promise<void>): () => void {
  let running = false;

  const onBeforeQuit = (event: Electron.Event): void => {
    if (running) return;
    running = true;
    event.preventDefault();
    void dispose()
      .catch((error: unknown) => {
        console.error('capacitron: plugin teardown failed', error);
      })
      .finally(() => {
        app.quit();
      });
  };

  app.on('before-quit', onBeforeQuit);
  return () => app.off('before-quit', onBeforeQuit);
}
