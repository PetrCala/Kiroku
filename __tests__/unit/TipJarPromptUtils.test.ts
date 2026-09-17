import {
  canOpenTipJarPrompt,
  shouldShowTipJarPrompt,
} from '@libs/TipJarPromptUtils';
import type {TipJarPromptContext} from '@libs/TipJarPromptUtils';
import CONST from '@src/CONST';

const DAY = 1000 * 60 * 60 * 24;
const NOW = 1_800_000_000_000;

/** A device that passes every gate: 30 days in, 12 sessions, never asked. */
function eligible(
  overrides: Partial<TipJarPromptContext> = {},
): TipJarPromptContext {
  return {
    now: NOW,
    prompt: {firstOpenAt: NOW - 30 * DAY, shownCount: 0},
    completedSessionCount: 12,
    tipsGiven: 0,
    isSupporter: false,
    hasOngoingSession: false,
    isTipJarAvailable: true,
    ...overrides,
  };
}

describe('canOpenTipJarPrompt', () => {
  it('opens for an engaged, untipped device that was never asked', () => {
    expect(canOpenTipJarPrompt(eligible())).toBe(true);
  });

  it('needs the first-open clock to exist', () => {
    expect(canOpenTipJarPrompt(eligible({prompt: undefined}))).toBe(false);
    expect(canOpenTipJarPrompt(eligible({prompt: {}}))).toBe(false);
  });

  it('waits 14 days after the first open', () => {
    const justUnder = NOW - CONST.TIP_JAR_PROMPT.MIN_MS_SINCE_FIRST_OPEN + 1000;
    expect(
      canOpenTipJarPrompt(eligible({prompt: {firstOpenAt: justUnder}})),
    ).toBe(false);
    const exactly = NOW - CONST.TIP_JAR_PROMPT.MIN_MS_SINCE_FIRST_OPEN;
    expect(
      canOpenTipJarPrompt(eligible({prompt: {firstOpenAt: exactly}})),
    ).toBe(true);
  });

  it('waits for 5 completed sessions', () => {
    expect(canOpenTipJarPrompt(eligible({completedSessionCount: 4}))).toBe(
      false,
    );
    expect(canOpenTipJarPrompt(eligible({completedSessionCount: 5}))).toBe(
      true,
    );
  });

  it('never asks someone who already tipped or subscribes', () => {
    expect(canOpenTipJarPrompt(eligible({tipsGiven: 1}))).toBe(false);
    expect(canOpenTipJarPrompt(eligible({isSupporter: true}))).toBe(false);
  });

  it('never asks during a live session', () => {
    expect(canOpenTipJarPrompt(eligible({hasOngoingSession: true}))).toBe(
      false,
    );
  });

  it('never asks where tips cannot be sold', () => {
    expect(canOpenTipJarPrompt(eligible({isTipJarAvailable: false}))).toBe(
      false,
    );
  });

  it('honours "Don\'t ask again"', () => {
    expect(
      canOpenTipJarPrompt(
        eligible({
          prompt: {firstOpenAt: NOW - 30 * DAY, dismissedForever: true},
        }),
      ),
    ).toBe(false);
  });

  it('does not reopen a card that is already open', () => {
    expect(
      canOpenTipJarPrompt(
        eligible({prompt: {firstOpenAt: NOW - 30 * DAY, isOpen: true}}),
      ),
    ).toBe(false);
  });

  it('stops after three lifetime impressions', () => {
    const prompt = {firstOpenAt: NOW - 400 * DAY, lastShownAt: NOW - 200 * DAY};
    expect(
      canOpenTipJarPrompt(eligible({prompt: {...prompt, shownCount: 2}})),
    ).toBe(true);
    expect(
      canOpenTipJarPrompt(eligible({prompt: {...prompt, shownCount: 3}})),
    ).toBe(false);
  });

  it('keeps a 120-day floor between impressions', () => {
    const base = {firstOpenAt: NOW - 400 * DAY, shownCount: 1};
    expect(
      canOpenTipJarPrompt(
        eligible({prompt: {...base, lastShownAt: NOW - 119 * DAY}}),
      ),
    ).toBe(false);
    expect(
      canOpenTipJarPrompt(
        eligible({
          prompt: {
            ...base,
            lastShownAt: NOW - CONST.TIP_JAR_PROMPT.COOLDOWN_MS,
          },
        }),
      ),
    ).toBe(true);
  });
});

describe('shouldShowTipJarPrompt', () => {
  const open = {firstOpenAt: NOW - 30 * DAY, shownCount: 1, isOpen: true};

  it('shows an open card', () => {
    expect(shouldShowTipJarPrompt(eligible({prompt: open}))).toBe(true);
  });

  it('shows nothing while the card is closed', () => {
    expect(shouldShowTipJarPrompt(eligible())).toBe(false);
    expect(
      shouldShowTipJarPrompt(eligible({prompt: {...open, isOpen: false}})),
    ).toBe(false);
  });

  it('keeps an open card past the engagement gates (they were met at open time)', () => {
    expect(
      shouldShowTipJarPrompt(
        eligible({prompt: open, completedSessionCount: 0}),
      ),
    ).toBe(true);
  });

  it('drops an open card once a tip lands, a subscription starts, or a session goes live', () => {
    expect(shouldShowTipJarPrompt(eligible({prompt: open, tipsGiven: 1}))).toBe(
      false,
    );
    expect(
      shouldShowTipJarPrompt(eligible({prompt: open, isSupporter: true})),
    ).toBe(false);
    expect(
      shouldShowTipJarPrompt(eligible({prompt: open, hasOngoingSession: true})),
    ).toBe(false);
  });

  it('never renders on web', () => {
    expect(
      shouldShowTipJarPrompt(
        eligible({prompt: open, isTipJarAvailable: false}),
      ),
    ).toBe(false);
  });
});
