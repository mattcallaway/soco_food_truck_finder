# SoCo Food Truck Finder

A full-stack, production-quality web application built with Next.js, TypeScript, MapLibre GL JS, and Firebase/Firestore for discovering scheduled mobile food vendors (food trucks, trailers, carts, pop-ups, taco stands, mobile pizza ovens) across **Sonoma County, California**.

---

## 🏗️ System Architecture

```text
                                  +-----------------------+
                                  |   Next.js App Router  |
                                  +-----------+-----------+
                                              |
                                              v
                              +---------------+---------------+
                              |  Unified Repository Layer     |
                              |   (src/lib/db/store.ts)       |
                              +---------------+---------------+
                                              |
                     +------------------------+------------------------+
                     |                                                 |
                     v                                                 v
      +--------------+--------------+                   +--------------+--------------+
      |  Firestore Store            |                   |  Demo Store                 |
      |  (DATA_MODE=firebase)       |                   |  (DATA_MODE=demo)           |
      |  Real Firestore Persistence |                   |  Development Fallback       |
      +-----------------------------+                   +-----------------------------+
```

---

## ⚡ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React icons
- **Mapping**: MapLibre GL JS, OpenStreetMap vector/raster tile providers (configurable style URL)
- **Database & Auth**: Firebase JS SDK & Firebase Admin SDK (Firestore, Firebase Authentication)
- **Data Ingestion**: Server-side HTTP fetcher, SHA-256 payload hashing, heuristic & structured LLM schedule extractor, candidate review queue, venue alias matcher
- **Testing**: Vitest for unit tests, Playwright for automated E2E browser verification

---

## 🚀 Local Setup & Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/mattcallaway/soco_food_truck_finder.git
cd soco_food_truck_finder
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### 3. Run Development Server (Demo Mode)
Out of the box, the app runs in explicit **Demo Mode** using authentic Sonoma County seed data (*Santa Rosa, Petaluma, Sebastopol, Healdsburg, Windsor*):
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Firebase Production Setup & Admin Bootstrapping

### 1. Enable Firebase Mode
Set the following in `.env.local`:
```env
NEXT_PUBLIC_DATA_MODE="firebase"
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
```

### 2. Deploy Firestore & Storage Rules
```bash
firebase deploy --only firestore:rules,storage:rules
```

### 3. Admin User Bootstrapping
To assign admin privileges to your user account:
1. Sign in to your application using Google or Email link.
2. In the Firebase Console under **Firestore Database**, navigate to the `users` collection.
3. Locate your user document (`users/{uid}`) and update or set the `role` field:
   ```json
   {
     "role": "admin"
   }
   ```
4. Alternatively, set a custom claim `admin: true` using the Firebase Admin SDK:
   ```ts
   import { getAuth } from 'firebase-admin/auth';
   await getAuth().setCustomUserClaims(uid, { admin: true });
   ```

---

## 🧪 Running Automated Tests

### Unit Tests (Vitest)
```bash
npm run test
```
Tests timezone calculations (`America/Los_Angeles`), `isCurrentlyOpen()`, venue alias matching, relative date extraction, and favorite union merging.

### E2E Browser Verification (Playwright)
```bash
npm run test:e2e
```
Executes automated browser tests verifying MapLibre canvas rendering, map-card bidirectional synchronization, date/city filtering, mobile map/list view switching, anonymous favorites persistence, and admin review queue approval.

---

## 📡 Ingestion Architecture & Limitations

### Server-Side Source Fetch Pipeline
1. **Fetch**: Server-side HTTP request (`/api/admin/sources/fetch`) with 10s timeout, custom User-Agent, and SHA-256 payload hashing.
2. **Observation**: Records raw source excerpt and candidate schedule.
3. **Candidate Validation**: Resolves relative dates against source timestamp and matches venues using canonical names & aliases.
4. **Review Queue**: Human-in-the-loop review interface allowing admins to approve, edit, or reject candidates.
5. **Alias Learning**: Approving a candidate automatically saves learned venue aliases for future automated matches.

### Instagram Source Policy
Instagram enforces login requirements and automated access controls. When an Instagram URL is checked, the pipeline records `status: restricted`, preserves previously verified schedules, and prompts admin manual entry. The system never circumvents authentication or platform access controls.
