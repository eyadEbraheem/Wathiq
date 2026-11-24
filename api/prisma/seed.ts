// Seeds the fixed reference data: the 5 sections, their topics, the platform's official
// account, the first admin and an initial banned-words list. Safe to run any number of times (upserts).
// With SEED_DEMO=true it also adds demo accounts and content (prisma/demo-data.ts), and with
// SEED_SHOWCASE=true a large made-up platform with photos for local demos (prisma/showcase/).
//
//   npm run db:seed -w api   (or: npx prisma db seed, from api/)

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { existsSync } from 'fs';
import { join } from 'path';
import { normalizeArabic } from '../src/common/utils/arabic';
import { seedDemo } from './demo-data';
import { seedShowcase } from './showcase';

// Read api/.env ourselves: the Prisma Client only finds it on its own when it was generated
// after .env existed, which is not the case on a fresh clone. Values already set win.
const envFile = join(__dirname, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

type TopicSeed = { slug: string; nameAr: string; nameEn: string };
type SectionSeed = {
  slug: string;
  nameAr: string;
  nameEn: string;
  topics: TopicSeed[];
};

// Logos are added once the design system exists (also used as event badge images).
const SECTIONS: SectionSeed[] = [
  {
    slug: 'environment',
    nameAr: 'البيئة',
    nameEn: 'Environment',
    topics: [
      { slug: 'tree-planting', nameAr: 'التشجير', nameEn: 'Tree planting' },
      { slug: 'clean-ups', nameAr: 'حملات النظافة', nameEn: 'Clean-ups' },
      { slug: 'recycling', nameAr: 'إعادة التدوير', nameEn: 'Recycling' },
      {
        slug: 'water-conservation',
        nameAr: 'ترشيد المياه',
        nameEn: 'Water conservation',
      },
      {
        slug: 'environmental-awareness',
        nameAr: 'التوعية البيئية',
        nameEn: 'Environmental awareness',
      },
    ],
  },
  {
    slug: 'animal-welfare',
    nameAr: 'الرفق بالحيوان',
    nameEn: 'Animal welfare',
    topics: [
      {
        slug: 'stray-feeding',
        nameAr: 'إطعام الحيوانات الشاردة',
        nameEn: 'Stray feeding',
      },
      { slug: 'adoption', nameAr: 'التبنّي', nameEn: 'Adoption' },
      { slug: 'vet-care', nameAr: 'الرعاية البيطرية', nameEn: 'Vet care' },
      {
        slug: 'animal-rescue',
        nameAr: 'إنقاذ الحيوانات',
        nameEn: 'Animal rescue',
      },
      { slug: 'shelters', nameAr: 'الملاجئ', nameEn: 'Shelters' },
    ],
  },
  {
    slug: 'humanitarian',
    nameAr: 'الإنساني',
    nameEn: 'Humanitarian',
    topics: [
      { slug: 'medical-cases', nameAr: 'حالات طبية', nameEn: 'Medical cases' },
      { slug: 'food-aid', nameAr: 'مساعدات غذائية', nameEn: 'Food aid' },
      { slug: 'housing', nameAr: 'المأوى والسكن', nameEn: 'Housing' },
      {
        slug: 'education-support',
        nameAr: 'دعم التعليم',
        nameEn: 'Education support',
      },
      {
        slug: 'winter-relief',
        nameAr: 'التدفئة والشتاء',
        nameEn: 'Winter relief',
      },
    ],
  },
  {
    slug: 'community',
    nameAr: 'المجتمع',
    nameEn: 'Community',
    topics: [
      {
        slug: 'youth-initiatives',
        nameAr: 'مبادرات شبابية',
        nameEn: 'Youth initiatives',
      },
      {
        slug: 'culture-arts',
        nameAr: 'الثقافة والفنون',
        nameEn: 'Culture & arts',
      },
      {
        slug: 'public-spaces',
        nameAr: 'ترميم الأماكن العامة',
        nameEn: 'Public spaces',
      },
      {
        slug: 'elderly-care',
        nameAr: 'رعاية كبار السن',
        nameEn: 'Elderly care',
      },
      {
        slug: 'rights',
        nameAr: 'قضايا مجتمعية وحقوق',
        nameEn: 'Social issues & rights',
      },
      {
        slug: 'special-needs',
        nameAr: 'ذوي الاحتياجات الخاصة',
        nameEn: 'People with disabilities',
      },
      {
        slug: 'mental-health',
        nameAr: 'الصحة النفسية',
        nameEn: 'Mental health',
      },
    ],
  },
  {
    slug: 'education',
    nameAr: 'التعليمي',
    nameEn: 'Education',
    topics: [
      {
        slug: 'scholarships',
        nameAr: 'المنح الدراسية',
        nameEn: 'Scholarships',
      },
      {
        slug: 'trainings',
        nameAr: 'التدريبات والورشات',
        nameEn: 'Trainings & workshops',
      },
      { slug: 'internships', nameAr: 'التدريب العملي', nameEn: 'Internships' },
      {
        slug: 'jobs',
        nameAr: 'فرص العمل والتطوع المهني',
        nameEn: 'Jobs & professional volunteering',
      },
      {
        slug: 'competitions',
        nameAr: 'المسابقات والهاكاثونات',
        nameEn: 'Competitions & hackathons',
      },
    ],
  },
];

// Topics that moved: the old row is renamed (same id), so posts and interests that used it
// follow it to its new section. new slug -> old slug.
const TOPIC_RENAMES: Record<string, string> = {
  'education--trainings': 'community--training',
};

// Starting list; admins edit it later. Matched as whole words after Arabic normalization.
const BANNED_WORDS = [
  'غبي',
  'حقير',
  'تافه',
  'منحط',
  'ساقط',
  'واطي',
  'عاهرة',
  'شرموطة',
  'منيوك',
  'كس اختك',
  'كس امك',
  'يلعن',
  'طيز',
  'خرا',
  'fuck',
  'shit',
  'bitch',
];

const prisma = new PrismaClient();

async function seedSections(): Promise<void> {
  for (const [sectionIndex, s] of SECTIONS.entries()) {
    const section = await prisma.section.upsert({
      where: { slug: s.slug },
      update: { nameAr: s.nameAr, nameEn: s.nameEn, sortOrder: sectionIndex },
      create: {
        slug: s.slug,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        logoUrl: '',
        sortOrder: sectionIndex,
      },
    });

    for (const [topicIndex, t] of s.topics.entries()) {
      // Topic slugs are globally unique, so they are prefixed with the section slug.
      const slug = `${s.slug}--${t.slug}`;
      const oldSlug = TOPIC_RENAMES[slug];
      if (oldSlug && !(await prisma.topic.findUnique({ where: { slug } }))) {
        await prisma.topic.updateMany({
          where: { slug: oldSlug },
          data: { slug },
        });
      }
      await prisma.topic.upsert({
        where: { slug },
        update: {
          sectionId: section.id,
          nameAr: t.nameAr,
          nameEn: t.nameEn,
          sortOrder: topicIndex,
        },
        create: {
          slug,
          sectionId: section.id,
          nameAr: t.nameAr,
          nameEn: t.nameEn,
          sortOrder: topicIndex,
        },
      });
    }
  }
}

// The platform's own verified organization account. It has no usable password (empty hash
// never matches); the owner sets one through the password-reset flow once auth exists.
async function seedOfficialAccount(): Promise<void> {
  const name = process.env.OFFICIAL_ACCOUNT_NAME ?? 'واثق';
  const email =
    process.env.OFFICIAL_ACCOUNT_EMAIL ?? 'official@civil-society-hub.local';
  const now = new Date();

  const existing = await prisma.user.findFirst({ where: { isOfficial: true } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { name, email },
    });
    return;
  }

  await prisma.user.create({
    data: {
      name,
      email,
      emailVerifiedAt: now,
      passwordHash: '',
      // Required by the schema for every account; meaningless for an organization.
      birthDate: new Date('2000-01-01'),
      verifiedKind: 'ORGANIZATION',
      verifiedAt: now,
      isOfficial: true,
      acceptsPublishRequests: true,
      onboardingCompletedAt: now,
    },
  });
}

// The first platform admin (reviews verification requests, reports, ...), a normal person
// account with role ADMIN. Email and password come from ADMIN_EMAIL / ADMIN_PASSWORD in .env,
// never from the code. The password is only set when the account is created, so changing it
// later in the app is not overwritten by re-running the seed.
async function seedAdmin(): Promise<'created' | 'updated' | 'skipped'> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!email) {
    console.warn('ADMIN_EMAIL is not set: no admin account seeded.');
    return 'skipped';
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN' },
    });
    return 'updated';
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  }
  const now = new Date();
  await prisma.user.create({
    data: {
      name: process.env.ADMIN_NAME ?? 'Platform Admin',
      email,
      emailVerifiedAt: now,
      passwordHash: await bcrypt.hash(password, 10),
      // Required by the schema; the admin can change it from the profile.
      birthDate: new Date('1990-01-01'),
      role: 'ADMIN',
      onboardingCompletedAt: now,
    },
  });
  return 'created';
}

async function seedBannedWords(): Promise<void> {
  for (const word of BANNED_WORDS) {
    const normalized = normalizeArabic(word);
    await prisma.bannedWord.upsert({
      where: { normalized },
      update: {},
      create: { word, normalized },
    });
  }
}

// Accounts created before search existed get their normalized name.
async function backfillSearchNames(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { searchName: '' },
    select: { id: true, name: true },
  });
  for (const u of users) {
    await prisma.user.update({
      where: { id: u.id },
      data: { searchName: normalizeArabic(u.name) },
    });
  }
}

async function main(): Promise<void> {
  await seedSections();
  await seedOfficialAccount();
  const admin = await seedAdmin();
  await seedBannedWords();
  await backfillSearchNames();
  const demo =
    process.env.SEED_DEMO === 'true' ? await seedDemo(prisma) : 'demo off';
  const showcase =
    process.env.SEED_SHOWCASE === 'true'
      ? await seedShowcase(prisma)
      : 'showcase off';

  const [sections, topics, official, admins, banned] = await Promise.all([
    prisma.section.count(),
    prisma.topic.count(),
    prisma.user.count({ where: { isOfficial: true } }),
    prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } }),
    prisma.bannedWord.count(),
  ]);
  console.log(
    `Seed done: ${sections} sections, ${topics} topics, ${official} official account, ` +
      `${admins} admin(s) (seed admin ${admin}), ${banned} banned words, ${demo}, ${showcase}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
