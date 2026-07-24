import CONST from '@src/CONST';
import Log from './Log';
import type {RequestError} from './Network/SequentialQueue';
import {generateRandomInt} from './NumberUtils';

class RequestThrottle {
  private requestWaitTime = 0;

  private requestRetryCount = 0;

  private timeoutID?: ReturnType<typeof setTimeout>;

  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  clear() {
    this.requestWaitTime = 0;
    this.requestRetryCount = 0;
    if (this.timeoutID) {
      Log.info(
        `[RequestThrottle - ${this.name}] clearing timeoutID: ${String(this.timeoutID)}`,
      );
      clearTimeout(this.timeoutID);
      this.timeoutID = undefined;
    }
    Log.info(`[RequestThrottle - ${this.name}] cleared`);
  }

  /**
   * Zero the retry budget without touching an armed retry timer. Used on
   * reconnection so each online window gets a fresh budget; `clear()` is not
   * safe there, because clearing a pending `sleep` timeout would leave its
   * promise unsettled and wedge the sequential queue's processing chain.
   */
  resetBudget() {
    this.requestWaitTime = 0;
    this.requestRetryCount = 0;
  }

  getRequestWaitTime() {
    if (this.requestWaitTime) {
      this.requestWaitTime = Math.min(
        this.requestWaitTime * 2,
        CONST.NETWORK.MAX_RETRY_WAIT_TIME_MS,
      );
    } else {
      this.requestWaitTime = generateRandomInt(
        CONST.NETWORK.MIN_RETRY_WAIT_TIME_MS,
        CONST.NETWORK.MAX_RANDOM_RETRY_WAIT_TIME_MS,
      );
    }
    return this.requestWaitTime;
  }

  getLastRequestWaitTime() {
    return this.requestWaitTime;
  }

  sleep(error: RequestError, command: string): Promise<void> {
    this.requestRetryCount++;
    return new Promise((resolve, reject) => {
      if (this.requestRetryCount <= CONST.NETWORK.MAX_REQUEST_RETRIES) {
        const currentRequestWaitTime = this.getRequestWaitTime();
        Log.info(
          `[RequestThrottle - ${this.name}] Retrying request after error: '${error.name}', '${error.message}', '${error.status}'. Command: ${command}. Retry count:  ${this.requestRetryCount}. Wait time: ${currentRequestWaitTime}`,
        );
        this.timeoutID = setTimeout(resolve, currentRequestWaitTime);
      } else {
        reject();
      }
    });
  }
}

export default RequestThrottle;
