import type {DrinkingSessionId} from '@src/types/onyx';
import type Platform from '@libs/getPlatform/types';

type BadgesDayCountParams = {
  count: number;
};

type CommonFriendsLabelParams = {
  hasCommonFriends: boolean;
};

type ConfirmWithProviderPromptParams = {
  provider: string;
};

type DiscardSessionParams = {
  discardWord: string;
};

type DrinkingSessionsParams = {
  sessionsCount: number;
};

type ForceUpdateTextParams = {
  platform: Platform;
};

type ForgotPasswordSuccessParams = {
  email: string;
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

type SessionConfirmTimezoneChangeParams = {
  newTimezone: string;
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
  DrinkingSessionsParams,
  ForceUpdateTextParams,
  ForgotPasswordSuccessParams,
  FriendRequestsCountParams,
  LastSessionSummaryParams,
  OnboardingStepCounterParams,
  SessionConfirmTimezoneChangeParams,
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
  UnitCountParams,
  UpdateEmailSentEmailParams,
  VerifyEmailScreenEmailParmas,
};
