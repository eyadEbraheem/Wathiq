# Project Rules

Conventions for this project, derived from the B4F Board bootcamp codebase with its teaching-only
parts removed. This is a fresh project: PostgreSQL + Prisma from day one, strict TypeScript, no
legacy migrations.

**Stay on the bootcamp stack.** Use the tools and versions of the B4F Board bootcamp repo
(listed in the README, "Tech stack"). Anything outside it (a new package, tool, major version
or convention) is agreed by the team first, and is then documented in
`docs/OUTSIDE-BOOTCAMP.md` (why it was needed and how it was done) in the same commit.

## Architecture

- The product is a website first, followed by a **mobile app built with React Native (Expo)**
  that uses the same backend. Every decision must keep the backend client-agnostic.
- Independent apps in one repo:
  - `backend/`: NestJS
  - `frontend/`: Next.js App Router
  - `mobile/`: React Native, added later
  - `packages/shared/`: shared TypeScript types and constants used by web and mobile
- `backend/` owns business rules, validation, auth, permissions and data access.
- `frontend/` and `mobile/` own UI and interaction only. They never talk to the database directly.
- Secrets live in `.env` (git-ignored). Every variable is listed in `.env.example`.

### Mobile-ready backend rules

These apply from day one so the mobile app needs no backend rewrite:

- **The API is the only source of business logic.** Next.js Server Actions only forward to the
  API. They never contain rules that mobile would have to duplicate.
- **Auth is a Bearer token in the `Authorization` header.** The backend never relies on cookies.
  The web keeps the token in an httpOnly cookie on the Next server; mobile keeps it in
  `expo-secure-store`. Both send the same header.
- **Use access + refresh tokens.** A short-lived access token plus a refresh endpoint
  (`POST /auth/refresh`), because mobile users stay signed in for weeks.
- **Version the API.** All routes live under `/api/v1` so old app versions keep working after
  changes.
- **Use one consistent error shape.** `{ statusCode, message, error }` everywhere, so both
  clients parse errors the same way.
- **Paginate every list endpoint.** `?page=&limit=` (or cursor), with `{ data, meta }`. Mobile
  lists must never load everything at once.
- **Upload files through the API.** Store files in object storage and return URLs. Never return
  file paths that only work on the web server.
- **Use ISO 8601 UTC for all dates.** Clients format them for display.
- **Keep shared types and enums in one place.** They live in `packages/shared` and are imported
  by both clients, never redefined per app.
- **Return translatable messages.** Error and validation messages must be translatable later.
  The UI supports Arabic (RTL) and English.

## Git

- `main` is protected. No direct pushes.
- Work happens on feature branches (`feature/<short-name>`, `fix/<short-name>`) merged via PR.
- One logical change per commit, with a clear imperative message.

---

## Backend (`backend/`, NestJS + Prisma + PostgreSQL)

### Structure

```
src/
  main.ts
  app.module.ts
  prisma/            PrismaModule (@Global) + PrismaService
  common/
    filters/         AllExceptionsFilter
    guards/          JwtAuthGuard, RoleGuard, ...
    decorators/      CurrentUser, RequireRole, ...
    types/           express-request.d.ts
    utils/
  <resource>/
    <resource>.module.ts
    <resource>.controller.ts
    <resource>.service.ts
    dto/
      create-<resource>.dto.ts
      update-<resource>.dto.ts
      find-<resource>-query.dto.ts
```

### Bootstrap (`main.ts`)

- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` globally.
- `AllExceptionsFilter` globally: `HttpException` passes through, anything else is logged and
  returned as a generic 500 (no internals leaked).
- CORS limited to `FRONTEND_URL`, `credentials: true`.
- Swagger at `/api/docs` with `addBearerAuth()`.
- `ConfigModule.forRoot({ isGlobal: true })`; read secrets with `config.getOrThrow()`.

### Controllers

- Thin: parse input, call the service, return the result. No business logic.
- Every route has `@ApiOperation` and `@ApiResponse` for each realistic status (2xx, 400, 401,
  403, 404, 409).
- Numeric params use `ParseIntPipe`.
- Protected routes use `@ApiBearerAuth()` + `@UseGuards(JwtAuthGuard, ...)`.
- Get the caller with `@CurrentUser()`. Never trust a user id sent in the body.

### Services

- All business logic lives here.
- Each service has `private readonly logger = new Logger(XService.name)` and logs create, update
  and delete operations.
- `findOne(id)` throws `NotFoundException` with a clear message
  (`No project found with id 5.`). `update` and `remove` call it first.
- Partial updates only touch the fields that were sent:
  `...(dto.name !== undefined ? { name: dto.name } : {})`.
- Uniqueness is checked before writing (`ConflictException`). Prisma `P2002` errors are also
  caught and converted to `409` as a race-condition backstop.
- Multi-step business rules run inside `prisma.$transaction(async (tx) => ...)`.
- Side effects (activity log, notifications) accept an optional `tx?: Prisma.TransactionClient`
  so they are saved in the same transaction as the event they describe.

### Errors

Use Nest's built-in exceptions with a human-readable message:

| Situation | Exception |
|---|---|
| Invalid state transition / rule violation | `BadRequestException` |
| Missing or invalid token | `UnauthorizedException` |
| Authenticated but not allowed | `ForbiddenException` |
| Resource not found | `NotFoundException` |
| Duplicate / conflicting state | `ConflictException` |

### DTOs

- `class-validator` on every field, plus `@ApiProperty` / `@ApiPropertyOptional` with an
  `example`.
- Trim strings: `@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))`.
- Emails are also lower-cased.
- `UpdateXDto extends PartialType(CreateXDto)` (from `@nestjs/swagger`).
- Filtering and search use a dedicated `FindXQueryDto`.
- Enum fields use `@IsEnum(PrismaEnum)`.

### Auth and permissions

- Passwords hashed with bcrypt (10 salt rounds). The hash is never returned: services expose
  users through `toSafeUser()`.
- The JWT payload is `{ sub: userId, email }`. The access token is short-lived (~15 min). The
  refresh token is long-lived, stored hashed in the DB, rotated on every refresh, and revocable
  on logout.
- Login failures always return the same message (`Invalid email or password.`).
- `JwtAuthGuard` reads `Authorization: Bearer <token>` and sets `request.user`.
- Role checks use a guard plus a metadata decorator (e.g. `@RequireRole(['admin', 'owner'])`),
  never ad-hoc `if` checks scattered across controllers.

### Prisma

- One initial migration from a clean schema. Every later change is a new named migration
  (`npx prisma migrate dev --name <what-changed>`).
- Models are PascalCase singular. Tables are mapped to plural snake_case (`@@map("users")`).
- Fields are camelCase. Columns are mapped to snake_case (`@map("created_at")`).
- Fixed value sets (status, priority, role, ...) are Prisma `enum`s, not plain strings.
- Every model has `id Int @id @default(autoincrement())` and `createdAt`.
- Choose `onDelete` deliberately for every relation (`Cascade`, `SetNull`, `Restrict`).
- `prisma/seed.ts` provides realistic demo data.

### Tooling

- `tsconfig`: `strict: true`.
- Prettier with `singleQuote: true`, `trailingComma: "all"`; ESLint with
  `@typescript-eslint` + `prettier`.
- Imports use the `src/...` path.

---

## Frontend (`frontend/`, Next.js App Router + TypeScript + Tailwind)

### Structure

```
src/
  app/
    (auth)/login, (auth)/register
    (app)/layout.tsx        session check + /auth/me + StoreProvider
    (app)/<feature>/...
  components/
    ui/                     Button, Card, Badge, Input, ...
    layout/
    <feature>/
  lib/
    api.ts                  apiFetch()
    session.ts              cookie helpers (server-only)
    types.ts                shared API types
    actions/<feature>.ts    Server Actions
  store/                    Redux (current user only)
```

### Data fetching

- Server Components by default. Pages fetch data on the server with `apiFetch`.
- Client Components (`"use client"`) only where interaction is needed, in their own files next to
  the page (`LoginForm.tsx` beside `page.tsx`).
- The backend filters data. The frontend never fetches everything and filters it locally.
- If a request is not `ok`, call `notFound()` or show an error. Never render broken data.

### API and session

- All backend calls go through `apiFetch(path, { token })` in `lib/api.ts`. On `401` it clears
  the session and redirects to `/login`.
- The JWT is stored only in an `httpOnly`, `sameSite: "lax"`, `secure`-in-production cookie
  (`lib/session.ts`, `import "server-only"`). It never reaches client JavaScript.
- `requireSessionToken()` protects every server page and action that needs auth.

### Mutations

- All mutations are Server Actions in `lib/actions/*.ts` (`"use server"`).
- Pattern: `requireSessionToken()`, then light validation, then `apiFetch`, then either return
  `{ error }` or `revalidatePath()` + `redirect()`.
- Map known API statuses to friendly messages (e.g. `409` → "already exists").
- Forms use `useActionState` and show the `pending` state and `state.error`.

### Route files

Every important route segment has `loading.tsx`, `error.tsx` and `not-found.tsx`, all styled to
match the app.

### State

- Redux Toolkit holds the current user only (for Client Components such as the navbar).
- Server data (lists, details) is never copied into Redux. It is fetched fresh from the server.

### Types

- Shared API types live in `lib/types.ts`. Dates from the API are typed as `string`.

### Styling

- **The design is fixed:** the web copies `docs/design/reference-web.html` and the mobile app
  copies `docs/design/reference-mobile.html`, exactly (look only; features come from the
  Domain rules below). Fonts: Tajawal + Cairo via `next/font`. Tokens: `packages/shared/src/theme.ts`.

- Tailwind with `darkMode: "class"`. Every color has a `dark:` counterpart.
- Reusable primitives live in `components/ui`. No duplicated button or input styles across pages.
- Imports use the `@/` alias.

---

## Domain rules (product decisions)

The schema lives in `backend/prisma/schema.prisma`. These rules are enforced in services, inside
transactions where they span several writes.

### Accounts
- Sign-up: name, birth date, ONE of email or phone, password, then an OTP code. Users must be
  **13+** (age is always computed from `birthDate`).
- Sign-up can also be **as an organization**: the name is the organization's and `birthDate`
  is its founding date (no age rule, not in the future). The account is created with
  `pendingOrganization = true` and is **frozen**: it can browse (every GET), edit its own
  account and settings, read its notifications and send its verification request, nothing
  else (`JwtAuthGuard` refuses other writes with 403; allowed routes carry
  `@AllowWhilePending()`). It can only request ORGANIZATION verification. Approval clears the
  flag; after a rejection it stays frozen and may send a new request.
- **No unverified contact is ever stored on a user.** Sign-up data waits in `PendingSignup` and
  the `User` row is created only after the OTP is confirmed. Adding an email or phone later from
  settings works the same way: the code goes to `OtpCode.target`, and the user's field is set
  only after confirmation. Several pending sign-ups for the same contact may coexist, so nobody
  can block someone else's email or phone.
- Login: email or phone, plus password.
- After sign-up, an onboarding wizard asks for: section + topic interests (required), then
  address, education, work field (free text) and team memberships (skippable).
- The user picks one **primary section** (`primarySectionId`) among their interests and can
  change it later.
- Account deletion (required by the app stores): soft delete. Set `deletedAt`, replace the name
  with a "deleted account" label, clear email, phone, password, profile fields and avatar,
  revoke refresh tokens and remove push devices. Posts, events, comments and badges stay, shown
  under "deleted account". Users are never hard-deleted.
- Profile visibility: address, age (never the full birth date), education, work field and teams
  each have a show/hide switch. All are hidden by default except teams. For users under 18 these
  fields are always hidden. The same settings apply when an event organizer reviews applicants.
- Account types: regular, or verified (`ORGANIZATION` / `INDIVIDUAL`, same publishing
  permissions), plus the `isPartner` flag. One login per organization.
- An organization is not a person: it does not volunteer (no event applications, so no badges,
  volunteer hours or CV) and does not join teams. Its account shows what it runs instead
  (events, applicants, publish requests, membership requests, members, specialties, impact).
  Personal fields (age, education, work field) do not apply to it; its interests are the
  sections it works in. A verified individual stays a person and keeps everything a volunteer has.
- For a verified organization, `birthDate` holds the organization's **founding date**. It is
  required in the ORGANIZATION verification request and copied onto the account on approval.
  Age-based rules (under-18 hiding, event minimum age) never apply to organizations.
- The platform has exactly one **official account** (`isOfficial = true`), a verified
  organization owned by the app owner. It publishes platform requests attributed to the platform.
- Verification is never revoked. Admins use `isSuspended` when needed.

### Verification
- Only platform admins review requests. A user may have one PENDING request at a time and may
  reapply after a rejection.
- ID / passport files live in private storage, viewable by admins through signed URLs only, and
  are deleted after the decision.
- An ORGANIZATION request also includes every paper of `ORGANIZATION_PAPERS`
  (`packages/shared`, one file per slot, stored like the ID). Which papers they are is not
  decided yet: the list has 3 slots with empty labels, shown as "الورقة 1/2/3".

### Sections and topics
- Five sections: humanitarian, environment, animal welfare, community, **education**
  (`التعليمي`). Topics are seeded; a section may have any number of topics.
- Posts in the education section may carry `OpportunityDetails` (an external scholarship,
  internship, job or competition): application deadline, eligibility text, optional age range
  and education level, field, `ONLINE` / `IN_PERSON` / `HYBRID`, location and an external apply
  link. After the deadline the opportunity shows as closed (computed, never edited by hand).
  Like `CaseDetails` in the humanitarian section, it is optional and only allowed in its section.
- A training run by an organizer is a normal **event** in the education section; its badge is
  shown as an **attendance certificate**.

### Publishing
- Post and event media are **images only** (no video).
- Only verified accounts publish posts and create events, in any section.
- A verified account has one place for everything it published ("منشوراتي ومبادراتي",
  `GET /users/me/posts`): posts and events, including what admins hid, never deleted ones;
  filters by type, event status, hidden and title, a count per tab, and for each event what
  waits for it (pending applications and badge requests).
- A regular user can send a publish request to a verified account (if it accepts requests) or to
  the platform. To an account: the account decides the attribution. To the platform: the
  requester chooses (their own name or the platform's official account).
- Humanitarian cases show contact details and a Sham Cash QR. No money passes through the
  platform. A post in the humanitarian section may also be a normal post (no `CaseDetails`).
- A publish request can be a humanitarian case: the requester attaches the contact phone, the QR
  image and a payment note. These become `CaseDetails` on approval. Case requests must target the
  humanitarian section.

### Events and badges
- Lifecycle: OPEN → CLOSED → COMPLETED, or OPEN → COMPLETED directly. Never backwards, with one
  exception: an event that was closed **automatically because it was full** reopens
  (CLOSED → OPEN) in the same transaction when an ACCEPTED participant withdraws, as long as the
  application deadline and start date have not passed. An event the creator closed by hand
  stays closed. CANCELLED is allowed from any state, at any time.
- Anyone can apply except the creator and organization accounts. The age check uses the applicant's age **on the event
  date** (`startsAt`), not on the application date.
- Capacity counts ACCEPTED applications only. When the accepted count reaches `capacity`, the
  event closes automatically (OPEN → CLOSED) in the same transaction.
- COMPLETED requires documentation (a description + photos). If it is missing after
  `documentationDueAt`, admins are notified once. No badges exist for an undocumented event.
- Badges: a participant with an ACCEPTED application requests one after COMPLETED, and the
  event creator approves it. A badge shows the section logo and links to the documentation.
- After a rejection the participant may request again: the same badge row goes back to
  REQUESTED (one row per application).
- Approved badges are **kept** if a COMPLETED event is later cancelled.

### Event roles
- Roles are optional. Each role has a name and a seat count; when an event has roles, its
  `capacity` is the sum of the role seats (kept in sync by the service).
- An applicant picks **1 to 3 roles** as ranked preferences. The organizer accepts the
  applicant into **exactly one** role (one seat), which must have a free seat.
- The organizer can move an ACCEPTED volunteer to another role that has a free seat.
- Auto-close happens when every seat is taken; a withdrawal frees the seat and follows the
  normal reopen rule.
- Badges show the volunteer's role.

### Event documentation and impact
- Documenting an event may add **impact metrics**: a label typed by the organizer plus a whole
  number (e.g. "أشجار مزروعة" 300). Labels are matched after Arabic normalization; while
  typing, the organizer is offered their own past labels.
- An organizer's profile shows totals summed per normalized label over their COMPLETED events,
  plus computed numbers (completed events, accepted volunteers).
- An organizer can **clone** an event: a new OPEN event pre-filled from an old one (details,
  roles, questions, topics); dates must be set again. Nothing else is copied.

### Organizer ratings
- Only a user whose application was ACCEPTED to a COMPLETED event can rate that event's
  organizer: one rating per application, **1 to 5 stars, no text**. Editable for 30 days after
  `documentedAt`, then locked. Ratings of an event that is later cancelled stop counting.
- The public sees only the **average and count** on the organizer (shown from 3 ratings up).
  The organizer sees who rated. The organizer never replies.
- The organizer can hide its average (`hideRating`); the public then sees "rating hidden",
  never the same thing as "no ratings yet".
- Applies to organizations and verified individuals alike.

### Search
- Users search **verified accounts only**: by name, by region (governorate / city) and by
  specialty. Region and specialty filters offer only values that exist. Matching uses
  Arabic-normalized text.
- Verified accounts add **specialties** (free text such as "تسرّب الأطفال"), matched after
  normalization and offered from existing ones while typing.
- Verified accounts search **individuals** by name, location, education, field of study and
  work field, with optional conditions "has previous volunteer work" (ACCEPTED in at least one
  COMPLETED event) and "interested in <section / topic>". A filter only matches a field the
  person made visible; under-18 optional fields are always hidden. People appear only while
  their `showInSearch` switch is on (on by default). Under-18 users appear too.

### Volunteer CV
- A user can export their own volunteer CV: approved badges (event, role, date, organizer),
  approved teams and impact. The API returns the data (`GET /users/me/cv`) and also the
  ready PDF file (`GET /users/me/cv/pdf`, A4, made on the server with Puppeteer), which the
  web and the mobile app download as is.
- The owner can share it through a secret public link (on web and mobile; off by default, a new
  link replaces the old one). Anyone can open the link without an account; personal fields
  follow the privacy settings like the public profile (all hidden under 18). Organizations
  have no CV and no link.
- The link's QR also carries a copy of that public CV signed by the API (Ed25519,
  `#o=<payload>.<signature>` after the link), so the Wathiq app can show it **without
  internet** and refuse a changed copy. The copy is dated; online, the link always shows the
  current CV. The signing key never changes after launch.

### Organization of the week
- Every finished week (Saturday 00:00 to Friday 24:00, Damascus) names the verified account
  that brought the most **first-time volunteers**: people accepted in one of its events that
  was completed and documented that week, when it was their first completed event on the
  platform. Only documented events count, so a campaign must really happen.
- At least **5** first-time volunteers, otherwise nobody is named that week. Ties go to the
  better rated campaigns of that week, then to the account that joined first. Suspended or
  deleted accounts and deleted posts do not count.
- Computed by the API on Saturday 00:05 (and on start-up for missed weeks); old weeks filled in
  later send no notifications. The winner and its followers are notified.
- Shown to everyone: a card at the top of home, an honour board page, and
  "جمعية الأسبوع × N" on the account's profile.

### Statistics
- Admins see platform statistics; every verified account sees the same report for its own
  campaigns only. Filters: period (30 days, 3 months, a year, all), governorate, section.
- The report: totals with the change from the previous window, completed campaigns per month,
  what runs most and what is asked for most per section and topic (applicants per seat, seats
  filled, upvotes), impact totals, ratings, volunteers (first time on the platform, came back
  more than once, age groups, education). Platform only: governorate numbers with people
  living there, cases and publish requests, top organizers, publish requests and cases by kind.
- "Where help is missing" compares each governorate with the whole report: many people ready
  per campaign (platform: people living there; organizer: applicants per seat, 1.5× the
  overall) means it needs campaigns; seats filled 8 points or more below the overall means it
  needs volunteers. No signal under 3 past campaigns.
- Only numbers, never names of volunteers. Groups smaller than 5 are shown as "fewer than 5".
  An organizer's report counts ages and education only of people who show them (adults).
- Each report exports its campaigns as CSV (one campaign per line, UTF-8 with BOM for Excel).

### Social
- Only verified accounts can be followed. Users also follow sections/topics (interests) for
  notifications.
- Collaboration: the post author invites any account. On acceptance the invitee is shown on the
  post and their followers are notified.
- Team membership: a person (not an organization) requests to join a verified team, and it appears on their profile only
  after the team approves. The team can remove it later.
- Home: the user's primary section (humanitarian if none), sorted by newest or most upvoted.
- Users get notified about new posts in the sections and topics they follow.
- Interaction: upvote only. Comments allow one level of replies. Comments with banned words
  (after Arabic normalization) are rejected; reported content goes to admins.
- Notifications are stored in-app and also sent as push (Expo) via a background queue.
