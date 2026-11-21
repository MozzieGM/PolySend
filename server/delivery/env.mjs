import fs from 'node:fs/promises';
import path from 'node:path';

const KEY_LINE = /^\s*RESEND_API_KEY\s*=.*$/m;

export async function persistResendKey(key, envPath) {
  let content = '';
  try {
    content = await fs.readFile(envPath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const line = `RESEND_API_KEY=${key}`;
  let next;
  if (KEY_LINE.test(content)) {
    next = content.replace(KEY_LINE, line);
  } else {
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    next = content;
    if (next && !next.endsWith(eol)) next += eol;
    next += `${line}${eol}`;
  }

  const tempPath = path.join(
    path.dirname(envPath),
    `.${path.basename(envPath)}.${process.pid}.tmp`,
  );
  await fs.writeFile(tempPath, next, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tempPath, envPath);
}
