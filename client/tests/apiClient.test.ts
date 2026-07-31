import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiTimeoutError,
  fetchWithTimeout,
} from "../src/lib/apiClient";


test("trả phản hồi bình thường trước thời hạn", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("ok", { status: 200 });
  try {
    const response = await fetchWithTimeout("/api/test", {}, 100);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("hủy yêu cầu treo và trả lỗi thời gian dễ hiểu", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
  try {
    await assert.rejects(
      fetchWithTimeout("/api/hang", {}, 5),
      (error: unknown) => error instanceof ApiTimeoutError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
