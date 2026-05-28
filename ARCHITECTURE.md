# FitPal Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Clients                             │
│  Browser (Next.js SSR)     PWA     Mobile (future RN)       │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     Edge / CDN (Vercel)                      │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js (apps/web)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  Server  │  │  Client  │  │  API     │  │  Middleware   │ │
│  │Components│  │Components│  │  Routes  │  │  (Auth/i18n) │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘ │
└───────────────────┬─────────────────────────────────────────┘
                    │  HTTP / WebSocket
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  Hono API Server (apps/api)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  REST    │  │WebSocket │  │Middleware│  │ Background   │ │
│  │  Routes  │  │  Handlers│  │(Auth/Rate│  │  Workers     │ │
│  │          │  │          │  │ /CORS)   │  │              │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘ │
└──────┬──────────────┬──────────────┬────────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│PostgreSQL│   │  Redis   │   │MinIO/S3  │
│ (Drizzle)│   │ (Cache/  │   │(Media)   │
│          │   │  Sessions│   │          │
└──────────┘   │  /WS)    │   └──────────┘
               └──────────┘
```

---

## 1. Tech Stack

### Frontend (apps/web)

| Technology | Purpose |
|---|---|
| **Next.js 16** (App Router) | SSR, SSG, ISR, API routes |
| **React 19** | UI framework |
| **Tailwind CSS 4** | Styling |
| **shadcn/ui** | Component library (Radix primitives) |
| **TanStack Query** | Server state caching, optimistic updates |
| **React Hook Form + Zod** | Form validation |
| **Recharts** | Progress charts & analytics |
| **next-intl** | i18n (future) |
| **Vitest + Testing Library** | Unit tests |
| **Playwright** | E2E tests |

### Backend (apps/api)

| Technology | Purpose |
|---|---|
| **Hono** | HTTP framework (lightweight, fast) |
| **Bun** | Runtime & package manager |
| **Drizzle ORM** | Type-safe database queries |
| **Better Auth** | Authentication & sessions |
| **Zod** | Input validation |
| **WebSocket (Hono WS)** | Real-time workout sync, chat |
| **BullMQ / Bun Queue** | Background job processing |

### Data Layer

| Technology | Purpose |
|---|---|
| **PostgreSQL** | Primary database |
| **Redis** | Caching, sessions, rate limiting, WS pub/sub |
| **MinIO** (dev) / **S3** (prod) | Media storage |
| **Meilisearch** | Exercise & food search |

### Infrastructure

| Technology | Purpose |
|---|---|
| **Docker Compose** | Local dev environment |
| **GitHub Actions** | CI/CD |
| **Vercel** (frontend) | Next.js hosting |
| **Railway / Fly.io** (API) | Hono deployment |
| **Neon / Supabase** (DB) | Managed PostgreSQL |

---

## 2. Monorepo Structure

```
fitpal/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/
│   │   │   ├── (auth)/               # Login, register, forgot password
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   └── forgot-password/
│   │   │   ├── (dashboard)/          # Authenticated routes (layout shared)
│   │   │   │   ├── dashboard/        # Home / overview
│   │   │   │   ├── workouts/         # Workout tracking
│   │   │   │   ├── exercises/        # Exercise library
│   │   │   │   ├── programs/         # Training programs
│   │   │   │   ├── nutrition/        # Meal logging
│   │   │   │   ├── foods/            # Food database
│   │   │   │   ├── progress/         # Charts & analytics
│   │   │   │   ├── body/             # Body measurements
│   │   │   │   ├── community/        # Social feed
│   │   │   │   ├── friends/          # Friends management
│   │   │   │   ├── challenges/       # Challenges
│   │   │   │   ├── ai/               # AI coach / insights
│   │   │   │   ├── settings/         # User settings
│   │   │   │   └── profile/          # User profile
│   │   │   ├── api/                  # Next.js API routes (thin proxy)
│   │   │   │   └── webhooks/         # External webhooks
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── workouts/
│   │   │   ├── nutrition/
│   │   │   ├── progress/
│   │   │   ├── community/
│   │   │   └── shared/
│   │   ├── lib/
│   │   │   ├── api-client.ts         # Typed Hono API client (RPC)
│   │   │   ├── auth.ts               # Auth helpers
│   │   │   ├── utils.ts              # Utility functions
│   │   │   └── hooks/                # Custom React hooks
│   │   ├── store/                    # Zustand for client state (optional)
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── api/                          # Hono backend
│       ├── src/
│       │   ├── index.ts              # Server entry point
│       │   ├── app.ts                # Hono app (middleware, routes)
│       │   ├── routes/
│       │   │   ├── auth.ts           # Auth endpoints
│       │   │   ├── users.ts          # User CRUD
│       │   │   ├── workouts.ts       # Workout CRUD
│       │   │   ├── exercises.ts      # Exercise library
│       │   │   ├── programs.ts       # Training programs
│       │   │   ├── nutrition.ts      # Meal logging
│       │   │   ├── foods.ts          # Food database
│       │   │   ├── progress.ts       # Progress & analytics
│       │   │   ├── body.ts           # Body measurements
│       │   │   ├── community.ts      # Social features
│       │   │   ├── friends.ts        # Friends management
│       │   │   ├── challenges.ts     # Challenges
│       │   │   ├── ai.ts             # AI features
│       │   │   ├── webhooks.ts       # External integrations
│       │   │   └── devices.ts        # Wearable device sync
│       │   ├── db/
│       │   │   ├── index.ts          # Drizzle DB connection
│       │   │   └── migrations/       # SQL migrations (reference)
│       │   ├── services/
│       │   │   ├── auth.ts
│       │   │   ├── workout.ts
│       │   │   ├── nutrition.ts
│       │   │   ├── progress.ts
│       │   │   ├── ai.ts
│       │   │   └── notification.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts           # JWT/session verification
│       │   │   ├── rate-limit.ts     # Rate limiting (Redis)
│       │   │   └── validate.ts       # Zod validation middleware
│       │   ├── ws/
│       │   │   ├── index.ts          # WebSocket setup
│       │   │   ├── workout-sync.ts   # Live workout sync
│       │   │   └── chat.ts           # Real-time chat
│       │   └── lib/
│       │       ├── redis.ts          # Redis client
│       │       ├── s3.ts             # S3/minio client
│       │       └── search.ts         # Meilisearch client
│       ├── Dockerfile
│       ├── bun.lock
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── database/                     # Shared DB schema & migrations
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── users.ts
│   │   │   │   ├── workouts.ts
│   │   │   │   ├── exercises.ts
│   │   │   │   ├── nutrition.ts
│   │   │   │   ├── progress.ts
│   │   │   │   ├── community.ts
│   │   │   │   └── index.ts          # Re-exports all schemas
│   │   │   ├── migrations/
│   │   │   └── index.ts              # DB connection setup
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── shared/                       # Shared types & validation
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── user.ts
│   │   │   │   ├── workout.ts
│   │   │   │   ├── nutrition.ts
│   │   │   │   ├── progress.ts
│   │   │   │   └── common.ts
│   │   │   ├── schemas/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── workout.ts
│   │   │   │   ├── nutrition.ts
│   │   │   │   └── common.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── ai/                           # AI service layer
│       ├── src/
│       │   ├── index.ts
│       │   ├── clients/
│       │   │   └── llm.ts            # OpenAI / Anthropic client
│       │   ├── prompts/
│       │   │   ├── workout-plan.ts
│       │   │   ├── meal-plan.ts
│       │   │   └── insights.ts
│       │   └── utils/
│       └── tsconfig.json
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml            # Dev (PostgreSQL, Redis, MinIO, Meilisearch)
│   ├── docker-compose.prod.yml       # Production overrides
│   ├── Dockerfile.web                # Next.js container (optional)
│   └── Dockerfile.api                # Hono container
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Test, lint, typecheck
│       └── cd.yml                    # Deploy
├── turbo.json                        # TurboRepo config
├── package.json                      # Workspace root
├── .env.example
├── .dockerignore
└── ARCHITECTURE.md
```

---

## 3. Database Schema Design

### Core Entities & Relationships

```
┌───────────┐     ┌──────────────┐     ┌──────────────┐
│   Users   │1──N│  Workouts    │1──N│ WorkoutSets  │
│           │     │              │     │              │
│ id (PK)   │     │ id (PK)      │     │ id (PK)      │
│ email     │     │ user_id (FK) │     │ workout_id   │
│ name      │     │ template_id  │     │ exercise_id  │
│ avatar    │     │ started_at   │     │ set_number   │
│ password  │     │ ended_at     │     │ reps         │
│ timezone  │     │ notes        │     │ weight       │
│ units     │     │ is_completed │     │ rir          │
│ settings  │     │ source (ws/  │     │ rpe          │
│           │     │   manual/imp)│     │ duration_sec │
└─────┬─────┘     └──────────────┘     └──────────────┘
      │                                     │
      │1─N                                 N│1
      │                              ┌──────┴──────┐
      │                              │   Exercises  │
      │                              │              │
      │                              │ id (PK)      │
      │                              │ name         │
      │                              │ category     │
      │                              │ muscle_group │
      │                              │ equipment    │
      │                              │ instructions │
      │                              │ image_url    │
      │                              └─────────────┘
      │
      │1─N     ┌──────────────┐     ┌──────────────┐
      ├───────│   Meals      │1──N│  MealItems   │
      │       │              │     │              │
      │       │ id (PK)      │     │ id (PK)      │
      │       │ user_id (FK) │     │ meal_id (FK) │
      │       │ meal_type    │     │ food_id (FK) │
      │       │ eaten_at     │     │ quantity     │
      │       │ photo_url    │     │ unit         │
      │       │              │     │              │
      │       └──────────────┘     └──────┬───────┘
      │                                   │
      │1─N     ┌──────────────┐           │
      ├───────│  BodyLogs    │           │
      │       │              │           │
      │       │ id (PK)      │     ┌─────┴───────┐
      │       │ user_id (FK) │     │   Foods     │
      │       │ date         │     │             │
      │       │ weight       │     │ id (PK)     │
      │       │ body_fat_pct │     │ name        │
      │       │ chest        │     │ barcode     │
      │       │ waist        │     │ serving_size│
      │       │ hips         │     │ calories    │
      │       │ arms         │     │ protein     │
      │       │ thighs       │     │ carbs       │
      │       │ notes        │     │ fat         │
      │       └──────────────┘     │ source (DB) │
      │                            └─────────────┘
      │1─N     ┌──────────────┐
      ├───────│  Follows     │
      │       │              │
      │       │ follower_id  │
      │       │ following_id │
      │       │ created_at   │
      │       └──────────────┘
      │
      │1─N     ┌──────────────┐     ┌──────────────┐
      ├───────│ Challenges   │1──N│ChallengeParts│
      │       │              │     │              │
      │       │ id (PK)      │     │ user_id (FK) │
      │       │ creator_id   │     │ challenge_id │
      │       │ title        │     │ progress     │
      │       │ goal_type    │     │ joined_at    │
      │       │ goal_value   │     │              │
      │       │ start_date   │     └──────────────┘
      │       │ end_date     │
      │       │ is_public    │
      │       └──────────────┘
      │
      │1─N     ┌──────────────┐
      └───────│  Devices     │
              │              │
              │ id (PK)      │
              │ user_id (FK) │
              │ provider     │
              │ device_id    │
              │ access_token │
              │ last_sync_at │
              └──────────────┘
```

### PostgreSQL Tables

<details>
<summary>Click to expand schema design</summary>

**users**
- `id` UUID (PK)
- `email` TEXT UNIQUE
- `name` TEXT
- `avatar_url` TEXT
- `password_hash` TEXT
- `timezone` TEXT (default 'UTC')
- `unit_system` TEXT ('metric'/'imperial')
- `settings` JSONB
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

**workouts**
- `id` UUID (PK)
- `user_id` UUID (FK → users)
- `template_id` UUID (nullable, FK → workout_templates)
- `name` TEXT
- `notes` TEXT
- `started_at` TIMESTAMPTZ
- `ended_at` TIMESTAMPTZ
- `duration_minutes` INT (computed)
- `total_volume` DECIMAL (computed)
- `source` TEXT ('manual', 'wearable', 'imported')
- `is_completed` BOOLEAN
- `created_at` TIMESTAMPTZ

**workout_sets**
- `id` UUID (PK)
- `workout_id` UUID (FK → workouts)
- `exercise_id` UUID (FK → exercises)
- `set_number` INT
- `reps` INT
- `weight` DECIMAL
- `rir` INT (reps in reserve, nullable)
- `rpe` DECIMAL (rate of perceived exertion, nullable)
- `duration_seconds` INT (for timed exercises)
- `distance_meters` DECIMAL (for cardio)
- `is_warmup` BOOLEAN (default false)
- `notes` TEXT
- `created_at` TIMESTAMPTZ

**workout_templates**
- `id` UUID (PK)
- `user_id` UUID (FK → users)
- `name` TEXT
- `description` TEXT
- `is_public` BOOLEAN
- `estimated_duration` INT (minutes)
- `exercises` JSONB (ordered list with default sets/reps)
- `created_at` TIMESTAMPTZ

**exercises**
- `id` UUID (PK)
- `name` TEXT
- `category` TEXT ('strength', 'cardio', 'flexibility', 'plyometric')
- `muscle_group` TEXT[] ('chest', 'back', 'legs', 'arms', 'shoulders', 'core')
- `equipment` TEXT ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight')
- `instructions` TEXT[]
- `image_urls` TEXT[]
- `video_url` TEXT (nullable)
- `is_compound` BOOLEAN
- `is_custom` BOOLEAN (user-created)
- `created_by` UUID (FK → users, nullable)
- `created_at` TIMESTAMPTZ

**meals**
- `id` UUID (PK)
- `user_id` UUID (FK → users)
- `meal_type` TEXT ('breakfast', 'lunch', 'dinner', 'snack')
- `eaten_at` TIMESTAMPTZ
- `photo_url` TEXT (nullable)
- `notes` TEXT
- `created_at` TIMESTAMPTZ

**meal_items**
- `id` UUID (PK)
- `meal_id` UUID (FK → meals)
- `food_id` UUID (FK → foods)
- `quantity` DECIMAL
- `unit` TEXT ('g', 'ml', 'cup', 'tbsp', 'piece')
- `calories` DECIMAL (computed)
- `protein` DECIMAL (computed)
- `carbs` DECIMAL (computed)
- `fat` DECIMAL (computed)

**foods**
- `id` UUID (PK)
- `name` TEXT
- `barcode` TEXT (nullable, unique)
- `serving_size` DECIMAL
- `serving_unit` TEXT
- `calories_per_serving` DECIMAL
- `protein_per_serving` DECIMAL
- `carbs_per_serving` DECIMAL
- `fat_per_serving` DECIMAL
- `fiber_per_serving` DECIMAL
- `sugar_per_serving` DECIMAL
- `sodium_per_serving` DECIMAL
- `source` TEXT ('usda', 'open_food_facts', 'user')
- `created_by` UUID (FK → users, nullable)
- `created_at` TIMESTAMPTZ

**body_logs**
- `id` UUID (PK)
- `user_id` UUID (FK → users)
- `date` DATE
- `weight_kg` DECIMAL
- `body_fat_pct` DECIMAL (nullable)
- `chest_cm` DECIMAL (nullable)
- `waist_cm` DECIMAL (nullable)
- `hips_cm` DECIMAL (nullable)
- `arm_cm` DECIMAL (nullable)
- `thigh_cm` DECIMAL (nullable)
- `notes` TEXT
- `created_at` TIMESTAMPTZ

**follows**
- `follower_id` UUID (FK → users)
- `following_id` UUID (FK → users)
- `created_at` TIMESTAMPTZ
- PRIMARY KEY (follower_id, following_id)

**posts** (social feed)
- `id` UUID (PK)
- `user_id` UUID (FK → users)
- `workout_id` UUID (FK → workouts, nullable)
- `content` TEXT
- `type` TEXT ('workout_complete', 'achievement', 'update', 'photo')
- `likes_count` INT (computed)
- `comments_count` INT (computed)
- `created_at` TIMESTAMPTZ

**post_likes**
- `user_id` UUID (FK → users)
- `post_id` UUID (FK → posts)
- `created_at` TIMESTAMPTZ
- PRIMARY KEY (user_id, post_id)

**comments**
- `id` UUID (PK)
- `post_id` UUID (FK → posts)
- `user_id` UUID (FK → users)
- `content` TEXT
- `created_at` TIMESTAMPTZ

**challenges**
- `id` UUID (PK)
- `creator_id` UUID (FK → users)
- `title` TEXT
- `description` TEXT
- `goal_type` TEXT ('volume', 'frequency', 'duration', 'weight_loss')
- `goal_value` DECIMAL
- `start_date` DATE
- `end_date` DATE
- `is_public` BOOLEAN
- `created_at` TIMESTAMPTZ

**challenge_participants**
- `user_id` UUID (FK → users)
- `challenge_id` UUID (FK → challenges)
- `progress` DECIMAL (computed)
- `joined_at` TIMESTAMPTZ
- PRIMARY KEY (user_id, challenge_id)

**devices**
- `id` UUID (PK)
- `user_id` UUID (FK → users)
- `provider` TEXT ('apple_health', 'google_fit', 'fitbit', 'garmin')
- `device_id` TEXT (provider's device ID)
- `access_token` TEXT (encrypted)
- `refresh_token` TEXT (encrypted)
- `token_expires_at` TIMESTAMPTZ
- `last_sync_at` TIMESTAMPTZ
- `settings` JSONB
- `created_at` TIMESTAMPTZ

**notifications**
- `id` UUID (PK)
- `user_id` UUID (FK → users)
- `type` TEXT ('friend_request', 'workout_like', 'challenge_update', 'reminder')
- `title` TEXT
- `body` TEXT
- `data` JSONB (deep link payload)
- `is_read` BOOLEAN
- `created_at` TIMESTAMPTZ

</details>

---

## 4. API Routes

### REST Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| **Auth** | | | |
| POST | `/api/v1/auth/register` | Register | No |
| POST | `/api/v1/auth/login` | Login | No |
| POST | `/api/v1/auth/logout` | Logout | Yes |
| POST | `/api/v1/auth/refresh` | Refresh token | Yes |
| POST | `/api/v1/auth/forgot-password` | Send reset email | No |
| POST | `/api/v1/auth/reset-password` | Reset password | No |
| **Users** | | | |
| GET | `/api/v1/users/me` | Current user profile | Yes |
| PATCH | `/api/v1/users/me` | Update profile | Yes |
| GET | `/api/v1/users/:id` | User profile (public) | Yes |
| **Workouts** | | | |
| GET | `/api/v1/workouts` | List workouts (paginated) | Yes |
| POST | `/api/v1/workouts` | Create workout | Yes |
| GET | `/api/v1/workouts/:id` | Get workout with sets | Yes |
| PATCH | `/api/v1/workouts/:id` | Update workout | Yes |
| DELETE | `/api/v1/workouts/:id` | Delete workout | Yes |
| POST | `/api/v1/workouts/:id/sets` | Add set | Yes |
| PATCH | `/api/v1/workouts/:id/sets/:setId` | Update set | Yes |
| DELETE | `/api/v1/workouts/:id/sets/:setId` | Delete set | Yes |
| POST | `/api/v1/workouts/:id/complete` | Complete workout | Yes |
| **Templates** | | | |
| GET | `/api/v1/workout-templates` | List templates | Yes |
| POST | `/api/v1/workout-templates` | Create template | Yes |
| GET | `/api/v1/workout-templates/:id` | Get template | Yes |
| PATCH | `/api/v1/workout-templates/:id` | Update template | Yes |
| DELETE | `/api/v1/workout-templates/:id` | Delete template | Yes |
| **Exercises** | | | |
| GET | `/api/v1/exercises` | List exercises (search) | Yes |
| GET | `/api/v1/exercises/:id` | Get exercise details | Yes |
| POST | `/api/v1/exercises` | Create custom exercise | Yes |
| **Nutrition** | | | |
| GET | `/api/v1/meals` | List meals (by date range) | Yes |
| POST | `/api/v1/meals` | Log meal | Yes |
| GET | `/api/v1/meals/:id` | Get meal with items | Yes |
| DELETE | `/api/v1/meals/:id` | Delete meal | Yes |
| POST | `/api/v1/meals/:id/items` | Add food item | Yes |
| DELETE | `/api/v1/meals/:id/items/:itemId` | Remove item | Yes |
| **Foods** | | | |
| GET | `/api/v1/foods` | Search foods (Meilisearch) | Yes |
| POST | `/api/v1/foods` | Create custom food | Yes |
| GET | `/api/v1/foods/barcode/:barcode` | Lookup by barcode | Yes |
| **Progress** | | | |
| GET | `/api/v1/progress/workouts` | Workout frequency/volume over time | Yes |
| GET | `/api/v1/progress/exercises/:exerciseId` | Exercise progress (weight/reps) | Yes |
| GET | `/api/v1/progress/body` | Body measurements over time | Yes |
| GET | `/api/v1/progress/nutrition` | Nutrition summary (daily/weekly) | Yes |
| GET | `/api/v1/progress/prs` | Personal records | Yes |
| **Body** | | | |
| POST | `/api/v1/body-logs` | Log body measurement | Yes |
| GET | `/api/v1/body-logs` | List body logs | Yes |
| DELETE | `/api/v1/body-logs/:id` | Delete log | Yes |
| **Social** | | | |
| GET | `/api/v1/feed` | Social feed | Yes |
| POST | `/api/v1/posts` | Create post | Yes |
| POST | `/api/v1/posts/:id/like` | Like/unlike post | Yes |
| GET | `/api/v1/posts/:id/comments` | Get comments | Yes |
| POST | `/api/v1/posts/:id/comments` | Add comment | Yes |
| **Friends** | | | |
| GET | `/api/v1/friends` | List friends | Yes |
| POST | `/api/v1/friends/request` | Send friend request | Yes |
| PATCH | `/api/v1/friends/request/:id` | Accept/reject request | Yes |
| DELETE | `/api/v1/friends/:userId` | Remove friend | Yes |
| **Challenges** | | | |
| GET | `/api/v1/challenges` | List challenges | Yes |
| POST | `/api/v1/challenges` | Create challenge | Yes |
| POST | `/api/v1/challenges/:id/join` | Join challenge | Yes |
| GET | `/api/v1/challenges/:id/leaderboard` | Challenge leaderboard | Yes |
| **AI** | | | |
| POST | `/api/v1/ai/workout-plan` | Generate workout plan | Yes |
| POST | `/api/v1/ai/meal-plan` | Generate meal plan | Yes |
| POST | `/api/v1/ai/insights` | Get training insights | Yes |
| POST | `/api/v1/ai/analyze-form` | Analyze exercise form (image) | Yes |
| **Devices** | | | |
| GET | `/api/v1/devices` | List connected devices | Yes |
| POST | `/api/v1/devices/connect` | Initiate device connection | Yes |
| DELETE | `/api/v1/devices/:id` | Disconnect device | Yes |
| POST | `/api/v1/devices/:id/sync` | Trigger manual sync | Yes |
| **Webhooks** | | | |
| POST | `/api/v1/webhooks/devices/:provider` | Device data webhook | Signature |

### WebSocket Endpoints

| Path | Description |
|---|---|
| `/ws/workout/:workoutId` | Live workout session sync (coach, own devices) |
| `/ws/notifications` | Real-time notification stream |
| `/ws/chat` | Direct messaging / group chat |

---

## 5. Authentication Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │  Next.js │         │  Hono    │
│          │         │  (Server)│         │  API     │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │  POST /login       │                    │
     │──────────────────►│                    │
     │                    │                    │
     │                    │  POST /v1/auth/    │
     │                    │       login        │
     │                    │──────────────────►│
     │                    │                    │
     │                    │  200 {session,     │
     │                    │       user}        │
     │                    │◄──────────────────│
     │                    │                    │
     │  Set session       │                    │
     │  cookie (httpOnly) │                    │
     │◄──────────────────│                    │
     │                    │                    │
     │  GET /workouts     │                    │
     │──────────────────►│                    │
     │                    │                    │
     │                    │  GET /v1/workouts  │
     │                    │  Cookie: session   │
     │                    │──────────────────►│
     │                    │                    │
     │                    │  Verify session    │
     │                    │  (Redis lookup)    │
     │                    │                    │
     │                    │  Return data       │
     │                    │◄──────────────────│
     │◄──────────────────│                    │
```

**Key decisions:**
- **Better Auth** with session cookies (httpOnly, secure, sameSite)
- Session stored in Redis (fast lookup, auto-expiry)
- Next.js middleware validates session on route access
- Hono middleware validates session for API calls
- Social login via OAuth (Google, Apple, Strava)

---

## 6. Real-Time Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │  Hono    │     │  Redis   │
│  A       │     │  WS Svr  │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                 │               │
     │  WS Connect     │               │
     │ /ws/workout/:id │               │
     │────────────────►│               │
     │                 │               │
     │                 │ Subscribe     │
     │                 │──────────────►│
     │                 │  workout:{id} │
     │                 │               │
     │  Client B adds  │               │
     │  set            │               │
     │                 │               │
     │                 │ Publish event │
     │                 │──────────────►│
     │                 │               │
     │                 │   Broadcast   │
     │  New set data   │◄──────────────│
     │◄────────────────│               │
     │                 │               │
```

**Pub/Sub via Redis:** When a workout is updated, the Hono handler publishes the change to Redis. All connected WS clients subscribed to that workout channel receive the update. This allows horizontal scaling — any Hono instance can serve any WS client.

---

## 7. AI Features

### Workout Plan Generation
```
User inputs: goals, experience, equipment, days/week
       │
       ▼
Prompt engineering → LLM (GPT-4o / Claude) → Structured JSON
       │
       ▼
Post-processing (validate sets/reps, check against exercise DB)
       │
       ▼
Return plan (can be saved as template)
```

### Meal Plan Generation
```
User inputs: calories target, dietary preferences, allergies
       │
       ▼
LLM generates meal plan → matched against food DB
       │
       ▼
Return meals with nutritional breakdown
```

### Training Insights
```
Aggregate workout data → LLM analyzes trends
  → Form suggestions, deload warnings, PR recognition
```

### Rate Limiting & Caching
- AI requests are expensive → rate-limited per user (e.g., 10/day)
- Common plans cached in Redis (e.g., "beginner push/pull/legs")
- Background job queue for long-running generations

---

## 8. External Integrations

### Wearable Devices

| Provider | Auth | Sync Method | Data |
|---|---|---|---|
| Apple Health | OAuth + HK API | REST webhook + app | Workouts, steps, HR |
| Google Fit | OAuth 2.0 | REST poll + webhook | Workouts, steps, HR |
| Fitbit | OAuth 2.0 | REST poll + subscription API | Workouts, sleep, HR |
| Garmin | OAuth | REST poll | Workouts, body metrics |
| Strava | OAuth 2.0 | Webhook | Activities (runs, rides) |

### Nutrition Data

| Source | Method | Coverage |
|---|---|---|
| USDA FoodData Central | API | ~200k items |
| OpenFoodFacts | API (free) | ~3M items (barcode) |
| User-created | Manual | Custom foods |

---

## 9. Security Considerations

- **Auth**: Session tokens (httpOnly, secure, sameSite=strict), CSRF protection
- **API Rate Limiting**: Per-user + per-IP, Redis-backed (sliding window)
- **Input Validation**: Zod schemas on every endpoint (shared package)
- **SQL Injection**: Drizzle ORM (parameterized queries)
- **File Uploads**: Signed URLs (presigned S3/MinIO), malware scanning
- **CORS**: Tight origin restriction in production
- **Secrets**: Environment variables, never committed. Use `.env.example`
- **HTTPS**: Enforced in production
- **DB Encryption**: Encrypt sensitive tokens (device access_tokens) at rest
- **Audit Logging**: Log auth events, data mutations

---

## 10. Deployment

### Development
```
docker compose up          # PostgreSQL, Redis, MinIO, Meilisearch
bun dev:api               # Hono API with hot reload (Bun)
bun dev:web               # Next.js dev server
```

### Production
```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Vercel  │    │Railway   │    │ Managed  │
│ (Next.js)│    │ (Hono)   │    │ Services │
│          │    │          │    │ Neon DB  │
│  Edge    │    │  Auto-   │    │ Redis    │
│  CDN     │    │  scaling │    │ Cloud    │
│          │    │          │    │ R2/S3    │
└──────────┘    └──────────┘    └──────────┘
```

**Strategy:**
- Frontend → **Vercel** (native Next.js support, edge functions)
- API → **Railway** or **Fly.io** (Bun support, auto-scaling)
- Database → **Neon** (serverless PostgreSQL, branching for dev)
- Cache → **Upstash Redis** (serverless, REST API fallback)
- Storage → **Cloudflare R2** or **AWS S3**
- Search → **Meilisearch Cloud** or self-hosted

---

## 11. Testing Strategy

| Layer | Tool | Scope |
|---|---|---|
| **Unit** | Vitest | Services, utils, validation |
| **Integration** | Vitest + Hono testing | API routes (in-memory DB) |
| **E2E** | Playwright | Full user flows (Next.js) |
| **WebSocket** | Vitest + WS | Real-time sync tests |
| **Visual** | Percy / Chromatic | UI regression |
| **Performance** | k6 | API load testing |

---

## 12. Future Considerations

- **Mobile App**: React Native (shared types from `packages/shared`)
- **Offline-first**: Dexie.js (IndexedDB) for workout logging offline → sync when online
- **Progressive Web App**: Service worker, manifest, push notifications
- **Apple Watch / Wear OS**: Native companion apps
- **i18n**: next-intl for multi-language support
- **Analytics**: PostHog (open-source product analytics)
- **Feature Flags**: Unleash or growthbook for gradual rollouts
