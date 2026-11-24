import "server-only";
import QRCode from "qrcode";

/**
 * Address of this website as another device sees it: the QR must open from a phone, where
 * "localhost" would mean the phone itself. Locally, set it to this computer's network IP.
 */
const PUBLIC_WEB_URL = (process.env.PUBLIC_WEB_URL ?? "http://localhost:3001").replace(/\/+$/, "");

/** Full address of the public CV page for a share token. */
export function cvShareUrl(token: string): string {
  return `${PUBLIC_WEB_URL}/cv/share/${encodeURIComponent(token)}`;
}

/**
 * What the QR holds: the link, plus `#o=<signed copy>` when the API sent one. A phone camera
 * opens the link as usual (browsers never send the part after "#" to the server); the Wathiq
 * app reads the signed copy and shows the CV without internet.
 */
export function cvQrContent(url: string, offline: string | null): string {
  return offline ? `${url}#o=${offline}` : url;
}

/** The QR as an SVG, drawn on the server (no QR script is sent to the browser). */
export function qrSvg(content: string): Promise<string> {
  return QRCode.toString(content, {
    type: "svg",
    // A long offline copy needs the lowest error correction to keep the code readable.
    errorCorrectionLevel: content.length > 300 ? "L" : "M",
    margin: 1,
    color: { dark: "#13263A", light: "#FFFFFF" },
  });
}
