type TokenProvider = () => Promise<string | undefined> | string | undefined;

type ClientConfig = {
  baseUrl: string;
  getToken?: TokenProvider;
};

async function authHeaders(
  getToken?: TokenProvider,
): Promise<Record<string, string>> {
  const token = typeof getToken === 'function' ? await getToken() : undefined;
  return token ? {Authorization: `Bearer ${token}`} : {};
}

function createApiClient({baseUrl, getToken}: ClientConfig) {
  const withBase = (path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;

  return {
    async getPublic() {
      const res = await fetch(withBase('/public'));
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.text();
    },

    async getProtected() {
      const res = await fetch(withBase('/protected'), {
        headers: {
          ...(await authHeaders(getToken)),
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.text();
    },

    friends: {
      async request(toUserId: string) {
        const res = await fetch(withBase('/friends/request'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await authHeaders(getToken)),
          },
          body: JSON.stringify({toUserId}),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      },
      async deleteRequest(otherUserId: string) {
        const res = await fetch(withBase('/friends/delete-request'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await authHeaders(getToken)),
          },
          body: JSON.stringify({otherUserId}),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      },
      async accept(fromUserId: string) {
        const res = await fetch(withBase('/friends/accept'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await authHeaders(getToken)),
          },
          body: JSON.stringify({fromUserId}),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      },
      async remove(otherUserId: string) {
        const res = await fetch(withBase('/friends/remove'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await authHeaders(getToken)),
          },
          body: JSON.stringify({otherUserId}),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      },
    },
  };
}

export type {ClientConfig};
export {createApiClient};
