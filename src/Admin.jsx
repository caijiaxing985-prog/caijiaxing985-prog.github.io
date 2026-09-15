import { useEffect, useState } from 'react';
import { api } from './api.js';
import { appendCommentImages, imagesForComment, setCommentImageLinked, unlinkImagesFromComment } from './commentImages.js';
import { sitePath } from './paths.js';
const labels = { comments: '评论', posts: '图文', gallery: '图片' };
export default function Admin() {
  const [loggedIn, setLoggedIn] = useState(false), [loading, setLoading] = useState(true);
  const [password, setPassword] = useState(''), [data, setData] = useState(null);
  const [version, setVersion] = useState(0), [publishedAt, setPublishedAt] = useState('');
  const [section, setSection] = useState('comments'), [selected, setSelected] = useState(null);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [query, setQuery] = useState('');
  const [showPassword, setShowPassword] = useState(false), [newPassword, setNewPassword] = useState(''), [currentPassword, setCurrentPassword] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const ask = (text, action) => setConfirmation({ text, action });
  const load = async () => {
    const result = await api('/api/admin/draft');
    setData(result.library); setVersion(result.version); setPublishedAt(result.publishedAt);
    setLoggedIn(true); setDirty(false); setSelected(null);
  };
  useEffect(() => { load().catch(e => { if (e.status !== 401) setError(e.message); }).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    const warn = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const run = async action => { setBusy(true); setError(''); setMessage(''); try { await action(); } catch (e) { setError(e.message); if (e.status === 401) setLoggedIn(false); } finally { setBusy(false); } };
  const login = e => { e.preventDefault(); run(async () => { await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) }); setPassword(''); await load(); }); };
  const items = data?.[section] || [], current = items.find(item => item.id === selected);
  const updateItems = next => { setData(previous => ({ ...previous, [section]: next })); setDirty(true); setMessage(''); };
  const edit = (key, value) => updateItems(items.map(item => item.id === selected ? { ...item, [key]: value } : item));
  const add = () => {
    const id = Math.max(0, ...items.map(item => item.id)) + 1;
    const item = section === 'comments' ? { id, text: '' } : section === 'posts' ? { id, direction: '', text: '', keywords: '' } : { id, title: '', description: '', file: '', commentIds: [] };
    updateItems([...items, item]); setSelected(id); setQuery('');
  };
  const move = delta => { const index = items.findIndex(item => item.id === selected); if (index < 0 || index + delta < 0 || index + delta >= items.length) return; const next = [...items]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; updateItems(next); };
  const removeCurrent = () => {
    if (section === 'comments') {
      setData(previous => ({ ...previous, comments: previous.comments.filter(item => item.id !== selected), gallery: unlinkImagesFromComment(previous.gallery, selected) }));
      setDirty(true); setMessage('');
    } else updateItems(items.filter(item => item.id !== selected));
    setSelected(null);
  };
  const save = publish => run(async () => {
    const result = await api(`/api/admin/${publish ? 'publish' : 'draft'}`, { method: 'PUT', body: JSON.stringify({ library: data, version }) });
    setVersion(result.version); setPublishedAt(result.publishedAt); setDirty(false);
    setMessage(publish ? '已发布，公开页面已更新。' : '草稿已保存，公开页面暂未改变。');
  });
  const upload = e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return; const id = selected;
    run(async () => {
      if (file.size > 15 * 1024 * 1024) throw new Error('每张图片不能超过 15 MB');
      const result = await api('/api/admin/upload', { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      setData(previous => ({ ...previous, gallery: previous.gallery.map(item => item.id === id ? { ...item, file: result.file, title: item.title || file.name.replace(/\.[^.]+$/, '') } : item) }));
      setDirty(true); setMessage('图片已上传，请保存草稿或发布。');
    });
  };
  const toggleCommentImage = (imageId, linked) => {
    setData(previous => ({ ...previous, gallery: setCommentImageLinked(previous.gallery, imageId, selected, linked) }));
    setDirty(true); setMessage('');
  };
  const uploadCommentImages = e => {
    const files = [...e.target.files]; e.target.value = ''; if (!files.length) return; const commentId = selected;
    run(async () => {
      if (files.some(file => file.size > 15 * 1024 * 1024)) throw new Error('每张图片不能超过 15 MB');
      let completed = 0;
      for (const file of files) {
        const result = await api('/api/admin/upload', { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
        setData(previous => ({ ...previous, gallery: appendCommentImages(previous.gallery, [{ file: result.file, name: file.name }], commentId) }));
        completed += 1; setDirty(true); setMessage(`已上传并关联 ${completed} 张图片，请保存草稿或发布。`);
      }
    });
  };
  if (loading) return <main className="admin-login">正在连接后台…</main>;
  if (!loggedIn) return <main className="admin-login"><h1>文案库管理</h1><p>登录后编辑文案和宣传图片</p><form onSubmit={login}><label>管理员密码<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={busy} className="copy-button">{busy ? '登录中…' : '登录'}</button></form>{error && <p role="alert" className="admin-error">{error}</p>}<a href={sitePath('/')}>查看公开页面</a></main>;
  return <div className="admin-shell">
    <header className="admin-header"><h1>文案库管理</h1><a href={sitePath('/')} target="_blank" rel="noreferrer">查看公开页面</a><button disabled={busy} onClick={() => setShowPassword(!showPassword)}>修改密码</button><button disabled={busy} onClick={() => { const logout = () => run(async () => { await api('/api/logout', { method: 'POST' }); setLoggedIn(false); setData(null); setDirty(false); }); if (dirty) ask('有未保存修改，确定退出？', logout); else logout(); }}>退出</button></header>
    <div className="admin-bar"><span>{dirty ? '有未保存修改' : '草稿已保存'}{publishedAt && ` · 上次发布 ${new Date(publishedAt).toLocaleString()}`}</span><button disabled={busy} onClick={() => { if (dirty) ask('重新载入会放弃未保存修改，是否继续？', () => run(load)); else run(load); }}>重新载入</button><button disabled={busy} onClick={() => save(false)}>保存草稿</button><button disabled={busy} className="copy-button" onClick={() => ask('将当前全部文案和图片发布到公开页面？', () => save(true))}>发布更新</button></div>
    {confirmation && <div className="confirm-backdrop"><section role="dialog" aria-modal="true" aria-label="确认操作" className="confirm-box"><p>{confirmation.text}</p><button autoFocus onClick={() => setConfirmation(null)}>取消</button><button className="copy-button" onClick={() => { const action = confirmation.action; setConfirmation(null); action(); }}>确认</button></section></div>}
    <div aria-live="polite">{message && <p className="admin-message">{message}</p>}{error && <p role="alert" className="admin-error">{error}</p>}</div>
    {showPassword && <form className="admin-password" onSubmit={e => { e.preventDefault(); run(async () => { await api('/api/admin/password', { method: 'PUT', body: JSON.stringify({ currentPassword, password: newPassword }) }); setNewPassword(''); setCurrentPassword(''); setLoggedIn(false); }); }}><label>当前密码<input type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label><label>新密码（至少 12 个字符）<input type="password" autoComplete="new-password" required minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><button disabled={busy || dirty}>修改并重新登录</button>{dirty && <p>请先保存草稿，再修改密码。</p>}</form>}
    <div className="admin-tabs">{Object.entries(labels).map(([key, label]) => <button key={key} className={section === key ? 'active' : ''} disabled={busy} onClick={() => { setSection(key); setSelected(null); setQuery(''); }}>{label} {data[key].length}</button>)}</div>
    <fieldset disabled={busy} className="admin-layout"><aside className="admin-list"><button className="copy-button" onClick={add}>新增{labels[section]}</button><input aria-label="查找内容" placeholder="查找内容" value={query} onChange={e => setQuery(e.target.value)} />{items.filter(item => `${item.id} ${item.text || item.title || ''}`.toLowerCase().includes(query.toLowerCase())).map(item => <button key={item.id} className={`admin-row ${selected === item.id ? 'selected' : ''}`} onClick={() => setSelected(item.id)}><span>#{item.id}</span><span>{(item.title || item.text || '未填写内容').slice(0, 70)}</span></button>)}</aside>
      <section className="admin-editor">{current ? <><div className="editor-tools"><strong>{labels[section]} #{current.id}</strong><button disabled={items[0].id === current.id} onClick={() => move(-1)}>上移</button><button disabled={items.at(-1).id === current.id} onClick={() => move(1)}>下移</button><button className="delete-button" onClick={() => ask('从当前草稿删除这一条？发布后公开页面才会删除。', removeCurrent)}>删除</button></div>
        {section === 'gallery' ? <><label>图片名称<input value={current.title} maxLength={200} onChange={e => edit('title', e.target.value)} /></label><label>介绍<textarea rows={4} value={current.description || ''} onChange={e => edit('description', e.target.value)} /></label><label>上传 / 替换图片（最大 15 MB）<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={upload} /></label>{current.file && <img className="admin-preview" src={sitePath(current.file)} alt={current.title || '图片预览'} />}<label>关联评论序号（可选，用逗号分隔）<input key={current.id} defaultValue={current.commentIds.join(', ')} onBlur={e => { const raw = e.target.value.trim(); const values = raw ? raw.split(/[,，\s]+/).map(Number) : []; if (values.every(n => Number.isSafeInteger(n) && n > 0)) edit('commentIds', values); else { setError('关联序号请填写正整数'); e.target.value = current.commentIds.join(', '); } }} /></label></> : <>{section === 'posts' && <label>内容方向<input value={current.direction} onChange={e => edit('direction', e.target.value)} /></label>}<label>文案正文<textarea rows={12} value={current.text} onChange={e => edit('text', e.target.value)} /></label>{section === 'posts' && <label>关键词 / 话题<textarea rows={4} value={current.keywords} onChange={e => edit('keywords', e.target.value)} /></label>}{section === 'comments' && <section className="comment-image-admin" aria-label="评论配图管理"><div className="comment-image-admin-heading"><strong>评论配图</strong><span>已选择 {imagesForComment(data.gallery, current.id).length} 张</span></div><label className="comment-image-upload">直接上传配图（可多选，每张最大 15 MB）<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadCommentImages} /></label>{data.gallery.length ? <div className="comment-image-options">{data.gallery.map(image => { const linked = image.commentIds.includes(current.id); return <label key={image.id} className={linked ? 'linked' : ''}><input type="checkbox" checked={linked} onChange={e => toggleCommentImage(image.id, e.target.checked)} /><img src={sitePath(image.file)} alt="" loading="lazy" /><span>#{image.id} {image.title}</span></label>; })}</div> : <p>还没有图片，请直接上传。</p>}</section>}</>}
      </> : <p>选择左侧内容编辑，或点击“新增”。排序按上移、下移调整，保存草稿后点击“发布更新”。</p>}</section>
    </fieldset>
  </div>;
}
