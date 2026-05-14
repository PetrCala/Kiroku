import type {DrinkingSessionId} from '@src/types/onyx';
import type Platform from '@libs/getPlatform/types';

type CommonFriendsLabelParams = {
  hasCommonFriends: boolean;
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

type NoDrinkingSessionsParams = {
  isSelf: boolean;
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

type UnitCountParams = {
  unitCount: number;
};

type UpdateEmailSentEmailParams = {
  email: string;
};

type VerifyEmailScreenEmailParmas = {
  email: string;
};

export type {
  CommonFriendsLabelParams,
  DiscardSessionParams,
  DrinkingSessionsParams,
  ForceUpdateTextParams,
  ForgotPasswordSuccessParams,
  FriendRequestsCountParams,
  NoDrinkingSessionsParams,
  SessionConfirmTimezoneChangeParams,
  SessionStartTimeParams,
  SessionWindowIdParams,
  UnitCountParams,
  UpdateEmailSentEmailParams,
  VerifyEmailScreenEmailParmas,
};
