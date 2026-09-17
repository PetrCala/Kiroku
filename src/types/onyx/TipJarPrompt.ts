import type {Timestamp} from './OnyxCommon';

/**
 * State of the one gated tip-jar ask on Home (the card, not the jar). Device
 * level: it survives sign-out like TIPS_GIVEN, and losing it (reinstall, new
 * device) only means the clock starts over.
 */
type TipJarPrompt = {
  /** When Home first rendered on this device; the 14-day clock starts here. */
  firstOpenAt?: Timestamp;

  /** How many times the card has appeared on this device, ever. */
  shownCount?: number;

  /** When the card last appeared; drives the cooldown between impressions. */
  lastShownAt?: Timestamp;

  /** True while the card is on Home waiting for an answer. */
  isOpen?: boolean;

  /** The user tapped "Don't ask again"; the card never returns. */
  dismissedForever?: boolean;
};

export default TipJarPrompt;
