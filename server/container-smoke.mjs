import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.TEST_ORIGIN || 'http://127.0.0.1:18787';
const json = async response => { assert.ok(response.ok, `Unexpected HTTP ${response.status}`); return response.json(); };
const login = await fetch(base + '/api/login', { method:'POST', headers:{Origin:base,'Content-Type':'application/json','X-Library-Request':'1'},body:JSON.stringify({password:process.env.ADMIN_PASSWORD}) });
assert.equal(login.status,200);
const headers={Origin:base,'Content-Type':'application/json','X-Library-Request':'1',Cookie:login.headers.get('set-cookie').split(';')[0]};
const state=await json(await fetch(base+'/api/admin/draft',{headers}));
if (process.argv.includes('--verify')) {
  const published=await json(await fetch(base+'/api/library'));
  assert.equal(published.library.comments.at(-1).text,'Container persistence smoke test');
  assert.equal(published.library.gallery.at(-1).description,'Uploaded image survives restart');
  const image=await fetch(base+published.library.gallery.at(-1).file);
  assert.equal(image.status,200); assert.ok((await image.arrayBuffer()).byteLength>100);
  console.log('Container restart retained content, image and login.');
} else {
  assert.equal(state.library.comments.length,35); assert.equal(state.library.posts.length,35); assert.equal(state.library.gallery.length,15);
  assert.equal((await fetch(base+'/admin')).status,200);
  assert.equal((await fetch(base+'/api/admin/draft')).status,401);
  state.library.comments.push({id:999,text:'Container persistence smoke test'});
  const saved=await json(await fetch(base+'/api/admin/draft',{method:'PUT',headers,body:JSON.stringify(state)}));
  assert.equal((await json(await fetch(base+'/api/library'))).library.comments.length,35);
  const upload=await json(await fetch(base+'/api/admin/upload',{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:fs.readFileSync(new URL('../public/tutorial/account.png',import.meta.url))}));
  state.library.gallery.push({id:999,title:'Container upload',description:'Uploaded image survives restart',file:upload.file,commentIds:[]});
  await json(await fetch(base+'/api/admin/publish',{method:'PUT',headers,body:JSON.stringify({library:state.library,version:saved.version})}));
  assert.equal((await json(await fetch(base+'/api/library'))).library.comments.length,36);
  console.log('Container login, draft, upload and publish passed.');
}
