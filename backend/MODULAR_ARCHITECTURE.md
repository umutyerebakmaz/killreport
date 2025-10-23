# 🏗️ MODÜLER RESOLVER YAPISI - DETAYLI AÇIKLAMA

## 📁 Proje Yapısı

```
backend/
├── src/
│   ├── schema/                    # GraphQL Schema Dosyaları (SDL)
│   │   ├── user.graphql          # User domain şeması
│   │   ├── character.graphql     # Character domain şeması
│   │   └── killmail.graphql      # Killmail domain şeması
│   │
│   ├── resolvers/                # Resolver İmplementasyonları
│   │   ├── index.ts             # 🔥 Tüm resolver'ları birleştiren ana dosya
│   │   ├── user.resolver.ts     # User resolver'ları (Query + Mutation)
│   │   ├── character.resolver.ts # Character resolver'ları + Field resolvers
│   │   └── killmail.resolver.ts  # Killmail resolver'ları
│   │
│   ├── generated-types.ts        # 🤖 CodeGen tarafından otomatik oluşturulan tipler
│   ├── generated-schema.graphql  # 🤖 Birleştirilmiş GraphQL şeması
│   └── server.ts                 # GraphQL Yoga sunucusu
│
├── codegen.ts                    # GraphQL Code Generator yapılandırması
├── package.json
└── TEST_QUERIES.md              # Test sorguları

🤖 = Otomatik generate edilen dosyalar (manuel düzenlemeyin!)
🔥 = Kritik dosya
```

---

## 🔄 WORKFLOW ADIM ADIM

### **ADIM 1: Schema Tanımlama (Domain Bazlı)**

Her domain için ayrı `.graphql` dosyası oluşturuyoruz:

#### **user.graphql**

```graphql
type Query {
  user(id: ID!): User
  users: [User!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User
}

type User {
  id: ID!
  name: String!
  email: String!
}
```

#### **character.graphql** (extend kullanımı)

```graphql
extend type Query { # ⚠️ "extend" anahtar kelimesi!
  character(id: ID!): Character
}

extend type Mutation {
  addCharacter(input: AddCharacterInput!): Character!
}

type Character {
  id: ID!
  name: String!
  user: User # Relation field
}
```

**💡 Neden `extend` kullanıyoruz?**

- Birden fazla dosyada aynı type'ı tanımlamak için
- Her domain kendi Query/Mutation'larını ekleyebilir
- Conflict olmadan birleşir

---

### **ADIM 2: Code Generation**

```bash
yarn codegen
```

**Ne oluyor?**

1. `codegen.ts` yapılandırmasını okur
2. `src/schema/**/*.graphql` dosyalarını bulur
3. Tüm şemaları birleştirir → `generated-schema.graphql`
4. TypeScript tipleri oluşturur → `generated-types.ts`

**Oluşturulan Önemli Tipler:**

```typescript
// generated-types.ts

export type QueryResolvers = {
  user?: Resolver<...>;
  users?: Resolver<...>;
  character?: Resolver<...>;
  charactersByUser?: Resolver<...>;
  killmail?: Resolver<...>;
  killmails?: Resolver<...>;
};

export type MutationResolvers = {
  createUser?: Resolver<...>;
  updateUser?: Resolver<...>;
  addCharacter?: Resolver<...>;
};

export type CharacterResolvers = {
  user?: Resolver<...>;  // Field resolver
};
```

---

### **ADIM 3: Modüler Resolver İmplementasyonu**

Her domain için ayrı resolver dosyası:

#### **user.resolver.ts**

```typescript
import { QueryResolvers, MutationResolvers } from "../generated-types";

// Query Resolvers - Export ediyoruz
export const userQueries: QueryResolvers = {
  user: (_, { id }) => {
    // Database'den user çek
    return findUserById(id);
  },
  users: () => {
    // Tüm user'ları çek
    return findAllUsers();
  },
};

// Mutation Resolvers - Export ediyoruz
export const userMutations: MutationResolvers = {
  createUser: (_, { input }) => {
    // Yeni user oluştur
    return createNewUser(input);
  },
  updateUser: (_, { id, input }) => {
    // User güncelle
    return updateExistingUser(id, input);
  },
};
```

**💡 Avantajlar:**

- ✅ Her domain kendi dosyasında (50-200 satır ideal)
- ✅ Tip-güvenli (TypeScript otomatik tamamlama)
- ✅ Test edilebilir (her resolver ayrı export edilmiş)
- ✅ Merge conflict riski çok düşük (farklı dosyalarda çalışıyorsunuz)

---

#### **character.resolver.ts** (Field Resolvers ile)

```typescript
import {
  QueryResolvers,
  MutationResolvers,
  CharacterResolvers,
} from "../generated-types";

export const characterQueries: QueryResolvers = {
  character: (_, { id }) => {
    return findCharacterById(id);
  },
};

export const characterMutations: MutationResolvers = {
  addCharacter: (_, { input }) => {
    return createCharacter(input);
  },
};

// 🔥 FIELD RESOLVER - Nested field'lar için
export const characterFieldResolvers: CharacterResolvers = {
  // Character.user field'ı çağrıldığında bu çalışır
  user: (parent) => {
    // parent = Character object
    return findUserById(parent.userId);
  },
};
```

**💡 Field Resolver Nedir?**

Query:

```graphql
query {
  character(id: "1") {
    id
    name
    user {
      # ← Bu field çağrıldığında
      name #   characterFieldResolvers.user çalışır
      email
    }
  }
}
```

Flow:

1. `characterQueries.character` → Character döndürür
2. GraphQL `user` field'ını görür
3. `characterFieldResolvers.user(parent)` çağrılır
4. Parent'taki userId ile User çekilir

---

### **ADIM 4: Resolver'ları Birleştirme**

#### **resolvers/index.ts** (Ana Birleştirme Dosyası)

```typescript
import { Resolvers } from "../generated-types";
import { userQueries, userMutations } from "./user.resolver";
import {
  characterQueries,
  characterMutations,
  characterFieldResolvers,
} from "./character.resolver";
import { killmailQueries } from "./killmail.resolver";

export const resolvers: Resolvers = {
  Query: {
    // Tüm domain'lerin query'lerini birleştir
    ...userQueries,
    ...characterQueries,
    ...killmailQueries,
  },

  Mutation: {
    // Tüm domain'lerin mutation'larını birleştir
    ...userMutations,
    ...characterMutations,
  },

  // Field Resolvers
  Character: characterFieldResolvers,
};
```

**💡 Spread Operator (`...`) Kullanımı:**

Şu iki kod aynı:

```typescript
// Manuel
Query: {
  user: userQueries.user,
  users: userQueries.users,
  character: characterQueries.character,
}

// Spread ile
Query: {
  ...userQueries,
  ...characterQueries,
}
```

---

### **ADIM 5: Server'a Bağlama**

#### **server.ts**

```typescript
import { resolvers } from "./resolvers"; // index.ts'den gelir

const schema = makeExecutableSchema({
  typeDefs, // Tüm .graphql dosyalarından birleştirilmiş
  resolvers, // resolvers/index.ts'den
});

const yoga = createYoga({ schema });
```

---

## ⚙️ YENİ BİR DOMAIN EKLEMEK

Örnek: **Post** domain'i ekleyelim

### 1. Schema Oluştur

**schema/post.graphql**

```graphql
extend type Query {
  post(id: ID!): Post
  posts: [Post!]!
}

extend type Mutation {
  createPost(input: CreatePostInput!): Post!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User # Relation
}

input CreatePostInput {
  title: String!
  content: String!
  authorId: ID!
}
```

### 2. CodeGen Çalıştır

```bash
yarn codegen
```

### 3. Resolver Oluştur

**resolvers/post.resolver.ts**

```typescript
import {
  QueryResolvers,
  MutationResolvers,
  PostResolvers,
} from "../generated-types";

export const postQueries: QueryResolvers = {
  post: (_, { id }) => findPostById(id),
  posts: () => findAllPosts(),
};

export const postMutations: MutationResolvers = {
  createPost: (_, { input }) => createNewPost(input),
};

export const postFieldResolvers: PostResolvers = {
  author: (parent) => findUserById(parent.authorId),
};
```

### 4. Index'e Ekle

**resolvers/index.ts**

```typescript
import {
  postQueries,
  postMutations,
  postFieldResolvers,
} from "./post.resolver";

export const resolvers: Resolvers = {
  Query: {
    ...userQueries,
    ...characterQueries,
    ...killmailQueries,
    ...postQueries, // ← Yeni eklendi
  },

  Mutation: {
    ...userMutations,
    ...characterMutations,
    ...postMutations, // ← Yeni eklendi
  },

  Character: characterFieldResolvers,
  Post: postFieldResolvers, // ← Yeni eklendi
};
```

### 5. Sunucuyu Yeniden Başlat

```bash
yarn dev
```

✅ Yeni domain hazır! Hiçbir mevcut dosyayı bozmadan.

---

## 🎯 EN İYİ PRATİKLER

### ✅ YAPIN

1. **Her domain için ayrı dosya:**

   - `user.graphql` + `user.resolver.ts`
   - `character.graphql` + `character.resolver.ts`

2. **Küçük, fokuslu resolver'lar:**

   - Her resolver 1 iş yapsın
   - 50-200 satır ideal

3. **Field resolver'ları kullanın:**

   - Nested data için (N+1 query çözümü DataLoader ile)

4. **Type safety'yi koruyun:**

   - `generated-types.ts`'den import edin
   - `any` kullanmayın

5. **Spread operator kullanın:**
   - `...userQueries` temiz kod

### ❌ YAPMAYIN

1. **Tek resolver.ts kullanmayın:**

   - 1000 satırlık dosya okunmaz

2. **generated-\*.ts dosyalarını düzenlemeyin:**

   - CodeGen her seferinde üzerine yazar

3. **Schema'yı TypeScript'te tanımlamayın:**

   - SDL (`.graphql`) kullanın, daha okunabilir

4. **Field resolver'ları unutmayın:**
   - Relations için önemli

---

## 🚀 PERFORMANS İPUÇLARI

### N+1 Query Problemi

**Kötü Örnek:**

```typescript
Character: {
  user: (parent) => {
    // Her character için ayrı query!
    return db.user.findById(parent.userId); // ❌ N+1 problem
  };
}
```

**İyi Örnek (DataLoader ile):**

```typescript
import DataLoader from "dataloader";

const userLoader = new DataLoader((ids) =>
  db.user.findMany({ where: { id: { in: ids } } })
);

Character: {
  user: (parent) => {
    return userLoader.load(parent.userId); // ✅ Batch query
  };
}
```

---

## 📊 DOSYA BOYUTU KARŞILAŞTIRMASI

### Tek Dosya Yaklaşımı ❌

```
resolvers.ts → 2500 satır
schema.graphql → 800 satır
```

- Okunması zor
- Merge conflict riski yüksek
- Test etmek zor

### Modüler Yaklaşım ✅

```
user.graphql → 50 satır
user.resolver.ts → 80 satır

character.graphql → 60 satır
character.resolver.ts → 100 satır

killmail.graphql → 70 satır
killmail.resolver.ts → 120 satır

index.ts → 40 satır
```

- Okunması kolay
- Merge conflict riski düşük
- Test etmek kolay
- Takım çalışması verimli

---

## 🔍 ÖZETİN ÖZETİ

1. **Schema'lar → Domain bazlı ayır** (user.graphql, character.graphql)
2. **Resolver'lar → Domain bazlı ayır** (user.resolver.ts, character.resolver.ts)
3. **CodeGen çalıştır** → Tip-güvenli tipler oluştur
4. **resolvers/index.ts → Hepsini birleştir**
5. **server.ts → Schema + Resolver → GraphQL Yoga**

**Sonuç:** Ölçeklenebilir, bakımı kolay, tip-güvenli GraphQL API! 🎉
