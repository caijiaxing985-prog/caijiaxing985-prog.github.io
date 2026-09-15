export function getBasePath(pathname = window.location.pathname) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/' || normalized === '/admin') return '';
  return normalized.endsWith('/admin') ? normalized.slice(0, -6) : normalized;
}

export function sitePath(resource, pathname = window.location.pathname) {
  const path = resource.startsWith('/') ? resource : `/${resource}`;
  return `${getBasePath(pathname)}${path}`;
}

export function isAdminPath(pathname = window.location.pathname) {
  return (pathname.replace(/\/+$/, '') || '/') === `${getBasePath(pathname)}/admin`;
}
