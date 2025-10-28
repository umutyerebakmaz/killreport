# MODULAR RESOLVER STRUCTURE - TEST QUERIES

Queries you can test in GraphQL Playground (http://localhost:4000/graphql):

## 1️⃣ USER QUERIES

### List all users

```graphql
query GetAllUsers {
  users {
    id
    name
    email
    createdAt
  }
}
```

### Get a single user

```graphql
query GetUser {
  user(id: "1") {
    id
    name
    email
    createdAt
  }
}
```

### Create a new user

```graphql
mutation CreateUser {
  createUser(input: { name: "Ahmet Yılmaz", email: "ahmet@example.com" }) {
    id
    name
    email
    createdAt
  }
}
```

### Update user

```graphql
mutation UpdateUser {
  updateUser(id: "1", input: { name: "Updated Name" }) {
    id
    name
    email
  }
}
```

---

## 2️⃣ CHARACTER QUERIES

### Get a single character

```graphql
query GetCharacter {
  character(id: "1") {
    id
    name
    corporation
    alliance
    securityStatus
    user {
      id
      name
      email
    }
  }
}
```

### Get all characters of a user

```graphql
query GetUserCharacters {
  charactersByUser(userId: "1") {
    id
    name
    corporation
    alliance
    securityStatus
  }
}
```

### Add a new character

```graphql
mutation AddCharacter {
  addCharacter(
    input: { name: "New Pilot", corporation: "My Corp", userId: "1" }
  ) {
    id
    name
    corporation
    user {
      name
    }
  }
}
```

---

## 3️⃣ KILLMAIL QUERIES

### Get a single killmail

```graphql
query GetKillmail {
  killmail(id: "1") {
    id
    killmailId
    killmailHash
    killmailTime
    totalValue
    victim {
      characterName
      corporationName
      shipTypeId
      damageTaken
    }
    attackers {
      characterName
      corporationName
      shipTypeId
      weaponTypeId
      finalBlow
    }
  }
}
```

### Killmail list (with pagination)

```graphql
query GetKillmails {
  killmails(limit: 10, offset: 0) {
    id
    killmailId
    totalValue
    killmailTime
    victim {
      characterName
      shipTypeId
    }
  }
}
```

---

## 4️⃣ COMPLEX NESTED QUERY

You can fetch related data like User → Characters → Killmails in a single request:

```graphql
query ComplexQuery {
  user(id: "1") {
    id
    name
    email
  }

  charactersByUser(userId: "1") {
    id
    name
    corporation
    securityStatus
  }

  killmails(limit: 5) {
    id
    killmailId
    totalValue
    victim {
      characterName
    }
  }
}
```

---

## 📝 NOTES

1. **Mock Data**: Currently all resolvers use mock data
2. **Real Implementation**: Once you add database connection, just update the resolvers
3. **Field Resolvers**: Nested fields like `Character.user` are automatically resolved
4. **Type Safety**: All resolvers are type-safe with TypeScript
