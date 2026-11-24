import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadSectionLogos } from 'src/cv/cv-pdf-images';
import { cvPdfHtml, type VolunteerCv } from 'src/cv/cv-pdf-template';
import type { StorageService } from 'src/storage/storage.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
const STORED = 'http://api.test/api/v1/files/public/logo.png';

const storage = {
  readPublicImageByUrl: (url: string) =>
    Promise.resolve(
      url === STORED ? { body: PNG, mimeType: 'image/png' as const } : null,
    ),
} as unknown as StorageService;

describe('loadSectionLogos', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/logo.svg') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(SVG);
      } else if (req.url === '/page.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html></html>');
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  it('reads stored logos from storage and downloads other image URLs once', async () => {
    const logos = await loadSectionLogos(
      [STORED, `${base}/logo.svg`, `${base}/logo.svg`, ''],
      storage,
    );
    expect(logos.size).toBe(2);
    expect(logos.get(STORED)).toBe(
      `data:image/png;base64,${PNG.toString('base64')}`,
    );
    expect(logos.get(`${base}/logo.svg`)).toBe(
      `data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`,
    );
  });

  it('leaves out logos that are missing or not images', async () => {
    const logos = await loadSectionLogos(
      [`${base}/missing.png`, `${base}/page.html`, '/relative.png'],
      storage,
    );
    expect(logos.size).toBe(0);
  });
});

describe('cvPdfHtml logos', () => {
  const cv = {
    generatedAt: new Date('2026-11-23T10:00:00Z'),
    person: { name: 'ريم', bio: '', city: '', fieldOfStudy: '', workField: '' },
    stats: { completedEvents: 2, volunteerHours: 4, approvedBadges: 2 },
    badges: [STORED, ''].map((logoUrl, i) => ({
      id: i,
      kind: 'BADGE',
      description: '',
      role: null,
      event: {
        title: `فعالية ${i}`,
        startsAt: new Date('2026-10-01T10:00:00Z'),
        section: { nameAr: 'البيئي', logoUrl },
        organizer: { name: 'جمعية' },
      },
    })),
    teams: [],
    impact: [],
  } as unknown as VolunteerCv;

  it('prints the logo next to badges whose section has one', () => {
    const html = cvPdfHtml(cv, new Map([[STORED, 'data:image/png;base64,AA']]));
    expect(html.match(/<img class="logo"/g)).toHaveLength(1);
    expect(html).toContain('src="data:image/png;base64,AA"');
  });

  it('prints no logo when none were loaded', () => {
    expect(cvPdfHtml(cv)).not.toContain('<img');
  });
});
