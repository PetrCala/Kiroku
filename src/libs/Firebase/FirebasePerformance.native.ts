import perf from '@react-native-firebase/perf';
import type {FirebasePerformanceTypes} from '@react-native-firebase/perf';

const activeTraces = new Map<string, FirebasePerformanceTypes.Trace>();

async function startTrace(traceName: string): Promise<void> {
  const trace = await perf().startTrace(traceName);
  activeTraces.set(traceName, trace);
}

async function stopTrace(traceName: string): Promise<void> {
  const trace = activeTraces.get(traceName);
  if (!trace) {
    return;
  }
  await trace.stop();
  activeTraces.delete(traceName);
}

export default {startTrace, stopTrace};
