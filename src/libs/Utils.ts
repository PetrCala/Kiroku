import type {ValueOf} from 'type-fest';
import CONST from '@src/CONST';

type BrickRoad = ValueOf<typeof CONST.BRICK_ROAD_INDICATOR_STATUS> | undefined;

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Checks if two objects are equal by comparing their keys and values.
 * DEPRECATED: Use lodash.isEqual instead.
 * @param obj1 - The first object to compare.
 * @param obj2 - The second object to compare.
 * @returns True if the objects are equal, false otherwise.
 */
function objectsAreEqual(obj1: any, obj2: any): boolean {
  if (!isObject(obj1) || !isObject(obj2)) {
    return false;
  }

  const obj1Keys = Object.keys(obj1).sort();
  const obj2Keys = Object.keys(obj2).sort();

  // Check if both objects have the same number of keys
  if (obj1Keys.length !== obj2Keys.length) {
    return false;
  }

  // Check if all keys in obj1 exist in obj2 and have the same values
  for (const key of obj1Keys) {
    if (!obj2.hasOwnProperty(key) || obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
}

function arrayItemsAreEqual<T>(arr1: T[], arr2: T[]): boolean {
  // Sort both arrays
  const sortedArr1 = [...arr1].sort();
  const sortedArr2 = [...arr2].sort();

  // Check if the arrays are the same length
  if (sortedArr1.length !== sortedArr2.length) {
    return false;
  }

  // Check if all elements are equal
  for (let i = 0; i < sortedArr1.length; i++) {
    if (sortedArr1[i] !== sortedArr2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * This function is an equivalent of _.difference, it takes two arrays and returns the difference between them.
 * It returns an array of items that are in the first array but not in the second array.
 */
function arrayDifference<TItem>(array1: TItem[], array2: TItem[]): TItem[] {
  return [array1, array2].reduce((a, b) => a.filter(c => !b.includes(c)));
}

export {isObject, objectsAreEqual, arrayItemsAreEqual, arrayDifference};
export type {BrickRoad};
