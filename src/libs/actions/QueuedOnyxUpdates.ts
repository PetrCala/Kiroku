import type {OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';

// In this file we manage a queue of Onyx updates while the SequentialQueue is processing. There are functions to get the updates and clear the queue after saving the updates in Onyx.

let queuedOnyxUpdates: OnyxUpdate[] = [];

/**
 * @param updates Onyx updates to queue for later
 */
function queueOnyxUpdates(updates: OnyxUpdate[]): Promise<void> {
  queuedOnyxUpdates = queuedOnyxUpdates.concat(updates);
  return Promise.resolve();
}

function flushQueue(): Promise<void> {
  // Hand the queue off before applying it. `Onyx.update` resolves only once
  // its subscriber batch has flushed (a macrotask later); clearing after that
  // left a window in which a second drain (a write pushed and answered in the
  // meantime) applied these same updates again, and anything queued during
  // the window was wiped by the late clear.
  const updates = queuedOnyxUpdates;
  queuedOnyxUpdates = [];
  return Onyx.update(updates);
}

function isEmpty() {
  return queuedOnyxUpdates.length === 0;
}

export {queueOnyxUpdates, flushQueue, isEmpty};
