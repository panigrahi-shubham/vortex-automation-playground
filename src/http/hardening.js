const helmet = require('helmet');
const pino = require('pino');
const { randomBytes, randomUUID } = require('node:crypto');

function configureHttp(app, production) {
  const log = pino({ level: process.env.VORTEX_LOG_LEVEL || (production ? 'info' : 'warn') });

  app.use((req, res, next) => {
    res.locals.vortexNonce = randomBytes(18).toString('base64');
    const requestId = randomUUID();
    const start = performance.now();
    res.setHeader('X-Request-Id', requestId);
    res.locals.vortexRequestId = requestId;
    res.once('finish', () => {
      // The request URL, query, body, and headers can contain credentials.
      log.info(
        {
          requestId,
          method: req.method,
          statusCode: res.statusCode,
          durationMs: Math.round(performance.now() - start),
        },
        'HTTP request',
      );
    });
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'", "'strict-dynamic'", (_req, res) => "'nonce-" + res.locals.vortexNonce + "'"],
          scriptSrcAttr: ["'none'"],
          // Existing widgets render their styles inline, including shadow root styles.
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'"],
          connectSrc: production
            ? ["'self'"]
            : ["'self'", 'ws://localhost:*', 'ws://127.0.0.1:*', 'ws://[::1]:*'],
          frameSrc: production ? ["'self'"] : ["'self'", 'http://127.0.0.1:3101'],
          frameAncestors: ["'self'"],
          formAction: ["'self'"],
          ...(production ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      referrerPolicy: { policy: production ? 'no-referrer' : 'strict-origin-when-cross-origin' },
      strictTransportSecurity: production ? undefined : false,
    }),
  );

  return {
    logError(res, error, event) {
      const code =
        typeof error?.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(error.code) ? error.code : undefined;
      log.error({ requestId: res.locals.vortexRequestId, code }, event);
    },
  };
}

function sendDocument(res, html) {
  const nonce = res.locals.vortexNonce;
  res.set('Cache-Control', 'no-store');
  res.type('html').send(html.replace(/<script(?=[\s>])/gi, '<script nonce="' + nonce + '"'));
}

module.exports = { configureHttp, sendDocument };
