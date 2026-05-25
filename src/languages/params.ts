import type {DrinkingSessionId} from '@src/types/onyx';
import type Platform from '@libs/getPlatform/types';

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

type StatsAfDaysParams = {
  value: number;
  total: number;
};

type StatsQuietDaysParams = {
  quietDays: number;
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

export type {
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
  OnboardingStepCounterParams,
  SessionConfirmTimezoneChangeParams,
  SessionStartTimeParams,
  SessionWindowIdParams,
  StatsAfDaysParams,
  StatsQuietDaysParams,
  UnitCountParams,
  UpdateEmailSentEmailParams,
  VerifyEmailScreenEmailParmas,
};
