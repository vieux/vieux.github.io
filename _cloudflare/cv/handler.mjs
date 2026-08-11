function requestedFormat(request) {
  const { pathname } = new URL(request.url);

  if (pathname === "/resume.pdf") return "pdf";
  if (pathname === "/resume.txt") return "text";
  if (pathname !== "/" && pathname !== "") return null;

  const userAgent = request.headers.get("user-agent") || "";
  return /\bcurl(?:\/|\s|$)/i.test(userAgent) ? "text" : "pdf";
}

function bytesFor(body) {
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
}

function requestedRange(header, length) {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return false;

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!suffixLength) return false;
    start = Math.max(0, length - suffixLength);
    end = length - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : length - 1;
  }

  if (start >= length || start > end) return false;
  return { start, end: Math.min(end, length - 1) };
}

export function handleRequest(request, assets) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: {
        allow: "GET, HEAD",
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  const format = requestedFormat(request);
  if (!format) {
    return new Response("Not found\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const asset = assets[format];
  const bytes = bytesFor(asset.body);
  const range = requestedRange(request.headers.get("range"), bytes.byteLength);
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=3600",
    "content-disposition": `inline; filename="${asset.filename}"`,
    "content-type": asset.contentType,
    vary: "User-Agent",
    "x-content-type-options": "nosniff",
  });

  if (range === false) {
    headers.set("content-range", `bytes */${bytes.byteLength}`);
    return new Response(null, { status: 416, headers });
  }

  let status = 200;
  let responseBytes = bytes;
  if (range) {
    status = 206;
    responseBytes = bytes.slice(range.start, range.end + 1);
    headers.set(
      "content-range",
      `bytes ${range.start}-${range.end}/${bytes.byteLength}`,
    );
  }

  headers.set("content-length", String(responseBytes.byteLength));
  const body = request.method === "HEAD" ? null : responseBytes;
  return new Response(body, { status, headers });
}
