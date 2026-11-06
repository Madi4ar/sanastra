/** Форматированный текст: разрешён только простой набор тегов, ссылки — http(s). Всё остальное вырезается. */
const ALLOWED = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'A']);
const DROPPED = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH']);

function clean(node: Element) {
  [...node.children].forEach((child) => {
    if (DROPPED.has(child.tagName.toUpperCase())) {
      child.remove();
      return;
    }
    clean(child);
    if (!ALLOWED.has(child.tagName.toUpperCase())) {
      child.replaceWith(...child.childNodes);
      return;
    }
    const href = child.tagName === 'A' ? child.getAttribute('href') : null;
    [...child.attributes].forEach((a) => child.removeAttribute(a.name));
    if (child.tagName === 'A') {
      if (href && /^https?:\/\//i.test(href)) {
        child.setAttribute('href', href);
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      } else {
        child.replaceWith(...child.childNodes);
      }
    }
  });
}

export function sanitizeRichText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  clean(doc.body);
  return doc.body.innerHTML;
}

/** Текст без разметки: для проверки обязательности */
export function richTextToPlain(html: string): string {
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').trim();
}
