# BR Telecom Management System

React + Vite web app based on the provided BR Telecom management code.

## Run locally

```bash
npm install
npm run dev
```

The app works with browser localStorage by default.

## Optional Firebase sync

1. Copy `.env.example` to `.env`.
2. Fill in your Firebase project values.
3. In Firebase Authentication, enable Anonymous authentication.
4. Create a Firestore database.
5. Run `npm run dev` again.

Cloud data is stored under:
`artifacts/{VITE_BR_APP_ID}/users/{uid}/data/state`

## Production build

```bash
npm run build
npm run preview
```
