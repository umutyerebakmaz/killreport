import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseEveHtml, sanitizeEveHtml } from './eveHtmlParser';

describe('parseEveHtml', () => {
  it('returns an empty string for null, undefined and empty input', () => {
    expect(parseEveHtml(null)).toBe('');
    expect(parseEveHtml(undefined)).toBe('');
    expect(parseEveHtml('')).toBe('');
  });

  it("strips the Python u'...' wrapper and surrounding whitespace", () => {
    expect(parseEveHtml("  u'Hello'  ")).toBe('Hello');
    expect(parseEveHtml("u'unterminated")).toBe("u'unterminated");
  });

  it('decodes \\uXXXX escapes', () => {
    expect(parseEveHtml('A\\u2501B \\u00e9')).toBe('A\u2501B \u00e9');
  });

  it("drops EVE's <loc> wrapper but keeps its content", () => {
    expect(parseEveHtml('<loc>Jita</loc> and <LOC>Amarr</LOC>')).toBe(
      'Jita and Amarr',
    );
  });

  it('makes links open in a new tab with rel and class set', () => {
    expect(parseEveHtml('<a href="https://example.com/x">site</a>')).toBe(
      '<a href="https://example.com/x" target="_blank" rel="noopener noreferrer" class="eve-link">site</a>',
    );
  });

  it('only rewrites links whose sole attribute is href', () => {
    expect(parseEveHtml('<a href="https://e.com" onclick="x()">l</a>')).toBe(
      '<a href="https://e.com" onclick="x()">l</a>',
    );
  });

  it('converts <color=0xAARRGGBB> to an rgba span', () => {
    expect(parseEveHtml('<color=0xffff1400>red</color>')).toBe(
      '<span style="color: rgba(255, 20, 0, 1);">red</span>',
    );
    expect(parseEveHtml('<color=0x8000ff00>half green</color>')).toBe(
      `<span style="color: rgba(0, 255, 0, ${128 / 255});">half green</span>`,
    );
  });

  it('converts <font size color> to a sized rgba span, scaling the size by 0.85', () => {
    expect(parseEveHtml('<font size="14" color="#bfffffff">text</font>')).toBe(
      `<span style="font-size: 12px; color: rgba(255, 255, 255, ${191 / 255});">text</span>`,
    );
  });

  it('handles a color tag nested inside a font tag', () => {
    expect(
      parseEveHtml(
        '<font size="12" color="#ffffffff"><color=0xff00ff00>inner</color> outer</font>',
      ),
    ).toBe(
      '<span style="font-size: 10px; color: rgba(255, 255, 255, 1);">' +
        '<span style="color: rgba(0, 255, 0, 1);">inner</span> outer</span>',
    );
  });

  it('normalises every <br> form to a bare <br>', () => {
    expect(parseEveHtml('a<br/>b<br />c<BR>d')).toBe('a<br>b<br>c<br>d');
  });

  it('leaves tags it does not know about untouched, so it is not a sanitiser on its own', () => {
    expect(parseEveHtml('<b>bold</b><script>x()</script>')).toBe(
      '<b>bold</b><script>x()</script>',
    );
  });
});

describe('sanitizeEveHtml', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps span, a and br with their allowed attributes', () => {
    const input =
      '<font size="14" color="#ffffffff">hi</font><br/><a href="https://e.com">l</a>';

    expect(sanitizeEveHtml(input)).toBe(
      '<span style="font-size: 12px; color: rgba(255, 255, 255, 1);">hi</span><br>' +
        '<a href="https://e.com" target="_blank" rel="noopener noreferrer" class="eve-link">l</a>',
    );
  });

  it('replaces disallowed tags with their text content', () => {
    expect(
      sanitizeEveHtml('<b>bold</b> <script>x()</script> <img src=x>'),
    ).toBe('bold x() ');
  });

  it('unwraps a disallowed tag nested inside an allowed one', () => {
    expect(sanitizeEveHtml('<color=0xffffffff><i>it</i></color>')).toBe(
      '<span style="color: rgba(255, 255, 255, 1);">it</span>',
    );
  });

  it('strips attributes outside the allow list, including event handlers', () => {
    const temp = document.createElement('div');
    temp.innerHTML = sanitizeEveHtml(
      '<a href="https://e.com" onclick="x()" id="k" style="color: red;">l</a>',
    );
    const link = temp.querySelector('a')!;

    expect(link.getAttribute('onclick')).toBeNull();
    expect(link.getAttribute('id')).toBeNull();
    expect(link.getAttribute('href')).toBe('https://e.com');
    expect(link.getAttribute('style')).toBe('color: red;');
  });

  it('returns the parsed HTML unchanged when there is no DOM', () => {
    vi.stubGlobal('window', undefined);

    expect(sanitizeEveHtml('<b>bold</b>')).toBe('<b>bold</b>');
  });
});
