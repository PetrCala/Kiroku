import type {ChannelAuthorizerGenerator} from 'pusher-js/with-encryption';
import * as ApiUtils from '@libs/ApiUtils';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';

/**
 * Custom Pusher channel authorizer for kiroku-api. pusher-js's default
 * authorizer POSTs `socket_id` + `channel_name` to the auth endpoint but cannot
 * attach our `Authorization: Bearer <Firebase ID token>` header, which
 * `POST /v1/pusher/auth` requires (it is guarded by the same `authenticate`
 * middleware as every other endpoint). This authorizer adds that header.
 */
const kirokuPusherAuthorizer: ChannelAuthorizerGenerator = channel => ({
  authorize(socketId, callback) {
    const user = getFirebaseAuth().currentUser;
    if (!user) {
      callback(new Error('Cannot authorize Pusher: no authenticated user'), null);
      return;
    }

    user
      .getIdToken()
      .then(token => {
        const body = `socket_id=${encodeURIComponent(socketId)}&channel_name=${encodeURIComponent(channel.name)}`;
        return fetch(`${ApiUtils.getKirokuApiRoot()}/v1/pusher/auth`, {
          method: 'post',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        });
      })
      .then(response => {
        if (!response.ok) {
          callback(
            new Error(`Pusher channel authorization failed (${response.status})`),
            null,
          );
          return;
        }
        response
          .json()
          .then(authData => callback(null, authData))
          .catch((error: Error) => callback(error, null));
      })
      .catch((error: Error) => callback(error, null));
  },
});

export default kirokuPusherAuthorizer;
