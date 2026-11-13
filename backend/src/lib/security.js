export function securityHeaders() {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    }
    next()
  }
}

export function buildCorsOptions() {
  const configured = (process.env.CORS_ALLOWED_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const devDefaults = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3333', 'http://127.0.0.1:3333']
  const allowed = configured.length ? configured : process.env.NODE_ENV === 'production' ? [] : devDefaults

  return {
    origin(origin, callback) {
      if (!origin || allowed.includes(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true
  }
}

