import assert from "node:assert/strict";
import { test } from "node:test";
import { recordsApi, zonesApi } from "../lib/api/route53.ts";

test("hosted zone client sends server-backed collection and create requests", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (options.method === "POST") {
      return Response.json(
        { zone_id: "ZTEST", name: "example.com" },
        { status: 201 },
      );
    }
    return Response.json({
      items: [],
      page: 2,
      page_size: 10,
      total: 0,
      pages: 0,
    });
  });

  await zonesApi.list({
    search: "example",
    zoneType: "PUBLIC",
    page: 2,
    pageSize: 10,
  });
  assert.match(requests[0].url, /search=example/);
  assert.match(requests[0].url, /zone_type=PUBLIC/);
  assert.match(requests[0].url, /page=2/);
  assert.equal(requests[0].options.credentials, "include");

  await zonesApi.create({
    name: "example.com",
    description: "Demo",
    zone_type: "PUBLIC",
  });
  assert.equal(requests[1].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    name: "example.com",
    description: "Demo",
    zone_type: "PUBLIC",
  });
});

test("record client supports creation, import, and useful API errors", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { detail: { message: "Invalid IPv4 record value" } },
      { status: 422 },
    ),
  );
  await assert.rejects(
    recordsApi.create("ZTEST", {
      name: "www",
      type: "A",
      value: "invalid",
      ttl: 300,
      routing_policy: "SIMPLE",
      is_alias: false,
    }),
    /Invalid IPv4 record value/,
  );
  fetchMock.mock.mockImplementation(async () =>
    Response.json({ imported: 2 }, { status: 201 }),
  );
  assert.deepEqual(
    await recordsApi.importBind("ZTEST", "example.com. 300 IN A 192.0.2.1"),
    { imported: 2 },
  );
});

test("record client sends an authenticated DELETE and accepts an empty 204 response", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    requests.push({ url: String(url), options });
    return new Response(null, { status: 204 });
  });

  const result = await recordsApi.delete("ZTEST", "RTEST");

  assert.equal(result, undefined);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/hosted-zones\/ZTEST\/records\/RTEST$/);
  assert.equal(requests[0].options.method, "DELETE");
  assert.equal(requests[0].options.credentials, "include");
});
