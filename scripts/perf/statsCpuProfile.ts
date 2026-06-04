/* eslint-disable no-console */
/**
 * Drives one candidate hard so an external `--cpu-prof` capture has signal.
 *
 *   node --cpu-prof --cpu-prof-dir=/tmp/statsprof \
 *     -r ts-node/register/transpile-only \
 *     --project scripts/perf/tsconfig.json \
 *     scripts/perf/statsCpuProfile.ts --candidate=a --loops=400
 *
 * (TS_NODE_PROJECT must point at scripts/perf/tsconfig.json.)
 */
import './benchGlobals';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {WeekStart} from '@libs/Statistics/types';
import {
  buildBaseline,
  buildDayBucket,
  buildOffsetTable,
} from './statsCandidates';
import type {BuildDrinkEvents} from './statsCandidates';
import {standardDatasets, UNITS, DEFAULTS} from './statsDataset';

const argv = process.argv.slice(2);
const which = (
  argv.find(a => a.startsWith('--candidate=')) ?? '--candidate=a'
).split('=')[1];
const loops = Number(
  (argv.find(a => a.startsWith('--loops=')) ?? '--loops=400').split('=')[1],
);
const byKey: Record<string, BuildDrinkEvents> = {
  a: buildBaseline,
  b: buildDayBucket,
  c: buildOffsetTable,
};
const fn = byKey[which] ?? buildBaseline;

const ZONE = 'Europe/London' as SelectedTimezone;
const MON: WeekStart = 1;
const ds = standardDatasets(ZONE).large;

let total = 0;
for (let i = 0; i < loops; i++) {
  const wrapped = {...ds.sessions};
  total += fn(wrapped, UNITS, DEFAULTS, ZONE, MON).length;
}
console.log(
  `candidate ${which}: ${loops} loops × ${ds.eventCount} events (sink=${total})`,
);
