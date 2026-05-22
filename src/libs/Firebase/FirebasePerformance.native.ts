import {getPerformance, trace} from '@react-native-firebase/perf';
import type {FirebasePerformanceTypes} from '@react-native-firebase/perf';

const activeTraces = new Map<string, FirebasePerformanceTypes.Trace>();

async function startTrace(traceName: string): Promise<void> {
  // The modular `trace()` export aliases its return type to
  // `FirebasePerformanceTypes.Module.Trace`, which TS resolves to `unknown`
  // (Module is a class, not a namespace, in the upstream types). Cast to the
  // actual Trace class type to restore method visibility.
  const traceInstance = trace(
    getPerformance(),
    traceName,
  ) as FirebasePerformanceTypes.Trace;
  await traceInstance.start();
  activeTraces.set(traceName, traceInstance);
}

async function stopTrace(traceName: string): Promise<void> {
  const traceInstance = activeTraces.get(traceName);
  if (!traceInstance) {
    return;
  }
  await traceInstance.stop();
  activeTraces.delete(traceName);
}

export default {startTrace, stopTrace};
