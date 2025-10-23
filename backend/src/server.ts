import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';
import path from 'path';

// Tüm resolver'ları modüler yapıdan import et
import { resolvers } from './resolvers';

// --- ADIM 1: SDL Dosyalarını Yükleme ---
// Projedeki tüm .graphql dosyalarını bul ve yükle
const typesArray = loadFilesSync(path.join(__dirname, 'schema/**/*.graphql'));
const typeDefs = mergeTypeDefs(typesArray);
// 'typeDefs' artık tüm şemalarınızı içeren BÜYÜK bir string (veya AST) içerir.
// --- Bitti ---

// Executable schema oluştur
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// GraphQL Yoga instance'ı oluştur
const yoga = createYoga({
  schema,
});

// HTTP sunucusunu oluştur ve başlat
const server = createServer(yoga);
const port = 4000;

server.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}/graphql`);
});
