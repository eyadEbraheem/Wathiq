# نشر واثق على الإنترنت (مجاناً)

هالدليل بينشر المشروع على خطط مجانية:

| الجزء | وين | شو بيعمل |
|---|---|---|
| قاعدة البيانات والملفات | **Supabase** | PostgreSQL، وتخزين متوافق مع S3 (قرص Render بينمسح مع كل نشر). مجاني بدون بطاقة |
| الـ API | **Render** | `render.yaml` بجذر الريبو |
| الموقع | **Vercel** | مشروع Next.js من مجلد `web` |
| تطبيق الموبايل | **EAS Build** (Expo) | بيتصل بنفس الـ API (آخر الدليل) |

امشي بالخطوات **بالترتيب**: كل خطوة بتعطيك قيمة بتحتاجها الخطوة يلي بعدها.
ما في ولا مفتاح سري بالريبو: كل القيم بتنحط بلوحة تحكم كل منصة.

> البرانش يلي بتنشر منه بتختاره وقت تعمل الـ Blueprint على Render والمشروع على Vercel. للإطلاق الحقيقي
> الأفضل يكون `main` (بعد ما يندمج شغل الاستضافة فيه). للتجربة قبل الدمج: `feature/hosting`.

## 1. Supabase (قاعدة البيانات والملفات)

1. اعمل حساب على supabase.com (فيك تدخل بحساب GitHub) ← **New project**. سمّيه `wathiq`، واختار منطقة
   قريبة (متل Frankfurt أو Ireland)، وحط **Database Password** من حروف إنكليزي وأرقام بس، واحفظها.
2. **الملفات:** **Storage** ← **New bucket** ← `wathiq-files`. خلّيه **خاص** (لا تفعّل Public bucket):
   الملفات بتنعرض عن طريق الـ API. ما بتحتاج Policies.
3. **Storage** ← **Settings** ← **S3 Configuration**: خلّي **S3 protocol connection** مفعّل، وانسخ:
   - **Endpoint** ← `S3_ENDPOINT` (متل `https://<project>.storage.supabase.co/storage/v1/s3`)
   - **Region** ← `S3_REGION` (متل `eu-west-1`)
4. بنفس الصفحة ← **New access key**: انسخ **Access key ID** ← `S3_ACCESS_KEY_ID` و **Secret access key**
   ← `S3_SECRET_ACCESS_KEY`. **السر بيبين مرة وحدة بس.**
5. **قاعدة البيانات:** زر **Connect** فوق ← تبويب **Direct** ← Type `URI`، Method **Session pooler**.
   انسخ الرابط وبدّل `[YOUR-PASSWORD]` (مع الأقواس) بكلمة سر القاعدة. هاد `DATABASE_URL`.
   - لازم البورت يكون **5432** (مو 6543: الـ migrations ما بتشتغل على Transaction pooler).
   - لازم الـ host يكون `...pooler.supabase.com` (الـ Direct connection غالباً IPv6 بس، و Render ما بيوصلّه).

ولا وحدة من هالقيم بتنحط بالريبو: كلها بتروح على Render بالخطوة 3.

## 2. مفتاح توقيع نسخة السيرة (مرة وحدة بس)

على جهازك:

```powershell
node -e "console.log(require('crypto').generateKeyPairSync('ed25519').privateKey.export({format:'der',type:'pkcs8'}).toString('base64'))"
```

هاد `CV_SIGNING_PRIVATE_KEY`. احفظه بمكان آمن، و**لا تغيّره أبداً بعد الإطلاق**: كل QR سيرة مطبوع
بيتحقق فيه التطبيق بدون إنترنت.

## 3. Render (الـ API)

1. اعمل حساب على Render واربطه بـ GitHub (لازم يشوف الريبو `Wathiq`).
2. **New** ← **Blueprint** ← اختار الريبو **والبرانش** (`feature/hosting` للتجربة، أو `main` بعد الدمج).
   Render بيقرأ `render.yaml` وبيعرض خدمة `wathiq-api` (Node، مجانية، فرانكفورت).
3. بيطلب منك القيم يلي ما إلها قيمة جاهزة (`sync: false`):

| المتغيّر | شو تحط |
|---|---|
| `FRONTEND_URL` | عنوان الموقع على Vercel، متل `https://wathiq.vercel.app`. إذا لسا ما بتعرفه، حط أي قيمة وعدّلها بعد خطوة Vercel |
| `DATABASE_URL` | رابط Session pooler من الخطوة 1 (مع كلمة السر، بدون أقواس) |
| `S3_ENDPOINT`، `S3_REGION`، `S3_ACCESS_KEY_ID`، `S3_SECRET_ACCESS_KEY` | من الخطوة 1 |
| `S3_BUCKET` | `wathiq-files` |
| `ADMIN_EMAIL` | إيميل الأدمن الأول |
| `ADMIN_PASSWORD` | كلمة سر الأدمن، **12 حرف عالأقل** (بتنستعمل مرة وحدة وقت إنشاء الحساب) |
| `OFFICIAL_ACCOUNT_EMAIL` | إيميل حساب واثق الرسمي (إيميل حقيقي إذا بدك تعمل إعادة تعيين كلمة سر إله) |
| `EMAIL_PROVIDER` | `brevo` أو `gmail` لإرسال الأكواد، أو `console` للتجربة (الكود بيطلع بالـ Logs بس) |
| `GMAIL_USER`، `GMAIL_APP_PASSWORD` | إذا اخترت `gmail` |
| `BREVO_API_KEY`، `EMAIL_FROM_ADDRESS` | إذا اخترت `brevo` |
| `CV_SIGNING_PRIVATE_KEY` | من الخطوة 2 |

   القيم الفاضية يلي ما بتلزمك (متل Gmail إذا اخترت Brevo) خلّيها فاضية.
4. **Apply**. أول نشر بياخد كم دقيقة: بيبني، بيطبّق الـ migrations، بيشغّل الـ seed (الأقسام،
   المواضيع، الحساب الرسمي، الأدمن)، وبيشغّل الـ API.
5. تأكد: افتح `https://<اسم-الخدمة>.onrender.com/api/v1/health` لازم يرجع `{"status":"ok"}`،
   و `/docs` بيفتح Swagger.
6. من صفحة الخدمة ← **Environment**، انسخ قيمة **`WEB_PROXY_SECRET`** (Render عملها). بتحتاجها بـ Vercel.

## 4. Vercel (الموقع)

1. اعمل حساب على Vercel واربطه بـ GitHub.
2. **Add New** ← **Project** ← اختار الريبو.
3. **Root Directory**: `web`. Vercel بيتعرّف على Next.js وعلى الـ workspaces لحاله.
4. **Environment Variables**:

| المتغيّر | القيمة |
|---|---|
| `API_URL` | `https://<اسم-الخدمة>.onrender.com/api/v1` |
| `PUBLIC_WEB_URL` | عنوان المشروع على Vercel، متل `https://wathiq.vercel.app` |
| `WEB_PROXY_SECRET` | **نفس** القيمة يلي نسختها من Render |
| `PUPPETEER_SKIP_DOWNLOAD` | `true`. الموقع ما بيحتاج Chrome (الـ PDF بيعمله الـ API)، فهيك البناء أسرع بـ ~170MB |

5. **Deploy**. بعد ما يخلص، خود عنوان الموقع.
6. ارجع لـ Render ← **Environment** ← حط العنوان بـ `FRONTEND_URL` (بدون `/` بالآخر) واحفظ.
   Render بيعيد التشغيل لحاله.

## 5. أول تجربة

- افتح الموقع، وسجّل دخول بـ `ADMIN_EMAIL` و `ADMIN_PASSWORD`.
- سجّل حساب جديد: الكود بيوصل عالإيميل (أو بيطلع بـ **Logs** تبع Render إذا `EMAIL_PROVIDER=console`).
- انشر منشور بصورة، وتأكد إنها بتبين. وبـ Supabase ← Storage ← `wathiq-files` لازم تشوف ملف جديد.

## 6. الموبايل

بـ `mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://<اسم-الخدمة>.onrender.com/api/v1
```

وبعدين بتبني نسخة بـ EAS Build (APK للأندرويد). خطوات Expo بـ `docs/MOBILE-TODO.md`.

## حدود الخطة المجانية (لازم تعرفها)

| الشغلة | شو بيصير | الحل لما يكبر المشروع |
|---|---|---|
| **Render بينام** | بعد ~15 دقيقة بدون طلبات، وأول طلب بعدها بياخد حوالي دقيقة. التطبيق ممكن يطلّع "انتهت المهلة" مرة | خطة مدفوعة للخدمة |
| **المهام بالخلفية** | إرسال إشعارات الموبايل وتنبيه الأدمن عن الفعاليات غير الموثّقة ما بيشتغلوا وهو نايم، وبيكمّلوا لما يصحى | نفس الشي |
| **Supabase بيوقّف المشروع** | المشروع المجاني بيتوقّف مؤقتاً إذا ما في أي استعمال لحوالي أسبوع (البيانات ما بتضيع). وقتها الـ API بيفشل يوصل للقاعدة | **Restore project** من لوحة Supabase، أو خطة مدفوعة |
| **حجم Supabase المجاني** | حوالي 500 MB للقاعدة و 1 GB للملفات | الصور بتتصغّر قبل الرفع فبتوفّر كتير. لما يقرب، خطة مدفوعة |
| **حجم الطلب على Vercel** | حوالي 4.5 MB لكل إرسال فورم | الموقع بيصغّر الصور لحاله قبل الإرسال (`ImageShrinker`). بس فورم فيه صور كتير جداً (متل 20 صورة توثيق) أو ملفات PDF كبيرة ممكن يتجاوز الحد: ابعتها على دفعات |
| **ملف PDF للسيرة** | الـ API بيشغّل Chrome (`puppeteer`) أول مرة حدا بيطلب PDF، وبياخد 100–200MB من ذاكرة الخطة المجانية (512MB). إذا Render وقّف الخدمة لأنها تجاوزت الذاكرة، أو طلع خطأ بأول PDF (مكتبات نظام ناقصة لـ Chrome)، باقي الـ API بيضل شغّال | خطة بذاكرة أكبر، أو زر الطباعة بالمتصفح |
| **Gmail من Render** | بعض الاستضافات المجانية بتسكّر منافذ SMTP، فممكن ما يوصل إيميل | جرّب تسجيل حساب بعد النشر. إذا ما وصل الكود، استعمل `brevo` (بيبعت عن طريق HTTPS) |

## مشاكل شائعة

| شو بيطلع | السبب والحل |
|---|---|
| الموقع بيفتح بس كل شي فاضي، أو تسجيل الدخول ما بيمشي | `API_URL` غلط بـ Vercel، أو الـ API نايم (استنى دقيقة وجرّب) |
| `CORS` بـ console المتصفح | `FRONTEND_URL` على Render مو نفس عنوان الموقع بالزبط (بدون `/` بالآخر) |
| الصور ما بتنرفع، وبـ Logs تبع Render `S3 upload ... failed (403)` | مفاتيح S3 غلط، أو `S3_REGION` مو نفسها يلي بصفحة S3 Configuration، أو اسم الـ bucket غلط |
| `P1001: Can't reach database server` بالـ Logs | رابط القاعدة مو Session pooler (البورت 5432 و `pooler.supabase.com`)، أو مشروع Supabase متوقّف |
| `P1000: Authentication failed` | كلمة سر القاعدة غلط بالرابط، أو ضلّت الأقواس `[ ]` |
| "تحميل PDF" بيفشل، وبالـ Logs `Could not find Chrome` | `PUPPETEER_CACHE_DIR` لازم يكون موجود بـ Render **قبل** البناء (هو بـ `render.yaml`). بعد ما تضيفه: **Manual Deploy** ← **Clear build cache & deploy** |
| `Seed failed: check ADMIN_EMAIL and ADMIN_PASSWORD` بالـ Logs | كلمة سر الأدمن أقصر من 12 حرف. صلّحها، والـ API بيشتغل عادي حتى لو فشل الـ seed |
| ناس كتير بيطلعلن "Too many requests" مع بعض | `WEB_PROXY_SECRET` مو نفسه على Render و Vercel |
| QR السيرة بيفتح على `localhost` | `PUBLIC_WEB_URL` ناقص على Vercel |
