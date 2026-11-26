/** OAuth 2.0 de aplicativo local, PKCE S256 e redirect em 127.0.0.1. */

import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { AppError } from "../../domain/errors.js";

export const CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export interface GoogleTokens {
  refreshToken: string;
  accessToken: string;
  expiresAt: string;
  scope: string;
}

export interface OAuthClient {
  clientId: string;
  clientSecret: string | null;
}

export function tokenPath(dataDir: string): string {
  return path.join(dataDir, "contas", "google.json");
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: CALENDAR_READONLY_SCOPE,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
    state: input.state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function readTokens(dataDir: string): GoogleTokens | null {
  const file = tokenPath(dataDir);
  if (!fs.existsSync(file)) {
    return null;
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<GoogleTokens>;
  if (!parsed.refreshToken || !parsed.accessToken || !parsed.expiresAt) {
    return null;
  }
  return {
    refreshToken: parsed.refreshToken,
    accessToken: parsed.accessToken,
    expiresAt: parsed.expiresAt,
    scope: parsed.scope ?? CALENDAR_READONLY_SCOPE,
  };
}

export function writeTokens(dataDir: string, tokens: GoogleTokens): void {
  const file = tokenPath(dataDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(tokens, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

export function disconnectGoogle(dataDir: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const tokens = readTokens(dataDir);
  const file = tokenPath(dataDir);
  if (fs.existsSync(file)) {
    fs.rmSync(file);
  }
  if (!tokens?.refreshToken) {
    return Promise.resolve(false);
  }
  return fetchImpl(REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: tokens.refreshToken }),
  })
    .then(() => true)
    .catch(() => true);
}

export async function accessToken(
  client: OAuthClient,
  dataDir: string,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<string> {
  const tokens = readTokens(dataDir);
  if (!tokens) {
    throw new AppError("A conta Google ainda não está conectada.", "unavailable");
  }
  if (Date.parse(tokens.expiresAt) - now.getTime() > 60_000) {
    return tokens.accessToken;
  }
  const body = new URLSearchParams({
    client_id: client.clientId,
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
  });
  if (client.clientSecret) {
    body.set("client_secret", client.clientSecret);
  }
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new AppError("Não consegui renovar a conexão com a agenda.", "unavailable");
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number; scope?: string };
  if (!payload.access_token) {
    throw new AppError("Não consegui renovar a conexão com a agenda.", "unavailable");
  }
  writeTokens(dataDir, {
    refreshToken: tokens.refreshToken,
    accessToken: payload.access_token,
    expiresAt: new Date(now.getTime() + (payload.expires_in ?? 3600) * 1000).toISOString(),
    scope: payload.scope ?? tokens.scope,
  });
  return payload.access_token;
}

export async function connectGoogle(
  client: OAuthClient,
  dataDir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const { verifier, challenge } = createPkce();
  const state = randomBytes(16).toString("base64url");
  const code = await listenForCode(state, (port) => {
    const redirectUri = `http://127.0.0.1:${port}`;
    const url = authorizationUrl({ clientId: client.clientId, redirectUri, challenge, state });
    spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
    return redirectUri;
  });
  const redirectUri = code.redirectUri;
  const body = new URLSearchParams({
    client_id: client.clientId,
    code: code.code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  if (client.clientSecret) {
    body.set("client_secret", client.clientSecret);
  }
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new AppError("A Google não concluiu a conexão da agenda.", "unavailable");
  }
  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!payload.access_token || !payload.refresh_token) {
    throw new AppError("A Google não devolveu o token de renovação. Conecte de novo e aceite o acesso.", "unavailable");
  }
  if (payload.scope && !payload.scope.split(" ").includes(CALENDAR_READONLY_SCOPE)) {
    throw new AppError("A conta não concedeu leitura da agenda.", "unavailable");
  }
  writeTokens(dataDir, {
    refreshToken: payload.refresh_token,
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000).toISOString(),
    scope: payload.scope ?? CALENDAR_READONLY_SCOPE,
  });
}

function listenForCode(
  expectedState: string,
  onListen: (port: number) => string,
): Promise<{ code: string; redirectUri: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<p>Pode fechar esta janela e voltar ao terminal.</p>");
      server.close();
      if (error) {
        reject(new AppError("A conexão da conta Google foi recusada.", "unavailable"));
        return;
      }
      if (!code || state !== expectedState) {
        reject(new AppError("A resposta da Google não confere com este pedido de conexão.", "unavailable"));
        return;
      }
      resolve({ code, redirectUri });
    });
    let redirectUri = "";
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new AppError("Não consegui abrir o retorno local da conexão.", "unavailable"));
        return;
      }
      redirectUri = onListen(address.port);
    });
    server.on("error", () => reject(new AppError("Não consegui abrir o retorno local da conexão.", "unavailable")));
  });
}
