export const WIREFRAME_HTML_MAX_CHARS = 200_000;

/** Two-screen grayscale starter. Screens: #page-home ↔ #page-next. */
export const DEFAULT_WIREFRAME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Wireframe</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px/1.4 system-ui, sans-serif; color: #333; background: #e8e8e8; }
    section[id^="page-"] { display: none; min-height: 100vh; padding: 24px; }
    section.is-active { display: block; }
    .box { background: #d0d0d0; border: 1px solid #999; padding: 16px; margin: 0 0 12px; }
    .box-header { background: #bdbdbd; font-weight: 700; }
    a { color: #333; }
  </style>
</head>
<body>
  <section id="page-home" class="is-active">
    <div class="box box-header">Header</div>
    <div class="box">Content</div>
    <p><a href="#page-next">Next page</a></p>
  </section>
  <section id="page-next">
    <div class="box box-header">Header</div>
    <div class="box">Content</div>
    <p><a href="#page-home">Back to Home</a></p>
  </section>
  <script>
  (function () {
    var pages = document.querySelectorAll('section[id^="page-"]');
    function show(hash) {
      var id = (hash || '#page-home').replace(/^#/, '') || 'page-home';
      if (!document.getElementById(id)) id = 'page-home';
      pages.forEach(function (el) {
        el.classList.toggle('is-active', el.id === id);
      });
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#page-"]');
      if (!a) return;
      e.preventDefault();
      show(a.getAttribute('href'));
    });
    show(location.hash);
  })();
  </script>
</body>
</html>
`;

export function assertWireframeHtml(html: string): string {
  if (html.length > WIREFRAME_HTML_MAX_CHARS) {
    throw new Error(
      `html must be at most ${WIREFRAME_HTML_MAX_CHARS} characters`,
    );
  }
  const lower = html.toLowerCase();
  if (!lower.includes('<!doctype') && !lower.includes('<html')) {
    throw new Error('html must contain <!DOCTYPE or <html');
  }
  return html;
}

if (require.main === module) {
  const html = assertWireframeHtml(DEFAULT_WIREFRAME_HTML);
  const required = [
    'page-home',
    'page-next',
    'Next page',
    'Back to Home',
    'noindex',
    '<!DOCTYPE',
  ];
  for (const token of required) {
    if (!html.includes(token)) {
      throw new Error(`default html missing ${token}`);
    }
  }
  try {
    assertWireframeHtml('not html');
    throw new Error('expected reject');
  } catch (err) {
    if (err instanceof Error && err.message === 'expected reject') throw err;
  }
  console.log('default-wireframe-html self-check passed');
}
