// Optional demo content so the web and the mobile app have something to show locally:
// two verified organizations, one volunteer, and posts / events / a case / an opportunity in
// every section. Runs only with SEED_DEMO=true; the shared password comes from DEMO_PASSWORD
// (never from the code). Runs once: skipped if the demo organization already exists.
//
// Demo accounts (password = DEMO_PASSWORD):
//   demo-green@wathiq.local     فريق سلمية الأخضر (verified organization)
//   demo-hope@wathiq.local      جمعية الأمل الخيرية (verified organization)
//   demo-volunteer@wathiq.local سامر الحسن (volunteer)
//   demo-admin@wathiq.local     مدير تجريبي (platform admin, added on any later run too)

import type { Governorate, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { normalizeArabic } from '../src/common/utils/arabic';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number, hour = 9) => {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(hour - 3, 0, 0, 0); // Damascus is UTC+3
  return d;
};

export async function seedDemo(prisma: PrismaClient): Promise<string> {
  const password = process.env.DEMO_PASSWORD ?? '';
  if (password.length < 8) {
    return 'demo skipped (set DEMO_PASSWORD, 8+ characters)';
  }
  const passwordHash = await bcrypt.hash(password, 10);

  // A local admin to try the admin pages without the real admin's password.
  const adminCreated = !(await prisma.user.findUnique({
    where: { email: 'demo-admin@wathiq.local' },
  }));
  if (adminCreated) {
    await prisma.user.create({
      data: {
        email: 'demo-admin@wathiq.local',
        name: 'مدير تجريبي',
        searchName: normalizeArabic('مدير تجريبي'),
        passwordHash,
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
        birthDate: new Date('1990-01-01'),
        onboardingCompletedAt: new Date(),
        showInSearch: false,
      },
    });
  }

  if (await prisma.user.findUnique({ where: { email: 'demo-green@wathiq.local' } })) {
    return adminCreated ? 'demo already there, demo admin added' : 'demo already there';
  }

  const sections = await prisma.section.findMany({ include: { topics: true } });
  const section = (slug: string) => {
    const s = sections.find((x) => x.slug === slug);
    if (!s) throw new Error(`Run the normal seed first: section ${slug} is missing.`);
    return s;
  };
  const topic = (sectionSlug: string, topicSlug: string) => {
    const t = section(sectionSlug).topics.find((x) => x.slug === `${sectionSlug}--${topicSlug}`);
    if (!t) throw new Error(`Topic ${sectionSlug}--${topicSlug} is missing.`);
    return t.id;
  };

  const account = (
    email: string,
    name: string,
    extra: Record<string, unknown> = {},
  ) =>
    prisma.user.create({
      data: {
        email,
        name,
        searchName: normalizeArabic(name),
        passwordHash,
        emailVerifiedAt: new Date(),
        birthDate: new Date('1996-04-12'),
        onboardingCompletedAt: new Date(),
        ...extra,
      },
    });

  const org = (email: string, name: string, governorate: Governorate, city: string, bio: string) =>
    account(email, name, {
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
      birthDate: new Date('2016-03-01'),
      governorate,
      city,
      bio,
    });

  const green = await org(
    'demo-green@wathiq.local',
    'فريق سلمية الأخضر',
    'HAMA',
    'سلمية',
    'فريق شبابي يعمل على التشجير والنظافة وإعادة التدوير في سلمية وريفها منذ 2016.',
  );
  const hope = await org(
    'demo-hope@wathiq.local',
    'جمعية الأمل الخيرية',
    'HOMS',
    'حمص',
    'جمعية أهلية تتابع الحالات الإنسانية والتعليمية في حمص وتنسّق التبرعات المباشرة للعائلات.',
  );
  const volunteer = await account('demo-volunteer@wathiq.local', 'سامر الحسن', {
    governorate: 'HAMA',
    city: 'سلمية',
    primarySectionId: section('environment').id,
  });
  await prisma.userSectionInterest.createMany({
    data: ['environment', 'humanitarian', 'education'].map((slug) => ({
      userId: volunteer.id,
      sectionId: section(slug).id,
    })),
  });
  await prisma.userTopicInterest.createMany({
    data: [topic('environment', 'tree-planting'), topic('humanitarian', 'medical-cases')].map(
      (topicId) => ({ userId: volunteer.id, topicId }),
    ),
  });
  await prisma.follow.create({ data: { followerId: volunteer.id, followingId: green.id } });

  const post = (
    authorId: number,
    sectionSlug: string,
    topicIds: number[],
    title: string,
    body: string,
    extra: Record<string, unknown> = {},
  ) =>
    prisma.post.create({
      data: {
        authorId,
        sectionId: section(sectionSlug).id,
        title,
        body,
        topics: { create: topicIds.map((topicId) => ({ topicId })) },
        ...extra,
      },
    });

  // Environment: an event with roles (the volunteer is accepted), and a normal post.
  const planting = await post(
    green.id,
    'environment',
    [topic('environment', 'tree-planting')],
    'حملة تشجير الحديقة الشمالية',
    'نزرع 300 شجرة زيتون وصنوبر مع أهالي الحي. نوفّر القفازات والأدوات والمياه، أحضر قبعة وحماسك.',
    {
      kind: 'EVENT',
      upvoteCount: 24,
      event: {
        create: {
          startsAt: inDays(9),
          endsAt: inDays(9, 13),
          applicationDeadline: inDays(7, 22),
          capacity: 25,
          volunteerHours: 4,
          governorate: 'HAMA',
          city: 'سلمية',
          locationText: 'الحديقة العامة الشمالية، المدخل الرئيسي',
          minAge: 14,
          documentationDueAt: inDays(16),
          applicationQuestions: [{ id: 'q1', text: 'هل شاركت في حملة تشجير من قبل؟', required: false }],
          roles: {
            create: [
              { name: 'زراعة', seats: 18, sortOrder: 0 },
              { name: 'تنظيم وتسجيل', seats: 5, sortOrder: 1 },
              { name: 'تصوير وتوثيق', seats: 2, sortOrder: 2 },
            ],
          },
        },
      },
    },
  );
  const plantingRole = await prisma.eventRole.findFirstOrThrow({
    where: { eventId: planting.id, name: 'زراعة' },
  });
  await prisma.eventApplication.create({
    data: {
      eventId: planting.id,
      userId: volunteer.id,
      status: 'ACCEPTED',
      roleId: plantingRole.id,
      decidedById: green.id,
      decidedAt: new Date(),
      roleChoices: { create: [{ roleId: plantingRole.id, rank: 1 }] },
    },
  });

  await post(
    green.id,
    'environment',
    [topic('environment', 'recycling')],
    'نقطة جديدة لجمع البلاستيك في السوق',
    'افتتحنا نقطة لجمع العبوات البلاستيكية قرب السوق القديم. كل كيس يصل إلينا يُفرز ويُرسل لمعمل إعادة التدوير.',
    { upvoteCount: 9 },
  );

  // Humanitarian: a case (contact + payment note, no money through the platform) and an event.
  await post(
    hope.id,
    'humanitarian',
    [topic('humanitarian', 'medical-cases')],
    'سلمى تحتاج عملية قلب مفتوح',
    'سلمى (6 سنوات) تحتاج عملية قلب مفتوح خلال شهر. تكلفة العملية تفوق قدرة العائلة، وتتابع الجمعية الحالة مع المستشفى.',
    {
      upvoteCount: 41,
      caseDetails: {
        create: {
          contactPhone: '+963933000111',
          paymentNote: 'التحويل مباشرة لوالد الطفلة عبر شام كاش، لا تمر أي أموال عبر المنصة.',
        },
      },
    },
  );
  await post(
    hope.id,
    'humanitarian',
    [topic('humanitarian', 'winter-relief')],
    'توزيع حصص الشتاء في حي الوعر',
    'نحتاج متطوعين لتجهيز وتوزيع 200 حصة شتوية (بطانيات ومدافئ) على العائلات المسجّلة.',
    {
      kind: 'EVENT',
      upvoteCount: 15,
      event: {
        create: {
          startsAt: inDays(4, 10),
          endsAt: inDays(4, 15),
          capacity: 12,
          volunteerHours: 4,
          governorate: 'HOMS',
          city: 'حمص',
          locationText: 'مستودع الجمعية، حي الوعر',
          minAge: 16,
          documentationDueAt: inDays(11),
        },
      },
    },
  );

  // Animal welfare and community.
  await post(
    green.id,
    'animal-welfare',
    [topic('animal-welfare', 'stray-feeding')],
    'محطات إطعام للقطط في الشتاء',
    'وزّعنا 15 محطة إطعام ومياه في الأحياء. إذا رأيت محطة فارغة صوّرها وأرسل لنا الموقع.',
    { upvoteCount: 12 },
  );
  await post(
    hope.id,
    'community',
    [topic('community', 'youth-initiatives')],
    'لقاء شبابي: كيف نطلق مبادرة في حيّنا؟',
    'جلسة مفتوحة يشارك فيها أصحاب مبادرات ناجحة تجاربهم، مع ورشة صغيرة لكتابة فكرة مبادرتك.',
    {
      kind: 'EVENT',
      upvoteCount: 7,
      event: {
        create: {
          startsAt: inDays(12, 17),
          endsAt: inDays(12, 19),
          capacity: 40,
          volunteerHours: 4,
          governorate: 'HOMS',
          city: 'حمص',
          locationText: 'المركز الثقافي',
          documentationDueAt: inDays(19),
        },
      },
    },
  );

  // Education: an external opportunity and a training (an event; its badge is a certificate).
  await post(
    hope.id,
    'education',
    [topic('education', 'scholarships')],
    'منحة دراسية لطلاب الهندسة',
    'منحة تغطي رسوم سنة دراسية كاملة لطلاب الهندسة المتفوقين في السنة الثانية وما بعد.',
    {
      upvoteCount: 19,
      opportunity: {
        create: {
          deadline: inDays(20, 23),
          applyUrl: 'https://example.org/scholarship',
          mode: 'ONLINE',
          eligibility: 'طلاب الهندسة بمعدل 75% فما فوق',
          field: 'الهندسة',
        },
      },
    },
  );
  await post(
    green.id,
    'education',
    [topic('education', 'trainings')],
    'تدريب الإسعافات الأولية للمتطوعين',
    'تدريب عملي ليوم واحد مع مدرّب معتمد، يحصل المشاركون بعده على شهادة حضور على المنصة.',
    {
      kind: 'EVENT',
      upvoteCount: 11,
      event: {
        create: {
          startsAt: inDays(6, 10),
          endsAt: inDays(6, 16),
          capacity: 20,
          volunteerHours: 4,
          governorate: 'HAMA',
          city: 'سلمية',
          locationText: 'قاعة المركز الثقافي',
          minAge: 16,
          documentationDueAt: inDays(13),
        },
      },
    },
  );

  return 'demo created (4 accounts incl. a demo admin, 9 posts and events)';
}
