export function validateProductionConfig(env) {
  if (String(env.VITE_USE_MOCK_API ?? 'false').trim().toLowerCase() !== 'false') {
    throw new Error('Production builds require VITE_USE_MOCK_API=false');
  }
  const url = new URL(env.VITE_API_BASE_URL || 'https://api.gamma-tech.ir');
  // This release targets the existing production API, not arbitrary endpoints.
  if (url.origin !== 'https://api.gamma-tech.ir' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Production API must be https://api.gamma-tech.ir');
  }
}
