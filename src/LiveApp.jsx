import { useEffect, useState } from 'react';
import App from './App.jsx';
import Admin from './Admin.jsx';
import { api } from './api.js';
import { isAdminPath } from './paths.js';
export default function LiveApp() {
  const admin = isAdminPath();
  const [library, setLibrary] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    if (admin) return; let live = true;
    const refresh = () => api('/api/library').then(result => { if (live) { setLibrary(result.library); setError(''); } }).catch(() => { if (live) setError('暂时无法获取最新内容，请刷新或稍后重试。'); });
    refresh(); const timer = setInterval(refresh, 15000); window.addEventListener('focus', refresh);
    return () => { live = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [admin]);
  if (admin) return <Admin />;
  if (!library) return <main className="admin-login">{error || '正在加载文案库…'}{error && <button onClick={() => window.location.reload()}>重新加载</button>}</main>;
  return <>{error && <p role="status" className="admin-error">{error}</p>}<App library={library} /></>;
}
