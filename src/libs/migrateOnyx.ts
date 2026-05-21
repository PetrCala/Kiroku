import Log from './Log';
import DropLegacySessionsCalendarMonthsLoaded from './migrations/DropLegacySessionsCalendarMonthsLoaded';
import DropLegacyUserDataList from './migrations/DropLegacyUserDataList';

export default function () {
  const startTime = Date.now();
  Log.info('[Migrate Onyx] start');

  return new Promise<void>(resolve => {
    // Add all migrations to an array so they are executed in order
    const migrationPromises = [
      DropLegacySessionsCalendarMonthsLoaded,
      DropLegacyUserDataList,
    ];

    // Reduce all promises down to a single promise. All promises run in a linear fashion, waiting for the
    // previous promise to finish before moving onto the next one.
    migrationPromises
      // eslint-disable-next-line arrow-body-style
      .reduce<Promise<void | void[]>>((previousPromise, migrationPromise) => {
        return previousPromise.then(() => migrationPromise());
      }, Promise.resolve())

      // Once all migrations are done, resolve the main promise
      .then(() => {
        const timeElapsed = Date.now() - startTime;
        Log.info(`[Migrate Onyx] finished in ${timeElapsed}ms`);
        resolve();
      });
  });
}
