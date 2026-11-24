import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer';

/** The only outside requests the CV page may make: the Google Fonts stylesheet and files. */
const ALLOWED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
/** How long the fonts may take before the PDF is printed with the fallback font. */
const FONT_WAIT_MS = 8000;

/**
 * Turns an HTML page into an A4 PDF with headless Chrome (Puppeteer). One browser is started on
 * the first request and kept for the next ones; every PDF gets its own tab, closed afterwards.
 */
@Injectable()
export class CvPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(CvPdfService.name);
  private browser: Promise<Browser> | null = null;

  /** `footer`: optional HTML printed at the bottom of every page (see `cvPdfFooter`). */
  async render(html: string, footer?: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // The page is our own template with escaped user text; it needs no JavaScript.
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = request.url();
        const allowed =
          url.startsWith('data:') ||
          url === 'about:blank' ||
          (url.startsWith('https://') && ALLOWED_HOSTS.has(new URL(url).host));
        void (allowed ? request.continue() : request.abort());
      });
      try {
        await page.setContent(html, {
          waitUntil: 'load',
          timeout: FONT_WAIT_MS,
        });
        // The font files load after the stylesheet; wait until nothing is downloading.
        await page.waitForNetworkIdle({ idleTime: 300, timeout: FONT_WAIT_MS });
      } catch {
        // No internet (or slow fonts): print anyway with the system's Arabic font.
        this.logger.warn('CV fonts did not load in time; using the fallback.');
      }
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: footer !== undefined,
        headerTemplate: '<span></span>',
        footerTemplate: footer ?? '<span></span>',
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async onModuleDestroy() {
    if (!this.browser) return;
    const browser = await this.browser.catch(() => null);
    this.browser = null;
    await browser?.close().catch(() => undefined);
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = puppeteer
        .launch({
          headless: true,
          // Chrome refuses to sandbox as root (a typical Linux server); elsewhere keep it.
          args: process.getuid?.() === 0 ? ['--no-sandbox'] : [],
        })
        .then((browser) => {
          this.logger.log('Started headless Chrome for CV PDFs.');
          // If Chrome dies, start a new one on the next request.
          browser.on('disconnected', () => {
            this.browser = null;
          });
          return browser;
        })
        .catch((error: unknown) => {
          this.browser = null;
          throw error;
        });
    }
    return this.browser;
  }
}
