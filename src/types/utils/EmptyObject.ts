type EmptyObject = Record<string, never>;

type EmptyValue = EmptyObject | null | undefined;

function isEmptyObject<T>(obj: T | EmptyValue): obj is EmptyValue {
  return Object.keys(obj ?? {}).length === 0;
}

function isEmptyArray(arr: unknown): arr is never[] {
  return !Array.isArray(arr) || arr.length === 0;
}

export {isEmptyObject, isEmptyArray};
export type {EmptyObject};
