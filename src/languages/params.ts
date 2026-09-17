import type {DrinkingSessionId} from '@src/types/onyx';

type BadgesDayCountParams = {
  count: number;
};

type CommonFriendsLabelParams = {
  hasCommonFriends: boolean;
};

type ConfirmWithProviderPromptParams = {
  provider: string;
};

/** A drink serving: a volume in millilitres and a strength in whole percent. */
type DrinkServingParams = {
  ml: number;
  abv: number;
};

/** How long ago a retro-added drink happened. */
type MinutesAgoParams = {
  minutes: number;
};

/** The drink type a capture action is about, already localized. */
type DrinkNameParams = {
  drink: string;
};

/** A drink and the time of day it was logged at, for an accessible label. */
type DrinkAtTimeParams = {
  drink: string;
  time: string;
};

/** How many drinks one entry stands for. */
type EntryCountParams = {
  count: number;
};

type DiscardSessionParams = {
  discardWord: string;
};

type DrinkingSessionsParams = {
  sessionsCount: number;
};

type ForgotPasswordSuccessParams = {
  email: string;
};

type InviteDisplayNameParams = {
  displayName: string;
};

type InviteLinkParams = {
  link: string;
};

type FriendCountParams = {
  friendCount: number;
};

type FriendRequestsCountParams = {
  requestsCount: number;
};

type LastSessionSummaryParams = {
  when: string;
  units: string;
};

type OnboardingStepCounterParams = {
  currentStep: number;
  totalSteps: number;
};

type QuickAddDrinkParams = {
  drinkName: string;
};

type RelativeTimeAgoParams = {
  count: number;
};

type SessionConfirmTimezoneChangeParams = {
  newTimezone: string;
};

/** Which photo of how many, for a gallery tile's spoken label. */
type SessionPhotoParams = {
  /** 1-based position in the gallery */
  index: number;

  /** How many photos the session has */
  count: number;
};

/** The per-session photo cap (RFC §9). */
type SessionPhotoLimitParams = {
  /** Max photos on one session */
  limit: number;
};

type SessionDefaultNameParams = {
  /** The localized weekday name, e.g. "Friday" */
  weekday: string;
  /** The weekday as a number, 0 for Sunday through 6 for Saturday */
  weekdayIndex: number;
  /** The localized part of the day, e.g. "evening" */
  partOfDay: string;
};

type SessionStartTimeParams = {
  startTime: string;
};

type SessionWindowIdParams = {
  sessionId: DrinkingSessionId;
};

type StatsThresholdParams = {
  threshold: number;
};

type StatsDrillDownTitleParams = {
  label: string;
};

type WeekOfParams = {
  date: string;
};

type UnitCountParams = {
  unitCount: number;
};

type BreakdownCenterUnitsParams = {
  count: number;
};

type BreakdownTileSubtitleParams = {
  units: number;
};

type BreakdownSliceCaptionParams = {
  label: string;
  units: number;
  share: number;
};

type BreakdownDrinkLabelParams = {
  label: string;
};

type BreakdownPeriodParams = {
  period: string;
};

type UpdateEmailSentEmailParams = {
  email: string;
};

type VerifyEmailScreenEmailParmas = {
  email: string;
};

type SupporterPurchaseCtaParams = {
  price: string;
};

type SupporterPriceParams = {
  price: string;
};

type SupporterTipCountParams = {
  count: number;
};

type TipJarPromptTitleParams = {
  sessionCount: number;
};

type TipJarPromptDevStatusParams = {
  /** Formatted date the card's clock started; null when it has not. */
  firstOpen: string | null;
  shownCount: number;
  tipsGiven: number;
};

type SupporterPurchaseErrorParams = {
  message: string;
};

type SupporterCancelledStatusParams = {
  date: string;
};

type SupporterRenewalDateParams = {
  date: string;
};

export type {
  BadgesDayCountParams,
  BreakdownCenterUnitsParams,
  BreakdownDrinkLabelParams,
  BreakdownPeriodParams,
  BreakdownSliceCaptionParams,
  BreakdownTileSubtitleParams,
  CommonFriendsLabelParams,
  ConfirmWithProviderPromptParams,
  DiscardSessionParams,
  DrinkAtTimeParams,
  DrinkNameParams,
  DrinkServingParams,
  EntryCountParams,
  MinutesAgoParams,
  DrinkingSessionsParams,
  ForgotPasswordSuccessParams,
  FriendRequestsCountParams,
  InviteDisplayNameParams,
  InviteLinkParams,
  FriendCountParams,
  LastSessionSummaryParams,
  OnboardingStepCounterParams,
  QuickAddDrinkParams,
  RelativeTimeAgoParams,
  SessionConfirmTimezoneChangeParams,
  SessionDefaultNameParams,
  SessionPhotoLimitParams,
  SessionPhotoParams,
  SessionStartTimeParams,
  SessionWindowIdParams,
  StatsDrillDownTitleParams,
  StatsThresholdParams,
  WeekOfParams,
  SupporterCancelledStatusParams,
  SupporterPriceParams,
  SupporterPurchaseCtaParams,
  SupporterPurchaseErrorParams,
  SupporterRenewalDateParams,
  SupporterTipCountParams,
  TipJarPromptTitleParams,
  TipJarPromptDevStatusParams,
  UnitCountParams,
  UpdateEmailSentEmailParams,
  VerifyEmailScreenEmailParmas,
};
