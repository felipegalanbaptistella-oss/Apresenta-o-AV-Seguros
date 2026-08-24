/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const AUTHENTICATED_EMAIL_HEADER = "oai-authenticated-user-email";
const ALLOWED_EMAILS = new Set(["felipe.galanbaptistella@gmail.com"]);
const ALLOWED_EMAIL_DOMAINS = ["altavistainvest.com.br"];
const AUTH_PATHS = new Set([
  "/signin-with-chatgpt",
  "/signout-with-chatgpt",
  "/callback",
]);

function normalizedAuthenticatedEmail(request: Request): string | null {
  const email = request.headers.get(AUTHENTICATED_EMAIL_HEADER)?.trim().toLowerCase();
  return email || null;
}

function isAuthorizedEmail(email: string): boolean {
  if (ALLOWED_EMAILS.has(email)) return true;
  const separator = email.lastIndexOf("@");
  if (separator <= 0) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(email.slice(separator + 1));
}

function signInResponse(url: URL): Response {
  const returnTo = `${url.pathname}${url.search}`;
  const signInUrl = new URL("/signin-with-chatgpt", url.origin);
  signInUrl.searchParams.set("return_to", returnTo);
  return Response.redirect(signInUrl, 302);
}

function forbiddenResponse(): Response {
  return new Response("Acesso restrito aos usuários autorizados da Alta Vista.", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function withSecurityHeaders(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html") || pathname === "/" || pathname.endsWith(".html");

  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");

  if (isHtml) {
    headers.set("Cache-Control", "no-store, max-age=0");
    const scriptPolicy = pathname.endsWith(".html")
      ? "script-src 'self' 'wasm-unsafe-eval'"
      : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'";
    headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'none'",
        "connect-src 'self'",
        "font-src 'self' data:",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "frame-src 'self'",
        "img-src 'self' blob: data:",
        "media-src 'none'",
        "object-src 'none'",
        scriptPolicy,
        "style-src 'self' 'unsafe-inline'",
        "worker-src 'self' blob:",
      ].join("; "),
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!AUTH_PATHS.has(url.pathname)) {
      const email = normalizedAuthenticatedEmail(request);
      if (!email) return withSecurityHeaders(signInResponse(url), url.pathname);
      if (!isAuthorizedEmail(email)) return withSecurityHeaders(forbiddenResponse(), url.pathname);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(response, url.pathname);
    }

    const response = await handler.fetch(request, env, ctx);
    return withSecurityHeaders(response, url.pathname);
  },
};

export default worker;
