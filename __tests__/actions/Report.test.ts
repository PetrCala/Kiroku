/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */
/* eslint-disable rulesdir/no-api-in-views -- this is a test that asserts on the mocked API.write, not a view */

import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as Report from '@userActions/Report';
import CONST from '@src/CONST';

jest.mock('@libs/API', () => ({write: jest.fn()}));

const OTHER = 'friend-2';

const mockedWrite = jest.mocked(API.write);

function lastWrite() {
  const call = mockedWrite.mock.calls.at(-1);
  return {command: call?.[0], params: call?.[1], onyxData: call?.[2]};
}

describe('Report actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reportUser: forwards the reason + description with no optimistic Onyx data', () => {
    Report.reportUser(
      OTHER,
      CONST.REPORT.REASON.HARASSMENT,
      'They keep messaging me.',
    );
    const {command, params, onyxData} = lastWrite();

    expect(command).toBe(WRITE_COMMANDS.REPORT_USER);
    // Reporter is derived server-side from auth — only the target, reason, and
    // optional description are sent.
    expect(params).toEqual({
      otherUserId: OTHER,
      reason: CONST.REPORT.REASON.HARASSMENT,
      description: 'They keep messaging me.',
    });
    // Reports are server-only/admin-reviewed: fire-and-forget, no optimistic data.
    expect(onyxData).toBeUndefined();
  });

  it('reportUser: omits the description when none is provided', () => {
    Report.reportUser(OTHER, CONST.REPORT.REASON.INAPPROPRIATE_NAME);
    const {command, params} = lastWrite();

    expect(command).toBe(WRITE_COMMANDS.REPORT_USER);
    expect(params).toEqual({
      otherUserId: OTHER,
      reason: CONST.REPORT.REASON.INAPPROPRIATE_NAME,
      description: undefined,
    });
  });
});
