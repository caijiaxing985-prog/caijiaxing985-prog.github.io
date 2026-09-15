import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_JSON = 4 * 1024 * 1024;
const MAX_IMAGE = 15 * 1024 * 1024;
const fail = (status, message) => Object.assign(new Error(message), { status });
const hash = value => createHash('sha256').update(value).digest('hex');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

async function body(req, max) {
  if (Number(req.headers['content-length']) > max) throw fail(413, '文件或内容太大');
  const parts = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw fail(413, '文件或内容太大');
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}
async function jsonBody(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, '需要 JSON 数据');
  try { const parsed = JSON.parse((await body(req, MAX_JSON)).toString('utf8')); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw fail(400, '需要对象格式的数据'); return parsed; }
  catch (e) { if (e.status) throw e; throw fail(400, '数据格式不正确'); }
}
function imageExtension(data) {
  if (data.length >= 24 && data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return '.png';
  if (data.length >= 4 && data[0] === 255 && data[1] === 216 && data[2] === 255) return '.jpg';
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  if (data.length >= 13 && ['GIF87a', 'GIF89a'].includes(data.toString('ascii', 0, 6))) return '.gif';
  throw fail(415, '只支持 PNG、JPG、WebP、GIF 图片');
}

export function createLibraryServer(options = {}) {
  const dataDir = path.resolve(options.dataDir || process.env.DATA_DIR || path.join(project, 'data'));
  const staticDir = path.resolve(options.staticDir || path.join(project, 'dist'));
  const configuredOrigin = options.origin ?? process.env.PUBLIC_ORIGIN ?? '';
  const publicUrl = configuredOrigin ? configuredOrigin.replace(/\/$/, '') : '';
  const origin = publicUrl ? new URL(publicUrl).origin : '';
  const secure = origin.startsWith('https://');
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'library.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS library (id INTEGER PRIMARY KEY CHECK(id=1), draft TEXT NOT NULL, published TEXT NOT NULL, version INTEGER NOT NULL, published_at TEXT);
    CREATE TABLE IF NOT EXISTS login_limit (id INTEGER PRIMARY KEY CHECK(id=1), attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);`);
  if (!db.prepare('SELECT id FROM admin').get()) {
    const password = options.password || process.env.ADMIN_PASSWORD;
    if (typeof password !== 'string' || password.length < 12 || password.length > 200) { db.close(); throw new Error('首次启动需设置 ADMIN_PASSWORD（12–200 个字符），无默认密码。'); }
    const salt = randomBytes(24).toString('hex');
    db.prepare('INSERT INTO admin VALUES (1,?,?)').run(salt, scryptSync(password, salt, 64).toString('hex'));
  }
  if (!db.prepare('SELECT id FROM library').get()) {
    const initial = options.seed || JSON.parse(fs.readFileSync(path.join(project, 'server/seed.json'), 'utf8'));
    const encoded = JSON.stringify(initial);
    db.prepare('INSERT INTO library VALUES(1,?,?,1,?)').run(encoded, encoded, new Date().toISOString());
  }
  const state = () => db.prepare('SELECT * FROM library WHERE id=1').get();
  const session = req => {
    const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('library_session='));
    if (!cookie) return null;
    const token = cookie.slice('library_session='.length);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    return db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(hash(token), Date.now());
  };
  const cookie = (token, age = 43200) => `library_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const validate = data => {
    if (!data || typeof data !== 'object') throw fail(400, '内容不能为空');
    const text = (v, max, required = false) => {
      if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw fail(400, '名称或文案为空，或超过长度限制');
      return v;
    };
    const result = {};
    for (const key of ['comments', 'posts', 'gallery']) {
      if (!Array.isArray(data[key]) || data[key].length > 2000) throw fail(400, '每类最多 2000 条');
      const ids = new Set();
      result[key] = data[key].map(item => {
        if (!item || !Number.isSafeInteger(item.id) || item.id < 1 || ids.has(item.id)) throw fail(400, '序号必须为不重复的正整数');
        ids.add(item.id);
        if (key === 'comments') return { id: item.id, text: text(item.text, 10000, true) };
        if (key === 'posts') return { id: item.id, direction: text(item.direction, 100), text: text(item.text, 20000, true), keywords: text(item.keywords, 5000) };
        const file = text(item.file, 200, true);
        if (!/^\/(gallery\/gallery-\d+\.png|uploads\/[a-f0-9]{32}\.(png|jpg|webp|gif))$/.test(file)) throw fail(400, '图片路径不正确');
        const actual = file.startsWith('/uploads/') ? path.join(dataDir, file) : path.join(staticDir, file);
        if (!fs.existsSync(actual)) throw fail(400, '图片文件不存在，请重新上传');
        if (!Array.isArray(item.commentIds) || item.commentIds.length > 2000 || !item.commentIds.every(id => Number.isSafeInteger(id) && id > 0)) throw fail(400, '关联评论序号不正确');
        return { id: item.id, title: text(item.title, 200, true), description: text(item.description ?? '', 5000), file, commentIds: [...new Set(item.commentIds)] };
      });
    }
    return result;
  };

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname;
      if (route === '/api/health' && req.method === 'GET') return send(200, { ok: true });
      if (route === '/api/library' && req.method === 'GET') { const row = state(); return send(200, { library: JSON.parse(row.published), publishedAt: row.published_at }); }
      if (route.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(req.method)) {
          const expectedOrigin = origin || `http://${req.headers.host}`;
          if (req.headers.origin !== expectedOrigin || req.headers['x-library-request'] !== '1') throw fail(403, '请求来源不正确，请从本站后台操作');
        }
        if (route === '/api/login' && req.method === 'POST') {
          const limit = db.prepare('SELECT * FROM login_limit WHERE id=1').get();
          if (limit && limit.reset_at > Date.now() && limit.attempts >= 8) throw fail(429, '尝试次数过多，请 15 分钟后再试');
          const input = await jsonBody(req);
          const admin = db.prepare('SELECT * FROM admin WHERE id=1').get();
          const password = typeof input.password === 'string' && input.password.length <= 200 ? input.password : '';
          const matches = timingSafeEqual(scryptSync(password, admin.salt, 64), Buffer.from(admin.password_hash, 'hex'));
          if (!matches) {
            const active = limit && limit.reset_at > Date.now();
            db.prepare('INSERT OR REPLACE INTO login_limit VALUES(1,?,?)').run(active ? limit.attempts + 1 : 1, active ? limit.reset_at : Date.now() + 900000);
            throw fail(401, '密码不正确');
          }
          db.prepare('DELETE FROM login_limit').run();
          db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
          const token = randomBytes(32).toString('hex');
          db.prepare('INSERT INTO sessions VALUES (?,?)').run(hash(token), Date.now() + 43200000);
          res.setHeader('Set-Cookie', cookie(token));
          return send(200, { ok: true });
        }
        const currentSession = session(req);
        if (!currentSession) throw fail(401, '请先登录管理后台');
        if (route === '/api/logout' && req.method === 'POST') { db.prepare('DELETE FROM sessions WHERE token=?').run(currentSession.token); res.setHeader('Set-Cookie', cookie('', 0)); return send(200, { ok: true }); }
        if (route === '/api/admin/draft' && req.method === 'GET') { const row = state(); return send(200, { library: JSON.parse(row.draft), version: row.version, publishedAt: row.published_at }); }
        if (['/api/admin/draft', '/api/admin/publish'].includes(route) && req.method === 'PUT') {
          const input = await jsonBody(req);
          const validated = validate(input.library);
          if (!Number.isSafeInteger(input.version) || input.version < 1) throw fail(400, '草稿版本不正确，请重新载入');
          const encoded = JSON.stringify(validated);
          let changed;
          if (route.endsWith('publish')) {
            changed = db.prepare('UPDATE library SET draft=?,published=?,version=version+1,published_at=? WHERE id=1 AND version=?').run(encoded, encoded, new Date().toISOString(), input.version);
          } else { changed = db.prepare('UPDATE library SET draft=?,version=version+1 WHERE id=1 AND version=?').run(encoded, input.version); }
          if (!changed.changes) throw fail(409, '草稿已在其他窗口更新，请先重新载入，避免覆盖');
          const row = state();
          return send(200, { version: row.version, publishedAt: row.published_at });
        }
        if (route === '/api/admin/upload' && req.method === 'POST') {
          const bytes = await body(req, MAX_IMAGE);
          const ext = imageExtension(bytes);
          const name = `${randomBytes(16).toString('hex')}${ext}`;
          fs.writeFileSync(path.join(dataDir, 'uploads', name), bytes, { flag: 'wx', mode: 0o600 });
          return send(201, { file: `/uploads/${name}` });
        }
        if (route === '/api/admin/password' && req.method === 'PUT') {
          const input = await jsonBody(req);
          if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 200) throw fail(400, '新密码需 12–200 个字符');
          const admin = db.prepare('SELECT * FROM admin WHERE id=1').get();
          if (typeof input.currentPassword !== 'string' || input.currentPassword.length > 200 || !timingSafeEqual(scryptSync(input.currentPassword, admin.salt, 64), Buffer.from(admin.password_hash, 'hex'))) throw fail(401, '当前密码不正确');
          const salt = randomBytes(24).toString('hex');
          db.prepare('UPDATE admin SET salt=?,password_hash=? WHERE id=1').run(salt, scryptSync(input.password, salt, 64).toString('hex'));
          db.prepare('DELETE FROM sessions').run(); res.setHeader('Set-Cookie', cookie('', 0));
          return send(200, { ok: true });
        }
        throw fail(404, '接口不存在');
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw fail(405, '不支持的操作');
      const decoded = decodeURIComponent(route);
      let file;
      if (decoded.startsWith('/uploads/')) {
        if (!/^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp|gif)$/.test(decoded)) throw fail(404, '图片不存在');
        if (!session(req) && !JSON.parse(state().published).gallery.some(item => item.file === decoded)) throw fail(404, '图片尚未发布');
        file = path.join(dataDir, decoded);
      } else {
        const relative = ['/', '/admin', '/admin/'].includes(decoded) ? 'index.html' : decoded.replace(/^\//, '');
        file = path.resolve(staticDir, relative);
        if (!file.startsWith(staticDir + path.sep)) throw fail(404, '文件不存在');
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw fail(404, '文件不存在');
      if (file.endsWith('index.html')) {
        let html = fs.readFileSync(file, 'utf8');
        html = html.replace('https://caijiaxing985-prog.github.io/share-cover.png', publicUrl ? `${publicUrl}/share-cover.png` : '/share-cover.png');
        html = html.replace(/<meta property="og:url"[^>]*>/, publicUrl ? `<meta property="og:url" content="${publicUrl}" />` : '');
        res.writeHead(200, { 'Content-Type': mime['.html'] }); return res.end(req.method === 'HEAD' ? undefined : html);
      }
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      res.setHeader('Content-Length', fs.statSync(file).size);
      if (decoded.startsWith('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      if (!res.headersSent) send(error.status || 500, { error: error.status ? error.message : '服务暂时不可用，请重试' });
      else res.destroy();
      if (!error.status) console.error('Request error:', error.message);
    }
  });
  server.requestTimeout = 30000;
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createLibraryServer();
  const port = Number(process.env.PORT || 8787);
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`文案库已启动，端口 ${port}；管理入口 /admin`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
