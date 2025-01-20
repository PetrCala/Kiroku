import {useState, useRef, useCallback, useEffect} from 'react';
import {Alert} from 'react-native';
import {mergeUpdates} from '@database/updates';
import useLocalize from './useLocalize';

/**
 * Custom React hook for batching and processing updates with a specified delay.
 *
 * NOTE: This hook should only be used for non-nested objects. If you need to batch updates for nested objects, consider using a different approach.
 *
 * The `useBatchedUpdates` hook allows you to accumulate multiple updates and process them
 * in a single batch after a period of inactivity. This is useful for optimizing performance
 * by reducing the number of state updates or network requests.
 *
 * **Features:**
 * - **Debouncing:** Waits for a specified delay before processing the accumulated updates.
 * - **Synchronization:** Ensures that only one synchronization process runs at a time.
 * - **Retry Mechanism:** Retries processing updates up to a maximum number of attempts if failures occur.
 * - **Pending State:** Provides a state indicator to show if updates are currently being processed.
 *
 * @param processUpdates - An asynchronous function that takes the accumulated updates and processes them.
 *                          It should return a `Promise<void>`. This function is called with the merged
 *                          updates after the debounce delay.
 * @param delay - (Optional) The debounce delay in milliseconds before processing the updates.
 *                Defaults to `500` milliseconds.
 *
 * @returns An object containing:
 * - `isPending`: A boolean indicating whether the updates are currently being processed.
 * - `enqueueUpdate`: A function to enqueue a new update. It accepts an update object that will be merged with existing updates and scheduled for processing.
 * - `syncingRef`: A reference to a boolean value that indicates whether synchronization is currently in progress.
 *
 * @example
 * ```typescript
 * const processUpdates = async (updates: any) => {
 *   // Handle the batched updates, e.g., send to an API or update a database
 * };
 *
 * const MyComponent = () => {
 *   const { isPending, enqueueUpdate } = useBatchedUpdates(processUpdates, 1000);
 *
 *   const handleChange = (newData: any) => {
 *     enqueueUpdate(newData);
 *   };
 *
 *   return (
 *     <div>
 *       <input onChange={(e) => handleChange(e.target.value)} />
 *       {isPending && <span>Saving...</span>}
 *     </div>
 *   );
 * };
 * ```
 */
const useBatchedUpdates = (
  processUpdates: (updates: any) => Promise<void>,
  delay = 500,
) => {
  const {translate} = useLocalize();
  const [isPending, setIsPending] = useState(false);
  const updatesRef = useRef<any>({});
  const syncingRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const retriesRef = useRef<number>(0);
  const maxRetries = 1;

  const enqueueUpdate = useCallback(
    (update: any) => {
      // Merge the new update into the accumulated updates, removing any conflicts
      updatesRef.current = mergeUpdates(updatesRef.current, update);

      setIsPending(true);

      // Reset the timer every time an update is enqueued
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Schedule synchronization after 'delay' milliseconds of inactivity
      timerRef.current = setTimeout(() => {
        if (syncingRef.current) {
          // If synchronization is already in progress, reschedule
          timerRef.current = setTimeout(() => {
            enqueueUpdate({});
          }, delay);
          return;
        }

        if (Object.keys(updatesRef.current).length === 0) {
          // No updates to process
          setIsPending(false);
          return;
        }

        // Start synchronization
        syncingRef.current = true;

        (async () => {
          const updatesToProcess = {...updatesRef.current};
          try {
            await processUpdates(updatesToProcess);

            // Remove processed updates from the pool only if they haven't changed during synchronization, meaning if a new update to that key was enqueued
            Object.keys(updatesToProcess).forEach(key => {
              if (updatesRef.current[key] === updatesToProcess[key]) {
                delete updatesRef.current[key];
              }
            });
            retriesRef.current = 0;
          } catch (error) {
            Alert.alert(translate('database.error.saveData'));
            retriesRef.current += 1;
          } finally {
            syncingRef.current = false;
            // If new updates arrived during synchronization, schedule another sync
            if (
              Object.keys(updatesRef.current).length > 0 &&
              retriesRef.current < maxRetries
            ) {
              enqueueUpdate({});
            } else {
              setIsPending(false);
            }
          }
        })();
      }, delay);
    },
    [processUpdates, delay],
  );

  // Clean up the timer when the component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {isPending, enqueueUpdate, syncingRef};
};

export default useBatchedUpdates;
