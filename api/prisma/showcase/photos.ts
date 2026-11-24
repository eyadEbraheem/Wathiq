// Campaign photos for the showcase seed: free-license pictures from Unsplash (Unsplash License:
// free to use, no attribution required). Downloaded once into prisma/.showcase-images/
// (git-ignored), then copied into local storage, one file per post (the API deletes a post's
// files with it, so posts never share a file).

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';

export type PhotoTopic =
  | 'trees'
  | 'cleanup'
  | 'river'
  | 'beach'
  | 'recycling'
  | 'food'
  | 'clothes'
  | 'blood'
  | 'books'
  | 'cats'
  | 'dogs'
  | 'vet'
  | 'painting'
  | 'heritage'
  | 'elderly'
  | 'workshop'
  | 'classroom'
  | 'firstaid'
  | 'coding'
  | 'hospital';

/** Unsplash photo ids (images.unsplash.com/<id>) per campaign type. */
export const PHOTOS: Record<PhotoTopic, string[]> = {
  trees: [
    'photo-1598335624134-5bceb5de202d',
    'photo-1544928938-6852c1925194',
    'photo-1551855350-c86caeaf8707',
    'photo-1787013303584-06b1b187a73e',
    'photo-1776988931450-7377dead1ed0',
    'photo-1787013297320-7ec1e54029a1',
    'photo-1735504647714-575fdb0a8a47',
    'photo-1777150895644-2ca253ee1c93',
  ],
  cleanup: [
    'photo-1758599668360-48ba8ba71b47',
    'photo-1758599668429-121d54188b9c',
    'photo-1758599668234-68f52db62425',
    'photo-1758599668299-beebedfabf7b',
    'photo-1758599668426-1cf242bb7667',
    'photo-1758599668178-d9716bbda9d5',
  ],
  river: [
    'photo-1758599668932-484f54cdf48f',
    'photo-1758599668426-1cf242bb7667',
    'photo-1758599668299-beebedfabf7b',
  ],
  beach: [
    'photo-1758599668949-5118d71838fd',
    'photo-1617953141905-b27fb1f17d88',
    'photo-1588106832140-87523dd73ed0',
  ],
  recycling: [
    'photo-1595278069441-2cf29f8005a4',
    'photo-1536939459926-301728717817',
    'photo-1756362399416-503694e40cf5',
    'photo-1591193686104-fddba4d0e4d8',
  ],
  food: [
    'photo-1599059813005-11265ba4b4ce',
    'photo-1628717341663-0007b0ee2597',
    'photo-1593113616828-6f22bca04804',
    'photo-1593113646773-028c64a8f1b8',
    'photo-1733809697694-52c0c58ab888',
    'photo-1653508310732-cad8be3cd260',
    'photo-1599059898816-d08dd9afb4b5',
    'photo-1595054225874-7d2315262e73',
    'photo-1783028104792-8506735c0383',
  ],
  clothes: [
    'photo-1604072374690-0e7d7bddd54e',
    'photo-1567113463300-102a7eb3cb26',
    'photo-1604176354204-9268737828e4',
    'photo-1647152777991-4298db91a1f6',
    'photo-1542060748-10c28b62716f',
  ],
  blood: [
    'photo-1615461066159-fea0960485d5',
    'photo-1683791895200-201c0c40310f',
  ],
  books: [
    'photo-1550399105-c4db5fb85c18',
    'photo-1495446815901-a7297e633e8d',
    'photo-1614849963640-9cc74b2a826f',
    'photo-1601469090980-fc95e8d95544',
  ],
  cats: [
    'photo-1520811607976-6d7812b0ecac',
    'photo-1769947322352-dd6cbdc4ec2d',
    'photo-1785996757953-7a2b78ba65fc',
    'photo-1786283593115-fabb58e9fb9b',
    'photo-1773633495978-4a5c061fe802',
    'photo-1769034520368-5db5a20b6227',
    'photo-1746254919609-262d05c4fa28',
  ],
  dogs: [
    'photo-1444212477490-ca407925329e',
    'photo-1542715234-bd0adb4249b7',
    'photo-1675701917791-debd2d61cc4a',
    'photo-1542715234-4bafcfc68bd9',
    'photo-1604606363386-dd3f2357ad87',
    'photo-1743506444917-38047eabb60a',
  ],
  vet: [
    'photo-1596272875729-ed2ff7d6d9c5',
    'photo-1725409796872-8b41e8eca929',
    'photo-1733783506192-653df6185a7d',
    'photo-1728013274420-ed02b1f58887',
  ],
  painting: [
    'photo-1529722155810-17303d209942',
    'photo-1522600579804-c66aa476298e',
    'photo-1751666526244-40239a251eae',
    'photo-1560938077-a7100d1ae1d0',
    'photo-1574472369600-e47cffce9a68',
    'photo-1721996155958-84ffc0504802',
    'photo-1744960147383-a642f7c57bff',
    'photo-1567826392089-22e5e902e977',
  ],
  heritage: [
    'photo-1645740262380-d86b597b90c4',
    'photo-1781973358123-3450d3093bd4',
    'photo-1781972519543-b21956954667',
    'photo-1782835537126-89bd2c25dee2',
  ],
  elderly: [
    'photo-1762955911431-4c44c7c3f408',
    'photo-1762955911769-d652ceaa94bb',
    'photo-1773227055624-07b515ba87c5',
    'photo-1765896387387-0538bc9f997e',
    'photo-1773227059780-5e865ce7fb13',
  ],
  workshop: [
    'photo-1755548836775-39456093a0c3',
    'photo-1755548788258-e4844461aaf2',
    'photo-1720347274787-961f33ef151d',
    'photo-1755548836818-6cbe3cffb4c3',
    'photo-1793393451403-249d3dff74c4',
  ],
  classroom: [
    'photo-1509062522246-3755977927d7',
    'photo-1577896851231-70ef18881754',
    'photo-1588072432836-e10032774350',
    'photo-1588075592405-d3d4f0846961',
    'photo-1636202339022-7d67f7447e3a',
    'photo-1589206946274-929e4da3996b',
    'photo-1727473704274-3fbad0dbbd60',
  ],
  firstaid: [
    'photo-1755548376576-e045f6e01773',
    'photo-1755549746563-a7c0a391af36',
    'photo-1755718669693-5e5e9ce53e17',
    'photo-1624638760852-8ede1666ab07',
    'photo-1765996796562-ce301df337a0',
  ],
  coding: [
    'photo-1555066931-4365d14bab8c',
    'photo-1484417894907-623942c8ee29',
    'photo-1632910121591-29e2484c0259',
    'photo-1610484826917-0f101a7bf7f4',
  ],
  hospital: [
    'photo-1578496781985-452d4a934d50',
    'photo-1550792436-181701c71f63',
    'photo-1758206523860-0583e7b51a5e',
    'photo-1631201039086-1405a889c699',
  ],
};

const CACHE_DIR = resolve(__dirname, '..', '.showcase-images');
const SIZE = 'w=1000&q=62&fm=jpg&fit=max';
const isJpeg = (b: Buffer) =>
  b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** Downloads every photo that is not cached yet (8 at a time). Returns the ones that failed. */
export async function downloadPhotos(): Promise<string[]> {
  await mkdir(CACHE_DIR, { recursive: true });
  const ids = [...new Set(Object.values(PHOTOS).flat())].filter(
    (id) => !existsSync(join(CACHE_DIR, `${id}.jpg`)),
  );
  const failed: string[] = [];
  for (let i = 0; i < ids.length; i += 8) {
    await Promise.all(
      ids.slice(i, i + 8).map(async (id) => {
        try {
          const res = await fetch(`https://images.unsplash.com/${id}?${SIZE}`, {
            signal: AbortSignal.timeout(30_000),
          });
          const body = Buffer.from(await res.arrayBuffer());
          if (!res.ok || !isJpeg(body)) throw new Error(`HTTP ${res.status}`);
          await writeFile(join(CACHE_DIR, `${id}.jpg`), body);
        } catch {
          failed.push(id);
        }
      }),
    );
  }
  return failed;
}

/** Copies cached photos into local storage, exactly like an upload through the API. */
export class PhotoStore {
  private readonly root = resolve(
    process.cwd(),
    process.env.STORAGE_LOCAL_DIR ?? './storage',
  );
  private readonly apiUrl = (
    process.env.API_PUBLIC_URL ?? 'http://localhost:3000'
  ).replace(/\/+$/, '');
  private readonly cache = new Map<string, Buffer>();
  stored = 0;

  async store(
    id: string,
  ): Promise<{ storageKey: string; url: string; mimeType: string } | null> {
    let body = this.cache.get(id);
    if (!body) {
      const path = join(CACHE_DIR, `${id}.jpg`);
      if (!existsSync(path)) return null;
      body = await readFile(path);
      this.cache.set(id, body);
    }
    const name = `${randomUUID()}.jpg`;
    await mkdir(join(this.root, 'public'), { recursive: true });
    await writeFile(join(this.root, 'public', name), body);
    this.stored += 1;
    return {
      storageKey: `public/${name}`,
      url: `${this.apiUrl}/api/v1/files/public/${name}`,
      mimeType: 'image/jpeg',
    };
  }
}
