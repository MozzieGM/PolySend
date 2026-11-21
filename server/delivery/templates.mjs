function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function textToHtml(text) {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const body = blocks
    .map(
      (block) =>
        `<p style="margin:0 0 16px;white-space:normal;">${escapeHtml(block).replaceAll('\n', '<br />')}</p>`,
    )
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background-color:#f4f1e9;">
    <div style="padding:32px 16px;background-color:#f4f1e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#20231d;">
      <div style="max-width:600px;margin:0 auto;padding:32px;background-color:#fffdf8;border-radius:14px;">
        ${body}
      </div>
    </div>
  </body>
</html>`;
}


