# MODÜLER RESOLVER YAPISI - TEST QUERY'LERİ

GraphQL Playground'da (http://localhost:4000/graphql) test edebileceğiniz query'ler:

## 1️⃣ USER QUERIES

### Tüm kullanıcıları listele

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

### Tek bir kullanıcı getir

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

### Yeni kullanıcı oluştur

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

### Kullanıcı güncelle

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

### Tek bir character getir

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

### Bir kullanıcının tüm karakterlerini getir

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

### Yeni character ekle

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

### Tek bir killmail getir

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

### Killmail listesi (pagination ile)

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

## 4️⃣ KOMPLEKS NESTED QUERY

User → Characters → Killmails gibi ilişkili datayı tek seferde çekebilirsiniz:

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

## 📝 NOTLAR

1. **Mock Data**: Şu anda tüm resolver'lar mock data kullanıyor
2. **Gerçek Implementasyon**: Database bağlantısı ekleyince resolver'ları güncellemeniz yeterli
3. **Field Resolvers**: `Character.user` gibi nested field'lar otomatik çözümleniyor
4. **Type Safety**: Tüm resolver'lar TypeScript ile tip-güvenli
