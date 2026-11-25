const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function session(name = 'old', expires = Date.now() + 3600000) {
  return {
    accessToken: name,
    refreshToken: `refresh-${name}`,
    accessTokenExpiresAt: new Date(expires).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}
function setup(fetcher, saved = null) {
  const values = new Map(
    saved ? [['wathiq.session', JSON.stringify(saved)]] : [],
  );
  const storage = {
    get: async (k) => values.get(k) ?? null,
    set: async (k, v) => {
      values.set(k, v);
    },
    remove: async (k) => {
      values.delete(k);
    },
  };
  const code = ts.transpileModule(
    readFileSync(require.resolve('../src/api.ts'), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: () => ({ storage }),
    process: { env: { EXPO_PUBLIC_API_URL: 'https://api.test/api/v1/' } },
    fetch: fetcher,
    Headers,
    FormData,
    AbortController,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
  });
  return { api: exports, values };
}
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('parallel requests rotate the refresh token once and use the new bearer', async () => {
  const gate = deferred();
  let rotations = 0;
  const used = [];
  const { api } = setup(
    async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        rotations++;
        await gate.promise;
        return json(session('new'));
      }
      used.push(init.headers.get('Authorization'));
      return json({ ok: true });
    },
    session('old', Date.now() - 1000),
  );
  await api.restoreSession();
  const requests = [
    api.api('/posts'),
    api.api('/notifications'),
    api.api('/auth/me'),
  ];
  gate.resolve();
  await Promise.all(requests);
  assert.equal(rotations, 1);
  assert.deepEqual(used, ['Bearer new', 'Bearer new', 'Bearer new']);
});
test('a 401 retries a write exactly once, preserving body and verb', async () => {
  const calls = [];
  const { api } = setup(async (url, init) => {
    calls.push({ url, method: init.method, body: init.body });
    if (url.endsWith('/auth/refresh')) return json(session('new'));
    return init.headers.get('Authorization') === 'Bearer old'
      ? json({ message: 'expired' }, 401)
      : json({ id: 4 });
  }, session());
  await api.restoreSession();
  assert.equal((await api.api('/posts', 'POST', { title: 'Test' })).id, 4);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].body, calls[2].body);
  assert.equal(calls[2].method, 'POST');
});
test('a failed write is never retried on server error', async () => {
  let calls = 0;
  const { api } = setup(async () => {
    calls++;
    return json({ message: 'Unavailable' }, 503);
  }, session());
  await api.restoreSession();
  await assert.rejects(api.api('/posts', 'POST', { title: 'Test' }), {
    status: 503,
  });
  assert.equal(calls, 1);
});
test('temporary refresh failure keeps the stored session for a later retry', async () => {
  const { api, values } = setup(
    async () => json({ message: 'Unavailable' }, 503),
    session('old', Date.now() - 1000),
  );
  await api.restoreSession();
  await assert.rejects(api.api('/posts'), { status: 503 });
  assert.equal(JSON.parse(values.get('wathiq.session')).accessToken, 'old');
});
test('revoked refresh token clears storage and notifies the UI', async () => {
  const { api, values } = setup(
    async () => json({ message: 'revoked' }, 401),
    session('old', Date.now() - 1000),
  );
  let expired = 0;
  api.onExpired(() => expired++);
  await api.restoreSession();
  await assert.rejects(api.api('/posts'), { status: 401 });
  assert.equal(values.has('wathiq.session'), false);
  assert.equal(expired, 1);
});
test('logout while refresh is pending cannot resurrect the session or retry the request', async () => {
  const gate = deferred();
  const started = deferred();
  let protectedCalls = 0;
  const { api, values } = setup(
    async (url) => {
      if (url.endsWith('/auth/refresh')) {
        started.resolve();
        await gate.promise;
        return json(session('new'));
      }
      protectedCalls++;
      return json({});
    },
    session('old', Date.now() - 1000),
  );
  await api.restoreSession();
  const request = api.api('/posts');
  const rejected = assert.rejects(request, { status: 401 });
  await started.promise;
  await api.clearSession();
  gate.resolve();
  await rejected;
  assert.equal(values.has('wathiq.session'), false);
  assert.equal(protectedCalls, 0);
});
test('late response from an old account is not shown to a new account', async () => {
  const gate = deferred();
  const started = deferred();
  const { api } = setup(async () => {
    started.resolve();
    await gate.promise;
    return json({ private: 'old account' });
  }, session());
  await api.restoreSession();
  const pending = api.api('/auth/me');
  const rejected = assert.rejects(pending, { status: 401 });
  await started.promise;
  await api.setSession(session('other'));
  gate.resolve();
  await rejected;
});
test('empty 202 and 204 success responses are accepted', async () => {
  for (const status of [202, 204]) {
    const { api } = setup(async () => new Response(null, { status }));
    assert.equal(
      await api.api(
        '/auth/password/forgot',
        'POST',
        { identifier: 'test@example.test' },
        true,
      ),
      undefined,
    );
  }
});
test('malformed persisted credentials are discarded', async () => {
  const { api, values } = setup(async () => json({}), { accessToken: 12 });
  assert.equal(await api.restoreSession(), false);
  assert.equal(values.has('wathiq.session'), false);
});
test('anonymous auth requests never attach the previous bearer', async () => {
  let bearer;
  const { api } = setup(async (_url, init) => {
    bearer = init.headers.get('Authorization');
    return json({});
  }, session());
  await api.restoreSession();
  await api.api('/auth/login', 'POST', {}, true);
  assert.equal(bearer, null);
});

test('file downloads renew an expired access token before fetching', async () => {
  const calls = [];
  const { api } = setup(
    async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        calls.push('refresh');
        return json(session('new'));
      }
      calls.push(`${url} ${init.headers.get('Authorization')}`);
      return new Response('%PDF', { status: 200 });
    },
    session('old', Date.now() - 1000),
  );
  await api.restoreSession();
  // Writing the file needs the native file system, which this test does not load.
  await api
    .downloadAuthenticated('/users/me/cv/pdf', 'file:///cache/cv.pdf')
    .catch(() => {});
  assert.deepEqual(calls, [
    'refresh',
    'https://api.test/api/v1/users/me/cv/pdf Bearer new',
  ]);
});

test('file downloads retry once with a renewed token after a 401', async () => {
  const calls = [];
  const { api } = setup(async (url, init) => {
    if (url.endsWith('/auth/refresh')) {
      calls.push('refresh');
      return json(session('new'));
    }
    const auth = init.headers.get('Authorization');
    calls.push(auth);
    return auth === 'Bearer old'
      ? json({ message: 'expired' }, 401)
      : new Response('%PDF', { status: 200 });
  }, session('old'));
  await api.restoreSession();
  await api
    .downloadAuthenticated('/users/me/cv/pdf', 'file:///cache/cv.pdf')
    .catch(() => {});
  assert.deepEqual(calls, ['Bearer old', 'refresh', 'Bearer new']);
});
