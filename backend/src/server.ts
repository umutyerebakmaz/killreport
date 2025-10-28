import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';
import path from 'path';

// Tüm resolver'ları modüler yapıdan import et
import { config } from './config';
import { resolvers } from './resolvers';
import { exchangeCodeForToken, verifyToken } from './services/eve-sso';
import prisma from './services/prisma';

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
  graphqlEndpoint: '/graphql',
  context: async ({ request }) => {
    const authorization = request.headers.get('authorization');

    // Bearer token varsa doğrula
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7);
      console.log('🔑 Token received, length:', token.length);
      try {
        const character = await verifyToken(token);
        console.log('✅ Token verified for character:', character.characterName);
        return {
          user: character,
          token, // ESI API çağrıları için token'ı da context'e ekle
        };
      } catch (error) {
        console.error('❌ Token verification failed:', error);
        // Token geçersiz ama request devam etsin
      }
    }

    console.log('⚠️  No token provided');
    return {};
  },
});

// HTTP sunucusunu oluştur
const server = createServer(async (req, res) => {
  // CORS headers ekle
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Eve SSO Callback endpoint
  if (req.url?.startsWith('/auth/callback')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing code or state parameter' }));
      return;
    }

    try {
      // Authorization code'u token ile değiştir
      const tokenData = await exchangeCodeForToken(code);

      // Verify token and get character info
      const character = await verifyToken(tokenData.access_token);

      // Calculate token expiry time
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      // Find or create user in database
      const user = await prisma.user.upsert({
        where: { characterId: character.characterId },
        update: {
          characterName: character.characterName,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
        },
        create: {
          characterId: character.characterId,
          characterName: character.characterName,
          characterOwnerHash: character.characterOwnerHash,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
        },
      });

      // Redirect to frontend (with token)
      const redirectUrl = `${config.eveSso.frontendUrl}/auth/success?token=${encodeURIComponent(tokenData.access_token)}&refresh_token=${encodeURIComponent(tokenData.refresh_token || '')}&expires_in=${tokenData.expires_in}&character_name=${encodeURIComponent(character.characterName)}&character_id=${character.characterId}`;

      res.writeHead(302, {
        'Location': redirectUrl,
      });
      res.end();
    } catch (error) {
      console.error('Callback error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
    return;
  }

  // GraphQL endpoint için Yoga'yı kullan
  return yoga(req, res);
});

const port = 4000;

server.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}/graphql`);
  console.log(`🔐 Auth callback available at http://localhost:${port}/auth/callback`);
});
