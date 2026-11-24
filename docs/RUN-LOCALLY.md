# تشغيل واثق على جهازك

هالدليل لأي حدا بدو يشغّل المشروع عنده: الـ API (الـ backend) والموقع، ولمطوّر الموبايل كمان.
امشي بالخطوات **بالترتيب**. الأوامر كلها لـ PowerShell على ويندوز.

## 1. شو لازم يكون عندك

| البرنامج | النسخة | كيف تتأكد |
|---|---|---|
| **Node.js** | 24 أو أحدث (معه npm 11) | `node -v` |
| **PostgreSQL** | 16 أو أحدث (منستعمل 18)، مركّب عالجهاز مباشرة بدون Docker | `psql --version` |
| **Git** | أي نسخة حديثة | `git --version` |

إذا Node أقدم من 24، `npm install` رح يعطي تحذير والمشروع ممكن ما يشتغل. نزّل نسخة 24 من nodejs.org.
وخلّي كلمة سر مستخدم `postgres` يلي حطيتها وقت تركيب PostgreSQL معك، رح تحتاجها.

## 2. تنزيل المشروع

```powershell
git clone https://github.com/eyadEbraheem/wathiq.git
cd wathiq
```

(لتقدر ترفع على الريبو لازم تنضاف كـ collaborator، وتقبل الدعوة من إيميلك أو من GitHub.)

إذا كان المشروع عندك من قبل، حدّثه:

```powershell
git checkout main
git pull
```

## 3. قاعدة البيانات

اعمل قاعدة بيانات فاضية اسمها `civil_society_hub`، من pgAdmin (Databases → Create → Database) أو من
الـ terminal:

```powershell
psql -U postgres -c "CREATE DATABASE civil_society_hub;"
```

## 4. ملفات الإعدادات (قبل `npm install`)

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

افتح `backend/.env` وعبّي:

| المتغيّر | شو تحط |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:<كلمة سر postgres>@localhost:5432/civil_society_hub?schema=public` |
| `JWT_ACCESS_SECRET`، `OTP_SECRET`، `STORAGE_SIGNING_SECRET` | كل واحد قيمة عشوائية طويلة ومختلفة (الأمر تحت) |
| `ADMIN_EMAIL`، `ADMIN_PASSWORD` | حساب الأدمن الأول (كلمة السر 12 حرف عالأقل) |
| `OFFICIAL_ACCOUNT_NAME` | `واثق` |
| `DEMO_PASSWORD` | اختياري: كلمة سر للحسابات التجريبية (8 أحرف أو أكتر)، شوف الخطوة 6 |

لتطلع قيمة عشوائية (شغّله 3 مرات، مرة لكل متغيّر):

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

خلّي الباقي متل ما هو. `frontend/.env.local` ما بدو تعديل، إلا إذا بدك تمسح رمز QR السيرة من موبايلك:
وقتها حط بـ `PUBLIC_WEB_URL` الـ IP تبع جهازك (متل `http://192.168.1.20:3001`، شوف الخطوة 10).
**ملفات `.env` ما بتنرفع على git أبداً**، وكل واحد عنده نسخته.

> إذا كلمة سر postgres فيها رموز متل `@` أو `#` أو `/`، لازم تكتبها مشفّرة بالرابط
> (`@` تصير `%40`، `#` تصير `%23`، `/` تصير `%2F`).

## 5. تنزيل الحزم

```powershell
npm install
```

بياخد دقيقة أو اتنين. بيركّب حزم كل الأقسام (`api` و `web` و `packages/shared`)، وبعدها لحاله بيبني
`packages/shared` وبيولّد كود قاعدة البيانات (Prisma Client). ما تهتم لتحذيرات `vulnerabilities`.

## 6. تجهيز الجداول والبيانات الأولى

```powershell
cd backend
npx prisma migrate deploy
npm run db:seed
cd ..
```

الـ seed بيعمل الأقسام الخمسة ومواضيعها، والكلمات الممنوعة، وحساب واثق الرسمي، وحساب الأدمن.
آخر سطر لازم يكون `Seed done: 5 sections, ...`.

**بيانات تجريبية (منصح فيها لتشوف الموقع مليان):** بعد ما تحط `DEMO_PASSWORD` بـ `backend/.env`:

```powershell
cd backend
$env:SEED_DEMO='true'; npm run db:seed; Remove-Item Env:SEED_DEMO
cd ..
```

بيضيف منظمتين موثّقتين (`demo-green@wathiq.local` و `demo-hope@wathiq.local`) ومتطوع
(`demo-volunteer@wathiq.local`) وأدمن تجريبي (`demo-admin@wathiq.local`)، كلهن بكلمة السر
`DEMO_PASSWORD`، مع منشورات وفعاليات وحالة إنسانية وفرصة.

**منصة كاملة للعرض (showcase):** إذا بدك الموقع يبين كأنو صرلو سنة ونص شغّال، مع صور حملات:

```powershell
cd backend
$env:SEED_SHOWCASE='true'; npm run db:seed; Remove-Item Env:SEED_SHOWCASE
cd ..
```

- بيعمل 20 جمعية و5 أفراد موثّقين **أساميهن مخترعة**، بكل المحافظات الـ 14، و260 متطوع، وحوالي 150
  حملة بصورها. وفيها كمان: طلبات تطوع، وشارات، وتقييمات، وأرقام أثر، ومنشورات، وحالات إنسانية، وفرص،
  وتعليقات، ورفعات، ومتابعات، وأعضاء فرق.
- أنواع الحملات مأخوذة من الشغل التطوعي يلي عم يصير بسوريا: تنظيف الأحياء والأنهار، تشجير الزيتون
  والغابات المحروقة، ترميم المدارس، سلال رمضان ودفء الشتاء، ملاجئ الحيوانات، دورات إسعاف وبرمجة.
- الحسابات: `showcase-org-01@wathiq.local` لـ `-20`، و`showcase-ind-1` لـ `-5`، و`showcase-v001` لـ
  `-v260`، كلها بكلمة السر `DEMO_PASSWORD`.
- **بدها إنترنت أول مرة:** بتنزّل حوالي 100 صورة مجانية من Unsplash (رخصة Unsplash، استعمال حر)
  لـ `backend/prisma/.showcase-images/` (حوالي 14MB، مش بـ git). وبعدين بتنسخ صورة لكل منشور بـ
  `backend/storage/` (حوالي 80MB).
- الأرقام عشوائية بس **ثابتة** (نفس البذرة كل مرة)، والتواريخ محسوبة من يوم التشغيل. بتشتغل مرة وحدة:
  إذا الحسابات موجودة بتنتجاهل. لترجع تعملها من جديد لازم تمسح الداتابيز (`npx prisma migrate reset`
  من `backend/`، **وهاد بيمسح كل شي**).
- للعرض المحلي بس، ما بتنعمل على السيرفر الحقيقي.

## 7. التشغيل

افتح **نافذتين** PowerShell بمجلد المشروع:

```powershell
npm run dev:api
```

```powershell
npm run dev:web
```

- الموقع: **http://localhost:3001**
- الـ API: `http://localhost:3000/api/v1` (جرّب `http://localhost:3000/api/v1/health`)
- توثيق الـ API (Swagger): `http://localhost:3000/api/docs`

لازم الاتنين يضلوا شغالين. أول فتحة لكل صفحة بوضع التطوير بطيئة شوي (عم تنبنى)، وبعدها بتصير أسرع.

**إذا الجهاز تقيل** (رام 8 GB أو أقل)، شغّل نسخة الإنتاج، أسرع بكتير وبتاكل رام أقل، بس أي تعديل
بالكود بدو بناء من جديد:

```powershell
npm run build
```

وبعدها بنافذتين:

```powershell
npm run start:prod -w api
```

```powershell
npm run start -w web
```

## 8. أول تجربة

- **التسجيل:** رمز التأكيد ما بيوصل عالإيميل محلياً. **بيطلع بنافذة الـ API**، بسطر فيه
  `SIGNUP code for EMAIL ...`. انسخه من هونيك. التسجيل بالهاتف مسكّر هلق، فسجّل بإيميل.
- **الأدمن:** سجّل دخول بـ `ADMIN_EMAIL` و `ADMIN_PASSWORD` يلي حطيتن.
- **الحسابات التجريبية:** إذا عملت الخطوة التجريبية، سجّل دخول بأي واحد منهن.

## 9. إذا صارت مشكلة

| شو بيطلع | السبب والحل |
|---|---|
| `Module '"@prisma/client"' has no exported member ...` أو أخطاء كتير بـ `nest build` | كود قاعدة البيانات ما انولّد. من مجلد المشروع: `npm run prisma:generate -w api` |
| `Environment variable not found: DATABASE_URL` | ملف `backend/.env` مو موجود أو اسمه غلط (لازم يكون `.env` بالزبط، مو `.env.txt`). تأكد بـ `Get-ChildItem backend -Force` |
| `P1000: Authentication failed` | كلمة سر postgres غلط بـ `DATABASE_URL` |
| `P1001: Can't reach database server` | PostgreSQL مو شغّال. افتح Services بالويندوز وشغّل `postgresql-x64-18` |
| `P1003: Database ... does not exist` | ما عملت الخطوة 3 |
| `Cannot find module '@csh/shared'` | `npm run build:shared` |
| `EADDRINUSE: address already in use :::3000` (أو 3001) | في نسخة تانية شغّالة. سكّر النوافذ القديمة، أو: `Get-NetTCPConnection -LocalPort 3000 \| % { Stop-Process -Id $_.OwningProcess }` |
| الموقع بيفتح بس كل شي فاضي أو بيرجعك عالدخول | الـ API مو شغّال، أو `frontend/.env.local` ناقص |
| `npm install` فشل بنص الطريق | احذف `node_modules` وجرّب مرة تانية: `Remove-Item -Recurse -Force node_modules; npm install` |
| بعد `git pull` صار في أخطاء | ممكن في جداول جديدة: `npm install`، وبعدين من `backend/`: `npx prisma migrate deploy` |

إذا ضلت المشكلة، ابعت **صورة للنافذة يلي فيها الخطأ** (كامل الخطأ، مو بس آخر سطر).

---

## 10. لمطوّر الموبايل

كل الـ endpoints موثّقة بـ Swagger على `/api/docs`. والتصميم بـ `docs/design/reference-mobile.html`.

### الوصول من الموبايل

الموبايل ما بيفهم `localhost` (بالنسبة إلو، `localhost` هو الموبايل نفسو). لازم تستعمل **IP جهازك على
الشبكة**:

1. الموبايل والكمبيوتر **على نفس الـ Wi-Fi**.
2. اعرف الـ IP بـ `ipconfig`، وخود `IPv4 Address` تبع الـ Wi-Fi (متل `192.168.1.20`).
3. بالتطبيق: `http://192.168.1.20:3000/api/v1`.
4. حطّ نفس العنوان بـ `API_PUBLIC_URL` بـ `backend/.env` (بدون `/api/v1`) وأعِد تشغيل الـ API. هيك روابط
   الصور بتفتح من الموبايل.
5. إذا ما وصل، غالباً جدار الحماية تبع ويندوز. اسمحله بالبورت 3000 على الشبكات الخاصة (PowerShell
   كمدير):

```powershell
New-NetFirewallRule -DisplayName "Wathiq API 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Profile Private -Action Allow
```

ملاحظة: الـ API هلق `http` مش `https`. بـ Expo Go بيمشي عادي. إذا عملت build حقيقي للأندرويد، لازم
تسمح بالـ http بالإعدادات لحد ما نرفع السيرفر.

### حساب موثّق للتجربة

لتنشر وتعمل فعاليات: استعمل `demo-green@wathiq.local`، أو سجّل حساب، ابعت طلب توثيق
(`POST /verification-requests`)، ووافق عليه كأدمن (`POST /verification-requests/:id/approve`).

### شغلات لازم يعرفها التطبيق

- **الدخول:** كل طلب محمي بيبعت `Authorization: Bearer <accessToken>`. الـ access token بيعيش 15 دقيقة.
  لما يرجع `401`، اطلب توكنات جديدة بـ `POST /auth/refresh` (الـ refresh token بيعيش 30 يوم وبيتبدّل كل
  مرة). احفظهن بـ `expo-secure-store`.
- **الأخطاء:** دايماً `{ statusCode, message, error }`.
- **القوائم:** كلها `?page=&limit=` وبترجع `{ data, meta }`.
- **التواريخ:** ISO 8601 بتوقيت UTC، والتطبيق بيعرضها بتوقيت الجهاز.
- **الصور:** ارفع أول بـ `POST /uploads/images` (صورة وحدة بكل طلب)، وبعدين ابعت الـ `key` اللي رجع
  جوّا الطلب (متل `imageKeys`).
- **الأنواع والقيم الثابتة** (الأقسام، الحالات، المحافظات...) موجودة بـ `packages/shared`، مع أسمائها
  بالعربي بـ `labels.ts`.
- **إشعارات الموبايل:** بعد الدخول ابعت رمز Expo بـ `POST /push-devices`، وعند الخروج
  `DELETE /push-devices/<الرمز>`. ليوصل إشعار حقيقي لازم `PUSH_ENABLED=true` بـ `backend/.env`. كل إشعار
  فيه `data.postId` لتفتح الصفحة الصح.

## 11. (اختياري) الاختبارات

بدها قاعدة بيانات تانية اسمها بينتهي بـ `_test` (متل `civil_society_hub_test`)، وملف `backend/.env.test`
بنفس متغيّرات `.env` بس مع رابطها و `NODE_ENV=test`. بعدين من `backend/`:
`DATABASE_URL=<رابطها> npx prisma migrate deploy`، ومن مجلد المشروع: `npm run test:e2e -w api`.
