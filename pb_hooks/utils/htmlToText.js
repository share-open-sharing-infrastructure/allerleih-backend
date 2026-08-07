/**
 * #607 mail deliverability — HTML → plaintext converter for the mailer's `text` alternative.
 *
 * Pure function, no PocketBase globals — directly unit-testable from Node (tests/html-to-text.test.mjs).
 *
 * Converts OUR OWN, known mail-content markup (p, strong, h3, a, img, br, table/tr/td) — never
 * arbitrary third-party HTML, and never a full `<html>` document (the layout's own <style>/<head>
 * are not run through this; only the CONTENT fragment injected into it is). That is what makes a
 * ~60-line regex converter sufficient instead of needing a DOM.
 *
 * Contract (see #607 plan section 2.3; </td>/</table> added by the #607 B1 fix — see below):
 *   - <a href="X">Y</a>                  → "Y (X)"  (identical X/Y → just X)
 *   - <a href="X">…no text…</a>          → dropped entirely (see below)
 *   - <br>, </p>, </h3>, </tr>, </td>,
 *     </table>                          → line break (a RUN of adjacent closing tags from this
 *                                          set collapses to exactly ONE line break, not one per
 *                                          tag — see renderItemList()'s "</td></tr></table>")
 *   - <img …>                            → dropped (no visual channel in plaintext)
 *   - <style>/<script>/<head>            → dropped whole, incl. content (safety net)
 *   - remaining tags                     → stripped
 *   - entities: &amp; &lt; &gt; &quot; &#39; &nbsp; &mdash; &ndash; &rarr;
 *               &auml; &ouml; &uuml; &Auml; &Ouml; &Uuml; &szlig;
 *   - 3+ blank lines collapse to 2; trailing whitespace per line and around the result is trimmed
 *
 * #607 B1 (found in review): two bugs made every item-with-image row in the weekly digest
 * unreadable in plaintext —
 *   1. </td> and </table> were NOT line-break boundaries (only </tr> was), so a text cell sitting
 *      right after an image cell in the same row glued straight onto it with no separator at all.
 *   2. An image-only link ("<a href="X"><img alt="…"></a>", no direct text node — alt is an
 *      attribute, not text) has an empty label after stripping nested tags, and used to fall back
 *      to the bare URL ("X"). That URL always reappears seconds later via the adjacent item-name
 *      link with the identical href, so showing it here too is pure duplication, not information
 *      — such links are now dropped entirely instead.
 */
function htmlToText(html) {
    if (!html) return ''

    let text = String(html)

    // Safety net: entire blocks whose content must never leak into the plaintext part.
    text = text.replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, '')

    // Links: "<a href="X">Y</a>" → "Y (X)". Identical text/href (e.g. a bare URL wrapped in its
    // own link) collapses to just the URL, avoiding "https://x (https://x)". A link with NO text
    // content at all (e.g. an image-only link) is dropped entirely — see the #607 B1 note above
    // for why that beats falling back to the bare URL.
    text = text.replace(/<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_match, _q, href, inner) => {
        const label = inner.replace(/<[^>]+>/g, '').trim()
        if (!label) return ''
        const url = href.trim()
        return label !== url ? `${label} (${url})` : url
    })

    // Images never survive as plaintext — nothing meaningful to show without a visual channel.
    text = text.replace(/<img\b[^>]*>/gi, '')

    // Block-level boundaries become line breaks.
    text = text.replace(/<br\s*\/?>/gi, '\n')
    // Closing container tags (paragraphs/headings/table rows/cells/tables). A RUN of one or more
    // of these with NOTHING between them — e.g. "</td></tr>" or the very last "</td></tr></table>"
    // of an item row, exactly how renderItemList() concatenates them with no inserted whitespace —
    // collapses to exactly ONE line break, never one per tag, so adjacent closings don't pile up
    // into extra blank lines. Deliberately NOT "\s*"-tolerant between them: that would also swallow
    // genuine blank-line spacing already sitting between an unrelated <br><br> run and the next
    // <p>, which must be left alone for the "3+ blank lines collapse to 2" rule further down to see.
    // </td> and </table> joining </p>/</h3>/</tr> here is the #607 B1 fix.
    text = text.replace(/(?:<\/(?:p|h3|tr|td|table)>)+/gi, '\n')

    // Everything else (div/table/td wrappers, inline styling spans/strong, ...) is stripped.
    text = text.replace(/<[^>]+>/g, '')

    // Entities used across views/layout.html + views/mail/*.html. &amp; MUST decode last since
    // every other entity's own literal text contains a '&'.
    const entities = [
        ['&nbsp;', ' '],
        ['&mdash;', '—'],
        ['&ndash;', '–'],
        ['&rarr;', '→'],
        ['&auml;', 'ä'],
        ['&ouml;', 'ö'],
        ['&uuml;', 'ü'],
        ['&Auml;', 'Ä'],
        ['&Ouml;', 'Ö'],
        ['&Uuml;', 'Ü'],
        ['&szlig;', 'ß'],
        ['&quot;', '"'],
        ['&#39;', "'"],
        ['&lt;', '<'],
        ['&gt;', '>'],
        ['&amp;', '&'],
    ]
    for (const [entity, replacement] of entities) {
        text = text.split(entity).join(replacement)
    }

    return text
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/, ''))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

module.exports = { htmlToText }
