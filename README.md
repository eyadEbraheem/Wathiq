<div align="center">

# واثق · Wathiq

**منصة سورية للعمل المدني والتطوع**

تجمع الجمعيات والفرق التطوعية الموثّقة مع المتطوعين في مكان واحد: حملات وفعاليات، حالات إنسانية،
فرص تعليمية، شارات موثّقة وسيرة تطوعية قابلة للتحقق.

موقع ويب · تطبيق موبايل · واجهة برمجية واحدة

</div>

---

## المحتويات

- [نظرة عامة](#نظرة-عامة)
- [المزايا](#المزايا)
- [البنية](#البنية)
- [التقنيات](#التقنيات)
- [هيكل المستودع](#هيكل-المستودع)
- [التشغيل محلياً](#التشغيل-محلياً)
- [تشغيل كل جزء لوحده](#تشغيل-كل-جزء-لوحده)
- [متغيرات البيئة](#متغيرات-البيئة)
- [الأوامر](#الأوامر)
- [الواجهة البرمجية](#الواجهة-البرمجية)
- [الاختبارات](#الاختبارات)
- [الحسابات التجريبية](#الحسابات-التجريبية)
- [رابط العرض وتطبيق الموبايل](#رابط-العرض-وتطبيق-الموبايل)
- [القيود الحالية](#القيود-الحالية)
- [الفريق وتقسيم العمل](#الفريق-وتقسيم-العمل)
- [طريقة العمل](#طريقة-العمل)

---

## نظرة عامة

**واثق** منصة تطوع عربية (RTL) تخدم ثلاث فئات:

| الفئة | ماذا تفعل على المنصة |
|---|---|
| **المتطوع** | يتابع الأقسام والجهات التي تهمه، يتقدّم على الفعاليات، يحصل على شارات وشهادات حضور، ويصدّر سيرته التطوعية PDF أو يشاركها برابط ورمز QR. |
| **الجهة الموثّقة** (جمعية، فريق، أو فرد موثّق) | تنشر المنشورات والفعاليات والفرص والحالات الإنسانية، تدير المتطوعين والأدوار، توثّق الفعالية بالصور وأرقام الأثر، وتتابع إحصائيات حملاتها. |
| **إدارة المنصة** | تراجع طلبات التوثيق والبلاغات وطلبات النشر، تدير الكلمات الممنوعة، وتطّلع على إحصائيات المنصة كاملة. |

لا تمر أي أموال عبر المنصة: الحالات الإنسانية تعرض بيانات التواصل ورمز الدفع فقط.

## المزايا

### الحسابات والثقة
- تسجيل بالبريد أو الهاتف مع رمز تحقق (OTP)، ولا يُحفظ أي تواصل قبل تأكيده.
- تسجيل كجمعية: الحساب يبقى مجمّداً (تصفح فقط) حتى يقبل الفريق طلب التوثيق مع أوراق الجمعية.
- جلسات طويلة للموبايل عبر Access + Refresh tokens مع تدوير وإلغاء.
- خصوصية لكل حقل (العنوان، العمر، التحصيل، مجال العمل، الفرق)، ومخفية دائماً لمن هم دون 18.
- حذف الحساب حذفاً ناعماً كما تطلب متاجر التطبيقات.

### المحتوى والفعاليات
- خمسة أقسام: الإنساني، البيئة، الرفق بالحيوان، المجتمع، التعليمي، ولكل قسم مواضيعه.
- فعاليات بدورة حياة واضحة (مفتوحة ← مغلقة ← مكتملة / ملغاة)، سعة تُغلق تلقائياً عند الامتلاء، وأدوار بمقاعد
  يختار المتطوع منها حتى ثلاثة بالترتيب.
- توثيق الفعالية بالصور وأرقام الأثر (أشجار مزروعة، سلال موزّعة…)، ثم شارات يعتمدها المنظّم.
- تقييم المنظّم من 1 إلى 5 نجوم من المشاركين فقط.
- حالات إنسانية، فرص تعليمية بموعد تقديم، طلبات نشر من المستخدمين، وتعاون بين الجهات على منشور واحد.
- تعليقات بمستوى رد واحد، فلترة الكلمات الممنوعة، وبلاغات تصل للإدارة.

### للجهات
- **منشوراتي ومبادراتي:** كل ما نشرته الجهة في مكان واحد، مع ما ينتظر ردّها.
- **إحصائيات حملاتنا:** أرقام الحملات، الأشهر، المحافظات التي تحتاج حملات أو متطوعين، الأثر، وتصدير CSV.
- **جمعية الأسبوع:** كل أسبوع تُكرَّم الجهة التي استقبلت أكبر عدد من المتطوعين لأول مرة.
- دليل الجهات الموثّقة، والبحث بالاسم والمنطقة والاختصاص.

### السيرة التطوعية
- سيرة من الشارات المعتمدة والفرق والأثر، تُنزَّل ملف PDF جاهزاً (A4) من الخادم.
- رابط مشاركة سري مع رمز QR يحمل نسخة موقّعة (Ed25519) يقرأها تطبيق واثق **دون إنترنت** ويرفض أي نسخة معدّلة.

### الإشعارات
- إشعارات داخل التطبيق ودفع (Expo Push) عبر طابور في الخلفية.

## البنية

```
                 ┌──────────────────────┐
  web (Next.js) ─┤                      │
                 │   api  (NestJS)      ├── PostgreSQL (Prisma)
  mobile (Expo) ─┤   /api/v1  + Swagger │
                 │                      ├── تخزين الملفات
                 └──────────────────────┘
          packages/shared: الأنواع والثوابت المشتركة
```

- **`backend/` هو المصدر الوحيد لقواعد العمل:** التحقق، الصلاحيات، والوصول للبيانات. الويب والموبايل للواجهة فقط.
- المصادقة عبر `Authorization: Bearer`، والمسارات كلها تحت `/api/v1`.
- شكل خطأ موحّد `{ statusCode, message, error }`، وكل قائمة مقسّمة صفحات `{ data, meta }`.
- التواريخ بصيغة ISO 8601 UTC، والواجهات تعرضها بتوقيت دمشق.

## التقنيات

| الجزء | التقنيات |
|---|---|
| **الخادم** `backend/` | NestJS 10، TypeScript 5 (strict)، Prisma 6.7 مع PostgreSQL، JWT، bcrypt، Swagger، `@nestjs/schedule`، `@nestjs/throttler`، Puppeteer لملفات PDF، Jest + Supertest |
| **الويب** `frontend/` | Next.js 15 (App Router)، React 19، Tailwind CSS 3.4، Server Actions، خطوط Tajawal وCairo |
| **الموبايل** `mobile/` | Expo 54، React Native 0.81، SecureStore، Expo Notifications، Camera، Sharing |
| **المشترك** `packages/shared` | الأنواع، الـ enums، ألوان التصميم والتسميات العربية |

المنافذ: الخادم **3000**، الويب **3001**. ما أُضيف خارج تقنيات المعسكر موثّق في
[`docs/OUTSIDE-BOOTCAMP.md`](docs/OUTSIDE-BOOTCAMP.md).

## هيكل المستودع

```
wathiq/
├── backend/                الخادم (NestJS)
│   ├── prisma/             المخطط، الـ migrations، وبيانات العرض (seed)
│   ├── src/                وحدة لكل مورد: auth, users, posts, events, cv, stats …
│   └── test/               اختبارات e2e
├── frontend/               موقع الويب (Next.js)
│   └── src/
│       ├── app/            الصفحات (App Router)
│       ├── components/     المكوّنات، ومنها ui/ للعناصر الأساسية
│       └── lib/            الجلسة، الاتصال بالخادم، Server Actions
├── mobile/                 تطبيق الموبايل (Expo)
│   └── src/                الشاشات، الاتصال بالخادم، الإشعارات
├── packages/shared/        أنواع وثوابت مشتركة
└── docs/                   القواعد، التصميم، والتشغيل
```

## التشغيل محلياً

**المتطلبات:** Node.js 24 أو أحدث، PostgreSQL 16 أو أحدث، و npm.

```bash
git clone https://github.com/eyadEbraheem/wathiq.git
cd wathiq
npm install                      # يبني packages/shared ويولّد Prisma Client

cp backend/.env.example backend/.env     # ثم عدّل DATABASE_URL والأسرار
cp frontend/.env.example frontend/.env.local

cd backend
npx prisma migrate deploy        # إنشاء الجداول
npm run db:seed                  # الأقسام، المواضيع، الحساب الرسمي، والمدير
cd ..

npm run dev:api                  # http://localhost:3000/api/v1  و /api/docs
npm run dev:web                  # http://localhost:3001
```

بيانات تجريبية: `SEED_DEMO=true` لحسابات تجريبية قليلة، أو `SEED_SHOWCASE=true` لمنصة كاملة بالصور للعرض المحلي
(كلمة السر من `DEMO_PASSWORD`). الدليل الكامل خطوة بخطوة، مع تشغيل التطبيق على هاتف حقيقي:
[`docs/RUN-LOCALLY.md`](docs/RUN-LOCALLY.md).

## تشغيل كل جزء لوحده

كل جزء يعمل من مجلده. أول `npm install` يثبّت المكتبات ويبني `packages/shared` ويولّد Prisma Client.

**Backend (NestJS):**

```bash
cd backend
npm install
npx prisma migrate deploy        # إنشاء الجداول
npm run db:seed                  # الأقسام والمدير والبيانات التجريبية الكاملة
npm run start:dev                # http://localhost:3000/api/v1
```

**البيانات التجريبية الكاملة:** ملف `backend/.env.example` يفعّل `SEED_DEMO` و `SEED_SHOWCASE` افتراضياً، فيكفي وضع
`DEMO_PASSWORD=Wathiq2026!` (كلمة سر [الحسابات التجريبية](#الحسابات-التجريبية)) قبل `npm run db:seed`. ينشئ ذلك 20 جمعية و5 أفراد
موثّقين و260 متطوعاً وحوالي 150 حملة بصورها مع طلبات التطوع والشارات والتقييمات وأرقام الأثر، فتظهر الإحصائيات
ولوحة الإدارة ممتلئة. أول تشغيل يحتاج إنترنت لتنزيل حوالي 100 صورة.

**Frontend (Next.js):**

```bash
cd frontend
npm install
npm run dev                      # http://localhost:3001
```

**Mobile (Expo / React Native):**

```bash
cd mobile
npm install
npx expo start                   # امسح رمز QR بتطبيق Expo Go، أو اضغط a لمحاكي Android
```

على هاتف حقيقي ضع عنوان IP الجهاز على الشبكة في `mobile/.env` بدل `localhost`.

## متغيرات البيئة

كل متغير موثّق في ملفات `.env.example`، والأسرار لا تُرفع أبداً.

| الملف | أهم المتغيرات |
|---|---|
| `backend/.env` | `DATABASE_URL`، `JWT_ACCESS_SECRET`، `OTP_SECRET`، `FRONTEND_URL`، `API_PUBLIC_URL`، `STORAGE_LOCAL_DIR`، `STORAGE_SIGNING_SECRET`، `EMAIL_PROVIDER`، `ADMIN_EMAIL` / `ADMIN_PASSWORD`، `CV_SIGNING_PRIVATE_KEY`، `PUSH_ENABLED` |
| `frontend/.env.local` | `API_URL`، `PUBLIC_WEB_URL` |
| `mobile/.env` | `EXPO_PUBLIC_API_URL`، `EXPO_PUBLIC_WEB_URL`، `EXPO_PUBLIC_CV_SIGNING_PUBLIC_KEY`، `EXPO_PUBLIC_EAS_PROJECT_ID` |

رسائل التحقق: `EMAIL_PROVIDER=console` يطبع الرمز في سجل الخادم أثناء التطوير، و `gmail` أو `brevo` للإرسال
الفعلي. قناة الرسائل النصية متوقفة (`OTP_SMS_ENABLED=false`) حتى اعتماد مزوّد.

## الأوامر

| الأمر (من جذر المستودع) | الوظيفة |
|---|---|
| `npm run dev:api` | تشغيل الخادم مع إعادة التحميل |
| `npm run dev:web` | تشغيل موقع الويب |
| `npm run dev:mobile` | تشغيل Expo للتطبيق |
| `npm run build` | بناء المشترك ثم الخادم ثم الويب |
| `npm run lint` | فحص الكود في كل المشاريع |
| `npm run format` | تنسيق الكود بـ Prettier |
| `npm run test -w api` / `npm run test:e2e -w api` | اختبارات الوحدة / اختبارات e2e |
| `npm run typecheck -w mobile` / `npm test -w mobile` | فحص أنواع التطبيق واختباراته |

## الواجهة البرمجية

- **Swagger:** `http://localhost:3000/api/docs`، مع زر Authorize لتجربة المسارات المحمية (Bearer token).
- **Postman:** [`docs/postman/wathiq.postman_collection.json`](docs/postman/wathiq.postman_collection.json)
  (Collection v2.1، 137 طلباً مع أمثلة). المتغيرات: `{{baseUrl}}` (افتراضياً `http://localhost:3000`) و
  `{{accessToken}}` الذي يُنسخ من رد `POST /auth/login`.
- كل المسارات تبدأ بـ `/api/v1`. حدود الطلبات لكل عنوان IP، وأقسى على مسارات المصادقة.

| المجال | أهم المسارات |
|---|---|
| المصادقة | `POST /auth/signup` · `POST /auth/signup/verify` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/password/forgot` · `POST /auth/password/reset` · `GET /auth/me` |
| المستخدمون | `GET /users/:id` · `PATCH /users/me/profile` · `PATCH /users/me/privacy` · `PUT /users/me/interests` · `POST /users/:id/follow` · `GET /users/me/following` |
| التوثيق | `POST /verification-requests` · `GET /verification-requests/me` · `POST /verification-requests/:id/approve` · `POST /verification-requests/:id/reject` |
| الأقسام والمنشورات | `GET /sections` · `GET /posts` · `POST /posts` · `PATCH /posts/:id` · `DELETE /posts/:id` · `POST /posts/:id/upvote` · `GET /users/me/posts` |
| التعليقات | `GET /posts/:id/comments` · `POST /posts/:id/comments` · `DELETE /comments/:id` |
| الفعاليات | `GET /events` · `POST /events` · `PATCH /events/:id` · `POST /events/:id/close` · `POST /events/:id/cancel` · `POST /events/:id/clone` |
| طلبات التطوع | `POST /events/:id/applications` · `GET /events/:id/applications` · `POST /event-applications/:id/accept` · `POST /event-applications/:id/reject` · `POST /event-applications/:id/withdraw` |
| الأثر والتقييم والشارات | `POST /events/:id/documentation` · `PUT /ratings` · `POST /badges` · `POST /badges/:id/approve` · `GET /badges/verify/:code` |
| الفرق والتعاون | `POST /team-memberships` · `POST /posts/:id/collaborations` · `POST /publish-requests` |
| الإشعارات | `GET /notifications` · `GET /notifications/unread-count` · `POST /notifications/read-all` · `POST /push-devices` |
| البحث والدليل | `GET /search/accounts` · `GET /search/people` · `GET /search/directory` · `GET /highlights/current` |
| السيرة التطوعية | `GET /users/me/cv` · `GET /users/me/cv/pdf` · `POST /users/me/cv/share` · `GET /cv/public/:token` |
| الإدارة والإحصائيات | `GET /admin/reports` · `POST /admin/posts/:id/hide` · `POST /admin/users/:id/suspend` · `GET /admin/stats` · `GET /users/me/stats` |
| الملفات | `POST /uploads/images` · `GET /files/public/:key` · `GET /files/private/:key` |

## الاختبارات

- **الخادم:** اختبارات وحدة واختبارات e2e على قاعدة بيانات منفصلة اسمها ينتهي بـ `_test` (في `backend/.env.test`).
  بعد أي migration جديدة تُطبَّق عليها أيضاً: `DATABASE_URL=<test url> npx prisma migrate deploy`.
- **الموبايل:** فحص الأنواع، اختبارات عميل الاتصال، وبناء حزمتي Android و iOS بـ `expo export`.

## الحسابات التجريبية

تُنشأ تلقائياً بسكربت الـ seed: ضع `DEMO_PASSWORD=Wathiq2026!` في `backend/.env` ثم شغّل `npm run db:seed` من `backend/`.
كلها تشترك بنفس كلمة السر.

| الحساب | البريد | كلمة السر |
|---|---|---|
| مدير المنصة | `demo-admin@wathiq.local` | `Wathiq2026!` |
| جمعية موثّقة | `demo-hope@wathiq.local` | `Wathiq2026!` |
| فريق موثّق | `demo-green@wathiq.local` | `Wathiq2026!` |
| متطوع | `demo-volunteer@wathiq.local` | `Wathiq2026!` |
| جمعية بإحصائيات كاملة | `showcase-org-01@wathiq.local` … `showcase-org-20@wathiq.local` | `Wathiq2026!` |
| فرد موثّق | `showcase-ind-1@wathiq.local` … `showcase-ind-5@wathiq.local` | `Wathiq2026!` |
| متطوع بسيرة وشارات | `showcase-v001@wathiq.local` … `showcase-v260@wathiq.local` | `Wathiq2026!` |

## رابط العرض وتطبيق الموبايل

- **Demo URL:** يُضاف قريباً
- **Mobile (APK / Expo):** يُضاف قريباً

## القيود الحالية

- التحقق عبر الرسائل النصية (SMS) غير مفعّل بعد، والتسجيل يتم بالبريد الإلكتروني.
- الملفات تُخزَّن محلياً على الخادم، ولا يوجد تخزين سحابي بعد.
- إشعارات الهاتف (Push) تحتاج `PUSH_ENABLED=true` ومعرّف مشروع EAS حتى تصل فعلياً.
- الواجهة باللغة العربية فقط.
- لا يوجد دفع أو تبرعات داخل المنصة.

## الفريق وتقسيم العمل

| العضو | الدور | المسؤوليات |
|---|---|---|
| **إياد** · [`@eyadEbraheem`](https://github.com/eyadEbraheem) | Backend | هيكل المشروع والإعدادات، المصادقة والتسجيل وOTP، المستخدمون والخصوصية، التوثيق وتخزين الملفات، الإشعارات والدفع، التقييمات وأرقام الجهات، جمعية الأسبوع، البحث، السيرة التطوعية (PDF، الرابط، التوقيع) |
| **علي** · [`@alimk12`](https://github.com/alimk12) | Backend | مخطط قاعدة البيانات والـ migrations، المنشورات والتعليقات والإشراف، الفعاليات والأدوار والتوثيق والشارات، المتابعة والفرق والتعاون وطلبات النشر، الإحصائيات، منشوراتي، بيانات العرض |
| **حسان** · [`@hassan-developer-7`](https://github.com/hassan-developer-7) | Frontend (Web) | موقع Next.js كاملاً: الصفحات، المكوّنات، الجلسة، Server Actions، لوحة الإدارة والإحصائيات |
| **محمد** · [`@Mohammad-Kashmar135`](https://github.com/Mohammad-Kashmar135) | UI/UX · Mobile | تصميم الويب والموبايل وألوان الهوية، وتطبيق الموبايل كاملاً بـ Expo |

## طريقة العمل

- الفرع `main` محمي، والعمل على فروع `feature/<name>` أو `fix/<name>` يُدمج عبر Pull Request.
- تغيير منطقي واحد في كل commit برسالة واضحة.
- قواعد الكود والمنتج كاملة في [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)، والتصميم المرجعي في
  [`docs/design/`](docs/design).
