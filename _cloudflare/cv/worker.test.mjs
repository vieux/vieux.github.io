import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "./handler.mjs";

const assets = {
  pdf: {
    body: new TextEncoder().encode("%PDF-test"),
    contentType: "application/pdf",
    filename: "victor-vieux-resume.pdf",
  },
  text: {
    body: "text resume",
    contentType: "text/plain; charset=utf-8",
    filename: "victor-vieux-resume.txt",
  },
};

test("serves the PDF to a browser at the root", async () => {
  const request = new Request("https://cv.vieux.fr/", {
    headers: { "user-agent": "Mozilla/5.0" },
  });

  const response = handleRequest(request, assets);

  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(
    response.headers.get("content-disposition"),
    'inline; filename="victor-vieux-resume.pdf"',
  );
  assert.match(response.headers.get("vary"), /User-Agent/i);
  assert.equal(await response.text(), "%PDF-test");
});

test("serves plain text to curl at the root", async () => {
  const request = new Request("https://cv.vieux.fr/", {
    headers: { "user-agent": "curl/8.7.1" },
  });

  const response = handleRequest(request, assets);

  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(await response.text(), "text resume");
});

test("explicit asset paths bypass user-agent negotiation", async () => {
  const pdf = handleRequest(
    new Request("https://cv.vieux.fr/resume.pdf", {
      headers: { "user-agent": "curl/8.7.1" },
    }),
    assets,
  );
  const text = handleRequest(
    new Request("https://cv.vieux.fr/resume.txt", {
      headers: { "user-agent": "Mozilla/5.0" },
    }),
    assets,
  );

  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(text.headers.get("content-type"), "text/plain; charset=utf-8");
});

test("supports range requests for browser PDF viewers", async () => {
  const response = handleRequest(
    new Request("https://cv.vieux.fr/", {
      headers: { range: "bytes=0-3", "user-agent": "Mozilla/5.0" },
    }),
    assets,
  );

  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 0-3/9");
  assert.equal(response.headers.get("content-length"), "4");
  assert.equal(await response.text(), "%PDF");
});

test("returns no body for HEAD requests", async () => {
  const response = handleRequest(
    new Request("https://cv.vieux.fr/", {
      method: "HEAD",
      headers: { "user-agent": "curl/8.7.1" },
    }),
    assets,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), "11");
  assert.equal(await response.text(), "");
});

test("rejects unsupported paths, ranges, and methods", () => {
  const missing = handleRequest(
    new Request("https://cv.vieux.fr/nope"),
    assets,
  );
  const range = handleRequest(
    new Request("https://cv.vieux.fr/", {
      headers: { range: "bytes=999-1000" },
    }),
    assets,
  );
  const method = handleRequest(
    new Request("https://cv.vieux.fr/", { method: "POST" }),
    assets,
  );

  assert.equal(missing.status, 404);
  assert.equal(range.status, 416);
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "GET, HEAD");
});
