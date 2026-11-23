import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { LIBRAS_SIGNS, type StudyLevelId } from './src/data/librasSigns';
import {
  buildDynamicVlibrasStudyModule,
  catalogItemToSign,
  formatVlibrasEntry,
  parseVlibrasTrie,
  pickDailyVlibrasEntry,
  queryVlibrasCatalog,
  type VlibrasCatalogItem,
  type VlibrasGlossKind,
} from './src/utils/vlibrasCatalog';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

let catalogCache: VlibrasCatalogItem[] | null = null;
let catalogSource: 'vlibras-oficial' | 'acervo-local' = 'acervo-local';
let catalogPromise: Promise<VlibrasCatalogItem[]> | null = null;

async function getVlibrasCatalog(): Promise<{
  items: VlibrasCatalogItem[];
  source: 'vlibras-oficial' | 'acervo-local';
}> {
  if (catalogCache) {
    return { items: catalogCache, source: catalogSource };
  }
  if (!catalogPromise) {
    catalogPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch('https://dicionario2-dth.vlibras.gov.br/signs', {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const json = (await res.json()) as unknown;
          const rawGlosses = parseVlibrasTrie(json);
          if (rawGlosses.length > 100) {
            const formatted = rawGlosses
              .map(formatVlibrasEntry)
              .sort((a, b) => a.word.localeCompare(b.word, 'pt-BR'));
            catalogCache = formatted;
            catalogSource = 'vlibras-oficial';
            return formatted;
          }
        }
      } catch {
        // Fallback cleanly to local base catalog if offline
      } finally {
        catalogPromise = null;
      }
      const fallback = LIBRAS_SIGNS.map((s) => formatVlibrasEntry(s.gloss));
      return fallback;
    })();
  }
  const items = await catalogPromise;
  return { items, source: catalogCache ? catalogSource : 'acervo-local' };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Pre-warm the full 23,403-sign VLibras catalog in background
  void getVlibrasCatalog();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'sinaliza-libras' });
  });

  // Full searchable & paginated VLibras catalog (23,403+ signs)
  app.get('/api/vlibras/catalog', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const letter = typeof req.query.letter === 'string' ? req.query.letter : 'all';
    const kind = (typeof req.query.kind === 'string' ? req.query.kind : 'all') as
      | 'all'
      | 'curated'
      | VlibrasGlossKind;
    const level = (typeof req.query.level === 'string' ? req.query.level : 'all') as
      | 'all'
      | StudyLevelId;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 36);

    const { items, source } = await getVlibrasCatalog();
    const result = queryVlibrasCatalog(items, { q, letter, kind, level, page, limit });
    res.json({ source, ...result });
  });

  // Daily word chosen deterministically from the complete VLibras catalog
  app.get('/api/vlibras/word-of-the-day', async (req, res) => {
    const now = new Date();
    const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dateStr = typeof req.query.date === 'string' && req.query.date.trim()
      ? req.query.date.trim()
      : defaultDate;

    const { items, source } = await getVlibrasCatalog();
    const entry = pickDailyVlibrasEntry(items, dateStr);
    res.json({
      source,
      totalCatalogCount: items.length,
      entry,
      sign: catalogItemToSign(entry),
    });
  });

  // Dynamic interactive study deck + quizzes sampled from the full VLibras catalog
  app.get('/api/vlibras/study-deck', async (req, res) => {
    const rawLevel = typeof req.query.level === 'string' ? req.query.level : 'iniciante';
    const level: StudyLevelId =
      rawLevel === 'intermediario' || rawLevel === 'avancado' ? rawLevel : 'iniciante';
    const topic = typeof req.query.topic === 'string' ? req.query.topic : '';
    const seed = typeof req.query.seed === 'string' ? req.query.seed : String(Date.now());
    const count = Number(req.query.count || 5);

    const { items, source } = await getVlibrasCatalog();
    const built = buildDynamicVlibrasStudyModule(items, { level, topic, seed, count });
    res.json({
      source,
      totalCatalogCount: items.length,
      ...built,
    });
  });

  // Server-side proxy to Federal Government VLibras Gloss API
  app.get('/api/vlibras/translate', async (req, res) => {
    const rawText = typeof req.query.text === 'string' ? req.query.text.trim() : '';
    if (!rawText) {
      res.status(400).json({ error: 'Parâmetro text é obrigatório.' });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3200);
      const response = await fetch('https://traducao2.vlibras.gov.br/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/plain, application/json',
        },
        body: JSON.stringify({ text: rawText }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        res.json({ gloss: null, engine: 'motor-glosa-local' });
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = (await response.json()) as { gloss?: string; text?: string };
        const gloss = (data.gloss || data.text || '').trim();
        res.json({ gloss: gloss || null, engine: gloss ? 'vlibras-api' : 'motor-glosa-local' });
      } else {
        const text = (await response.text()).trim();
        res.json({ gloss: text || null, engine: text ? 'vlibras-api' : 'motor-glosa-local' });
      }
    } catch {
      // Graceful fallback to local linguistic gloss engine when offline or unreachable
      res.json({ gloss: null, engine: 'motor-glosa-local' });
    }
  });

  // Same-origin proxy for official VLibras Unity AssetBundles (avoids CORS blocks on upstream redirects)
  app.get('/api/vlibras/bundles/*', async (req, res) => {
    const rawPath = (req.params as Record<string, string>)[0] || '';
    const segments = rawPath.split('/').filter(Boolean);
    if (segments.length === 0 || segments.some((s) => s === '..' || s === '.')) {
      res.status(400).end();
      return;
    }

    const encodedPath = segments.map((s) => encodeURIComponent(s)).join('/');
    const targetUrl = `https://dicionario2-dth.vlibras.gov.br/2018.3.1/WEBGL/${encodedPath}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!upstream.ok) {
        res.status(upstream.status).end();
        return;
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(buf);
    } catch {
      res.status(502).end();
    }
  });

  if (isProduction) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const indexHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(url, indexHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(transformed);
      } catch (err) {
        next(err);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sinaliza Libras server running on http://localhost:${PORT}`);
  });
}

startServer();
