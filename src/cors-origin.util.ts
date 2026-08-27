export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowedWeb = process.env.CORS_ORIGIN ?? 'http://localhost:5173',
): boolean {
  if (!origin) return true;
  if (origin === allowedWeb) return true;
  return (
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('moz-extension://')
  );
}

if (require.main === module) {
  const checks: Array<[string, boolean]> = [
    ['no origin', isAllowedCorsOrigin(undefined)],
    [
      'default web',
      isAllowedCorsOrigin('http://localhost:5173'),
    ],
    [
      'production web',
      isAllowedCorsOrigin(
        'https://ifo33mi1s8efs8myb5g441vh.72.60.59.203.sslip.io',
        'https://ifo33mi1s8efs8myb5g441vh.72.60.59.203.sslip.io',
      ),
    ],
    [
      'chrome extension',
      isAllowedCorsOrigin('chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef'),
    ],
    [
      'firefox extension',
      isAllowedCorsOrigin('moz-extension://12345678-1234-1234-1234-123456789abc'),
    ],
    [
      'other site refused',
      isAllowedCorsOrigin('https://evil.example') === false,
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(
      'cors-origin.util failed:',
      failed.map(([name]) => name).join(', '),
    );
    process.exit(1);
  }
  console.log(`cors-origin.util ok (${checks.length})`);
}
