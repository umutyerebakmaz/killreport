import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';
import path from 'path';

// Tüm resolver'ları modüler yapıdan import et
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
      try {
        const character = await verifyToken(token);
        return {
          user: character,
        };
      } catch (error) {
        console.error('Token verification failed:', error);
        // Token geçersiz ama request devam etsin
      }
    }

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

      // Token'ı doğrula ve character bilgilerini al
      const character = await verifyToken(tokenData.access_token);

      // User'ı database'de bul veya oluştur
      const user = await prisma.user.upsert({
        where: { id: character.characterId },
        update: {
          name: character.characterName,
        },
        create: {
          id: character.characterId,
          name: character.characterName,
          email: `${character.characterId}@eveonline.com`,
        },
      });

      // Success page döndür
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Authentication Successful</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            max-width: 600px;
                            margin: 50px auto;
                            padding: 20px;
                            background: #f5f5f5;
                        }
                        .container {
                            background: white;
                            padding: 30px;
                            border-radius: 8px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        h1 { color: #28a745; }
                        .token-box {
                            background: #f8f9fa;
                            padding: 15px;
                            border-radius: 4px;
                            margin: 15px 0;
                            word-break: break-all;
                            font-family: monospace;
                            font-size: 12px;
                        }
                        .info { color: #666; margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>✓ Authentication Successful!</h1>
                        <p class="info">Welcome, <strong>${character.characterName}</strong>!</p>
                        <p class="info">Character ID: ${character.characterId}</p>

                        <h3>Access Token:</h3>
                        <div class="token-box">${tokenData.access_token}</div>

                        ${tokenData.refresh_token ? `
                        <h3>Refresh Token:</h3>
                        <div class="token-box">${tokenData.refresh_token}</div>
                        ` : ''}

                        <p class="info">Token expires in: ${tokenData.expires_in} seconds</p>
                        <p class="info">You can now use this token in the Authorization header of your GraphQL requests.</p>
                        <p class="info" style="margin-top: 20px;">
                            <strong>Example:</strong><br>
                            Authorization: Bearer ${tokenData.access_token.substring(0, 30)}...
                        </p>
                    </div>
                </body>
                </html>
            `);
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
