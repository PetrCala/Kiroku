import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {resolvePalette} from '@libs/SessionColorPalettes';
import type {Preferences, SessionColorPalette} from '@src/types/onyx';

/**
 * Resolves which session color palette to render with for a given user's data.
 *
 * Default: the viewed user's own palette is used (preserving the per-user
 * palette preview). When the current viewer has enabled
 * `use_own_palette_for_others`, their own palette overrides the viewed user's
 * so that the app's color treatment stays consistent.
 *
 * Pass `undefined` when rendering data that has no clear owner — the resolver
 * falls back to the default palette via `resolvePalette`.
 */
function useResolvedPalette(
  viewedUserPreferences: Preferences | undefined,
): SessionColorPalette {
  const {preferences: ownPreferences} = useDatabaseData();
  const useOwn = ownPreferences?.use_own_palette_for_others === true;
  const source = useOwn
    ? ownPreferences?.session_color_palette
    : viewedUserPreferences?.session_color_palette;
  return resolvePalette(source);
}

export default useResolvedPalette;
