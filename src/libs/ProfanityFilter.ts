import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

/**
 * A single, shared matcher built once at module scope from the English dataset
 * plus the recommended transformers (which add transliteration/leetspeak
 * normalization, so obfuscated variants like "fvck" or "sh1t" are caught).
 *
 * Building the matcher is relatively expensive, so it is constructed a single
 * time and reused for every check rather than re-instantiated per call.
 */
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/**
 * Soft, client-side check for objectionable language in a user-controlled text
 * field (display name, username). This is a UX-only guard meant to give users
 * immediate inline feedback so most never submit an objectionable name. It is
 * intentionally bypassable. The authoritative gate lives on the server.
 *
 * @param text - The text to inspect.
 * @returns `true` if the text appears to contain profanity, `false` otherwise.
 */
function containsProfanity(text: string): boolean {
  if (!text) {
    return false;
  }
  return matcher.hasMatch(text);
}

export default {
  containsProfanity,
};
