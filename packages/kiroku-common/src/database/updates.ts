import type {Diff, DiffArray} from 'deep-diff';
import {diff} from 'deep-diff';

/* eslint-disable 
@typescript-eslint/no-unsafe-assignment, 
@typescript-eslint/no-explicit-any, 
@typescript-eslint/no-unsafe-member-access, 
@typescript-eslint/no-unsafe-argument,
no-continue
*/

type FirebaseUpdates<T = any> = Record<string, T>;

function differencesToUpdates<T>(differences: Array<Diff<T, T>>): Partial<T> {
  const updates: Partial<T> = {};

  differences.forEach(difference => {
    const path = difference.path ?? [];
    if (path.length === 0) {
      return;
    }

    let current: FirebaseUpdates = updates;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    const lastKey = path[path.length - 1];
    switch (difference.kind) {
      case 'N':
      case 'E': {
        current[lastKey] = (difference as any).rhs;
        break;
      }
      case 'D': {
        current[lastKey] = null;
        break;
      }
      case 'A': {
        if (!current[lastKey]) {
          current[lastKey] = [];
        }
        const arrayDiff = difference as DiffArray<any, any>;
        const arrayIndex = arrayDiff.index;
        const itemDiff = arrayDiff.item;

        if (itemDiff?.kind === 'N' || itemDiff?.kind === 'E') {
          current[lastKey][arrayIndex] = (itemDiff as any).rhs;
        } else if (itemDiff?.kind === 'D') {
          current[lastKey][arrayIndex] = null;
        }
        break;
      }
      default:
        break;
    }
  });

  return updates;
}

function buildUpdates<T>(updates: Partial<T>, basePath = ''): FirebaseUpdates {
  const updatesToDB: FirebaseUpdates = {};
  function recurse(current: any, path = '') {
    for (const [key, value] of Object.entries(current)) {
      const currentPath = path ? `${path}/${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        recurse(value, currentPath);
      } else {
        updatesToDB[currentPath] = value as any;
      }
    }
  }
  recurse(updates, basePath);
  return updatesToDB;
}

function prependFirebaseUpdateKeys(
  updates: FirebaseUpdates,
  basePath: string,
): FirebaseUpdates {
  const updatesWithBasePath: FirebaseUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    updatesWithBasePath[`${basePath}/${key}`] = value;
  }
  return updatesWithBasePath;
}

function computeFirebaseUpdates<T>(
  lhs: T,
  rhs: T,
  basePath = '',
): FirebaseUpdates {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const differences = diff(lhs, rhs)!;
  if (!differences) {
    return {};
  }
  const updates = differencesToUpdates(differences);
  const updatesToDB = buildUpdates(updates, basePath);
  return updatesToDB;
}

function removeOverlappingUpdates(updates: FirebaseUpdates): FirebaseUpdates {
  const cleanUpdates: FirebaseUpdates = {};
  const paths = Object.keys(updates);

  const nullPaths = new Set<string>();
  for (const path of paths) {
    if (updates[path] === null) {
      nullPaths.add(path);
    }
  }

  const excludePaths = new Set<string>();
  for (const nullPath of nullPaths) {
    for (const path of paths) {
      if (path !== nullPath && path.startsWith(`${nullPath}/`)) {
        excludePaths.add(path);
      }
    }
  }

  for (const path of paths) {
    if (excludePaths.has(path)) {
      continue;
    }
    const pathSegments = path.split('/');
    let ancestorPath = '';
    let shouldExclude = false;
    for (let i = 0; i < pathSegments.length - 1; i++) {
      ancestorPath = ancestorPath
        ? `${ancestorPath}/${pathSegments[i]}`
        : pathSegments[i];
      if (nullPaths.has(ancestorPath)) {
        shouldExclude = true;
        break;
      }
    }
    if (shouldExclude) {
      continue;
    }
    cleanUpdates[path] = updates[path];
  }
  return cleanUpdates;
}

function pathsConflict(path1: string, path2: string): boolean {
  if (path1 === path2) {
    return false;
  }
  const path1Parts = path1.split('/');
  const path2Parts = path2.split('/');
  if (path1Parts.length < path2Parts.length) {
    const path2Prefix = path2Parts.slice(0, path1Parts.length).join('/');
    return path2Prefix === path1;
  }
  if (path1Parts.length > path2Parts.length) {
    const path1Prefix = path1Parts.slice(0, path2Parts.length).join('/');
    return path1Prefix === path2;
  }
  return false;
}

function mergeUpdates(
  existingUpdates: Record<string, any>,
  update: Record<string, any>,
) {
  const newUpdates = {...existingUpdates};
  for (const newKey of Object.keys(update)) {
    for (const existingKey of Object.keys(newUpdates)) {
      if (pathsConflict(existingKey, newKey)) {
        delete newUpdates[existingKey];
      }
    }
  }
  Object.assign(newUpdates, update);
  return newUpdates;
}

export {
  buildUpdates,
  computeFirebaseUpdates,
  differencesToUpdates,
  mergeUpdates,
  pathsConflict,
  prependFirebaseUpdateKeys,
  removeOverlappingUpdates,
};
export type {FirebaseUpdates};

