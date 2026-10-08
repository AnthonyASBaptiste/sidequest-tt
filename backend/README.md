# SideQuest T&T backend foundation

NestJS + Mongoose foundation for MongoDB Atlas. This stage intentionally has
no API endpoints, authentication, quest workflows, or Gemma integration.

## Configure

Copy `.env.example` to `.env`, then set `MONGODB_URI` to a MongoDB Atlas
connection string (or a local MongoDB URI for development). `MONGODB_DB_NAME`
overrides the database name in the connection string. `PORT` defaults to 3000.

Do not commit `.env` or database credentials.

## Run

```sh
npm install
npm run start:dev
```

Startup validates the environment, connects to MongoDB, builds the declared
Mongoose indexes, and logs the connected database name. The Nest application
does not expose routes yet.

To perform a minimal database ping:

```sh
npm run db:check
```

This builds the application, creates a Nest application context using the same
configuration, and runs MongoDB's `ping` command. It exits nonzero on invalid
configuration or a failed connection.

To seed a small, repeatable sample quest pool for today's Trinidad date:

```sh
npm run db:seed
```

The seed adds five template fixtures, one published daily pool, and
five playable quest instances. It does not create guest users or completion
history. The operation is idempotent and will not replace a different pool
already published for today's date.

## Collections and indexes

Mongoose schemas explicitly bind to `users`, `questTemplates`,
`questPoolBatches`, `quests`, `questAcceptances`, `submissionAttempts`,
`questCompletions`, and `xpAwards`. Required unique and lookup indexes are
declared in the corresponding schema files and are built at startup.

The logical data model remains in `../docs/data-model.md`; this ODM mapping does
not implement its state transitions, daily pool publication, evidence deletion,
or XP awarding behavior.
