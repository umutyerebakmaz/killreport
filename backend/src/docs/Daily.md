## Daily Workflows (Backend)

```bash
yarn queue:alliances
```

This command: get all alliance IDs from ESI and adds them to the RabbitMQ queue.

```bash
yarn worker:alliances
```

this command: processes alliance IDs from the RabbitMQ queue, fetching and saving them to the database if they don't already exist.

```bash
yarn queue:alliance-corporations
```

This command: get all alliance IDs from the database and adds them to the RabbitMQ queue for corporation discovery.

```bash
yarn worker:alliance-corporations
```

This command: processes alliance IDs from the RabbitMQ queue, fetching corporation IDs from ESI and adding them to the corporation enrichment queue.

```bash
yarn worker:info:corporations
```

This command: processes corporation IDs from the corporation enrichment queue, fetching detailed corporation information from ESI and saving it to the database.

```bash
yarn snapshot:alliances
```

This command: creates a snapshot of all alliances in the database.

```bash
yarn snapshot:corporations
```

This command: creates a snapshot of all corporations in the database.

```bash
yarn update:alliance-counts
```
