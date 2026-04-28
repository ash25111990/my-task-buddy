import { createServerFn } from "@tanstack/react-start";

/**
 * Google Sheets integration — reads tasks from a shared admin sheet using a service account.
 *
 * Required env vars (add via Lovable secrets when ready):
 *   - GOOGLE_SHEETS_ID                  -> the spreadsheet ID from the sheet URL
 *   - GOOGLE_SERVICE_ACCOUNT_EMAIL      -> client_email from the service account JSON
 *   - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY-> private_key from the service account JSON
 *                                          (paste the full PEM, with \n escaped or real newlines)
 *
 * Sheet format (tab named "Tasks"), first row is headers:
 *   id | title | date | time | priority | category | done
 *   - date: YYYY-MM-DD
 *   - priority: low | medium | high
 *   - done: TRUE/FALSE (or 1/0)
 *
 * IMPORTANT: share the sheet with the service account email (Viewer access).
 */

export type SheetTask = {
  id: string;
  title: string;
  date: string;
  time?: string;
  priority: "low" | "medium" | "high";
  category: string;
  done: boolean;
};

const SHEET_RANGE = "Tasks!A2:G"; // skip header row

// Convert a PEM private key string into an ArrayBuffer that WebCrypto can import.
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64UrlEncode(input: string | ArrayBuffer): string {
  let str: string;
  if (typeof input === "string") {
    str = btoa(input);
  } else {
    const bytes = new Uint8Array(input);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    str = btoa(binary);
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encClaim = base64UrlEncode(JSON.stringify(claim));
  const signingInput = `${encHeader}.${encClaim}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google OAuth token request failed [${tokenRes.status}]: ${await tokenRes.text()}`);
  }
  const json = (await tokenRes.json()) as { access_token: string };
  return json.access_token;
}

export const fetchTasksFromSheet = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ tasks: SheetTask[]; error: string | null; configured: boolean }> => {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!sheetId || !clientEmail || !privateKey) {
      return {
        tasks: [],
        error: null,
        configured: false,
      };
    }

    try {
      const accessToken = await getAccessToken(clientEmail, privateKey);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        sheetId,
      )}/values/${encodeURIComponent(SHEET_RANGE)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`Google Sheets API error [${res.status}]: ${body}`);
        return { tasks: [], error: `Sheets API error (${res.status})`, configured: true };
      }

      const json = (await res.json()) as { values?: string[][] };
      const rows = json.values ?? [];

      const tasks: SheetTask[] = rows
        .filter((r) => r[0] && r[1] && r[2])
        .map((r) => {
          const priority = (r[4] || "medium").toLowerCase();
          const doneRaw = (r[6] || "").toString().toLowerCase().trim();
          return {
            id: String(r[0]),
            title: String(r[1]),
            date: String(r[2]),
            time: r[3] ? String(r[3]) : undefined,
            priority: (["low", "medium", "high"].includes(priority) ? priority : "medium") as
              | "low"
              | "medium"
              | "high",
            category: r[5] ? String(r[5]) : "General",
            done: doneRaw === "true" || doneRaw === "1" || doneRaw === "yes",
          };
        });

      return { tasks, error: null, configured: true };
    } catch (err) {
      console.error("Failed to fetch Google Sheet:", err);
      return {
        tasks: [],
        error: err instanceof Error ? err.message : "Unknown error",
        configured: true,
      };
    }
  },
);
