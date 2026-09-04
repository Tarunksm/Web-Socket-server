````md
# Chat App WebSocket Server

WebSocket backend for a real-time chat application.

## Tech Stack

- Node.js
- TypeScript
- WebSocket (`ws`)
- Prisma
- PostgreSQL
- Neon

## Features

- Real-time messaging
- Multiple connected users
- Message history
- PostgreSQL message persistence
- Join/leave events
- WebSocket error handling

## Run Locally

```bash
npm install
npx prisma generate
npx tsx watch src/server.ts
```
````

The WebSocket server runs on:

```text
ws://localhost:8080
```

## Environment Variables

Create a `.env` file:

```env
DATABASE_URL="your_database_url"
```

```

```
