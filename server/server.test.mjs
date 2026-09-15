import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLibraryServer } from './server.mjs';

test('authenticated editing, draft isolation, publish, uploads and restart persistence', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jianyoon-test-'));
  const seed = { comments: [{ id: 1, text: '原文\n第二行' }], posts: [{ id: 1, text: '图文', direction: '介绍', keywords: '#测试' }], gallery: [] };
  const password = 'test-only-not-deployed-891';
  let server, address, auth = '';
  const start = async () => {
    server = createLibraryServer({ dataDir, seed, password });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    address = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = () => new Promise(resolve => server.close(resolve));
  const request = (url, method = 'GET', input, extra = {}) => fetch(address + url, { method, headers: { ...(auth ? { Cookie: auth } : {}), Origin: address, 'X-Library-Request': '1', ...(input ? { 'Content-Type': 'application/json' } : {}), ...extra }, body: input ? JSON.stringify(input) : undefined });
  try {
    await start();
    assert.equal((await request('/api/admin/draft')).status, 401);
    assert.equal((await request('/api/admin/publish', 'PUT', {})).status, 401);
    assert.equal((await request('/api/login', 'POST', { password: 'wrong' })).status, 401);
    assert.equal((await request('/api/login', 'POST', { password }, { Origin: 'https://other.example' })).status, 403);
    const login = await request('/api/login', 'POST', { password });
    assert.equal(login.status, 200); assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    auth = login.headers.get('set-cookie').split(';')[0];
    const draft = await (await request('/api/admin/draft')).json();
    draft.library.comments.push({ id: 2, text: '新增评论 <@>jianyoon' });
    draft.library.comments.reverse(); draft.library.posts[0].text = '修改后的图文';
    let saved = await request('/api/admin/draft', 'PUT', draft);
    assert.equal(saved.status, 200); let revision = (await saved.json()).version;
    assert.deepEqual((await (await request('/api/library')).json()).library, seed);
    assert.equal((await request('/api/admin/publish', 'PUT', draft)).status, 409);
    const bad = structuredClone(draft.library); bad.comments.push(bad.comments[0]);
    assert.equal((await request('/api/admin/draft', 'PUT', { library: bad, version: revision })).status, 400);
    const bytes = fs.readFileSync(new URL('../public/tutorial/account.png', import.meta.url));
    const uploaded = await fetch(address + '/api/admin/upload', { method: 'POST', headers: { Cookie: auth, Origin: address, 'X-Library-Request': '1', 'Content-Type': 'image/png' }, body: bytes });
    assert.equal(uploaded.status, 201); const { file } = await uploaded.json();
    assert.equal((await fetch(address + file)).status, 404);
    assert.equal((await request(file)).status, 200);
    const rejected = await fetch(address + '/api/admin/upload', { method: 'POST', headers: { Cookie: auth, Origin: address, 'X-Library-Request': '1' }, body: '<svg onload="alert(1)"></svg>' });
    assert.equal(rejected.status, 415);
    const traversal = structuredClone(draft.library); traversal.gallery = [{ id:1,title:'bad',description:'',commentIds:[],file:'/uploads/../../library.sqlite' }];
    assert.equal((await request('/api/admin/draft','PUT',{ library:traversal,version:revision })).status,400);
    draft.library.gallery.push({ id:1,title:'自定义名称',description:'自定义介绍\n第二行',commentIds:[2],file });
    const published = await request('/api/admin/publish', 'PUT', { library: draft.library, version: revision });
    assert.equal(published.status, 200); revision = (await published.json()).version;
    assert.deepEqual((await (await request('/api/library')).json()).library, draft.library);
    assert.deepEqual(Buffer.from(await (await fetch(address + file)).arrayBuffer()), bytes);
    assert.equal((await request('/api/library')).headers.get('cache-control'), 'no-store');
    await stop(); await start();
    assert.deepEqual((await (await request('/api/library')).json()).library, draft.library);
    draft.library.gallery = []; draft.library.comments.splice(0,1);
    assert.equal((await request('/api/admin/publish','PUT',{ library:draft.library,version:revision })).status,200);
    assert.equal((await fetch(address + file)).status,404);
    assert.equal((await (await request('/api/library')).json()).library.comments.length,1);
    const changed = await request('/api/admin/password','PUT',{ currentPassword:password,password:'replacement-password-234' });
    assert.equal(changed.status,200);
    assert.equal((await request('/api/admin/draft')).status,401);
    assert.equal((await request('/api/login','POST',{password})).status,401);
    assert.equal((await request('/api/login','POST',{password:'replacement-password-234'})).status,200);
    for(let i=0;i<8;i++) await request('/api/login','POST',{password:'wrong'});
    assert.equal((await request('/api/login','POST',{password:'wrong'})).status,429);
    await stop(); server = null;
  } finally { if(server?.listening) await stop(); fs.rmSync(dataDir,{recursive:true,force:true}); }
});

test('uses the full public URL in share metadata for a subdirectory deployment', async () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jianyoon-origin-test-'));
  const dataDir = path.join(testDir, 'data');
  const staticDir = path.join(testDir, 'dist');
  fs.mkdirSync(staticDir);
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<meta property="og:url" content="old" /><meta property="og:image" content="https://caijiaxing985-prog.github.io/share-cover.png" />');
  const server = createLibraryServer({
    dataDir,
    staticDir,
    password: 'test-only-not-deployed-891',
    origin: 'https://jianyoon.com/wenan',
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = `http://127.0.0.1:${server.address().port}`;
    const html = await (await fetch(address)).text();
    assert.match(html, /<meta property="og:url" content="https:\/\/jianyoon\.com\/wenan" \/>/);
    assert.match(html, /<meta property="og:image" content="https:\/\/jianyoon\.com\/wenan\/share-cover\.png" \/>/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
