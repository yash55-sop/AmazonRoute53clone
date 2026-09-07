import assert from "node:assert/strict";
import { test } from "node:test";
import { getHealth } from "../lib/api/health.ts";
import { publicConfig } from "../lib/config/public.ts";

test("health client validates responses and propagates failures", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, `${publicConfig.apiUrl}/health`);
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ status: "ok" });
  });
  assert.deepEqual(await getHealth(), { status: "ok" });

  fetchMock.mock.mockImplementation(
    async () => new Response(null, { status: 503 }),
  );
  await assert.rejects(getHealth(), /503/);

  for (const payload of [null, {}, { status: "down" }, "ok"]) {
    fetchMock.mock.mockImplementation(async () => Response.json(payload));
    await assert.rejects(getHealth(), /Unexpected health response/);
  }

  fetchMock.mock.mockImplementation(async () => {
    throw new TypeError("Network unavailable");
  });
  await assert.rejects(getHealth(), /Network unavailable/);
});
