/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import type { AnyD1Database } from "drizzle-orm/d1";
import { configureD1 } from "../db";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  BASIC_AUTH_PASSWORD?: string;
  BASIC_AUTH_USERNAME?: string;
  DB: AnyD1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

function parseBasicCredentials(request: Request): { password: string; username: string } | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return null;
  try {
    const encoded = authorization.slice(6).trim();
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index];
  }
  return difference === 0;
}

async function hasValidBasicCredentials(request: Request, env: Env): Promise<boolean> {
  if (!env.BASIC_AUTH_USERNAME || !env.BASIC_AUTH_PASSWORD) return false;
  const credentials = parseBasicCredentials(request) ?? { username: "", password: "" };
  const [usernameMatches, passwordMatches] = await Promise.all([
    secureEqual(credentials.username, env.BASIC_AUTH_USERNAME),
    secureEqual(credentials.password, env.BASIC_AUTH_PASSWORD),
  ]);
  return usernameMatches && passwordMatches;
}

function unauthorizedResponse(isConfigured: boolean): Response {
  const headers: Record<string, string> = {
    "cache-control": "no-store, max-age=0",
    "content-type": "text/plain; charset=utf-8",
  };
  if (isConfigured) headers["www-authenticate"] = 'Basic realm="Gestão de Riscos", charset="UTF-8"';
  return new Response(
    isConfigured ? "Login ou senha inválidos." : "Autenticação indisponível.",
    { status: isConfigured ? 401 : 503, headers },
  );
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
    const authIsConfigured = Boolean(env.BASIC_AUTH_USERNAME && env.BASIC_AUTH_PASSWORD);
    if (!await hasValidBasicCredentials(request, env)) {
      return withSecurityHeaders(unauthorizedResponse(authIsConfigured), url.pathname);
    }

    configureD1(env.DB);

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
