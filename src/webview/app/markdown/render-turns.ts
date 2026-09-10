/**
 * One diagram renderer at a time.
 *
 * Mermaid keeps a single global configuration: `initialize` writes it, `render`
 * reads it, and `render` queues behind whatever is already running. Configuring
 * and then rendering is therefore two steps that another diagram can get
 * between — a second `initialize` lands while the first `render` is still
 * queued, and the first diagram comes out in the second one's palette. With one
 * palette per page that goes unnoticed until the reader switches scheme, which
 * is exactly when every diagram re-renders at once.
 *
 * So each configure-and-render pair takes a turn. The queue is per module rather
 * than per diagram, because the thing being taken turns over is global.
 */

let queue: Promise<unknown> = Promise.resolve();

/**
 * Runs `work` once every turn taken before it has finished, and hands back what
 * it returns.
 *
 * A turn that throws is still a turn: the next one runs, and the rejection goes
 * to the caller that asked for the work rather than to whoever is behind them
 * in the queue.
 */
export const takeRenderTurn = <T>(work: () => Promise<T>): Promise<T> => {
  const turn = queue.then(work, work);
  queue = turn.then(
    () => undefined,
    () => undefined,
  );
  return turn;
};
