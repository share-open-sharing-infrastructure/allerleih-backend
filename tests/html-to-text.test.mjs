// Pure unit test for htmlToText (#607) — no PocketBase instance needed. The repo has no
// "type": "module" in package.json, so pb_hooks/utils/htmlToText.js's CommonJS
// `module.exports` is importable directly from a Node ESM test file.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { htmlToText } from '../pb_hooks/utils/htmlToText.js'

test('empty input', () => {
	assert.equal(htmlToText(''), '')
	assert.equal(htmlToText(null), '')
	assert.equal(htmlToText(undefined), '')
})

test('link with distinct text becomes "text (url)"', () => {
	assert.equal(htmlToText('<a href="https://allerleih.test/search">Suchen</a>'), 'Suchen (https://allerleih.test/search)')
})

test('link whose text equals its href collapses to just the url', () => {
	assert.equal(htmlToText('<a href="https://allerleih.test/">https://allerleih.test/</a>'), 'https://allerleih.test/')
})

test('link text is stripped of any nested tags before comparison/output', () => {
	assert.equal(htmlToText('<a href="https://x.test"><strong>Los</strong></a>'), 'Los (https://x.test)')
})

test('images are dropped entirely (contract: <br>/</p>/</h3>/</tr>/</td>/</table> are the only line breaks)', () => {
	assert.equal(htmlToText('<p>Vorher</p><img src="https://x.test/a.png" alt="x"><p>Nachher</p>'), 'Vorher\nNachher')
})

test('<br> and </p>/</h3>/</tr>/</td>/</table> each insert a line break (per the #607 contract)', () => {
	assert.equal(htmlToText('Zeile1<br>Zeile2<br/>Zeile3'), 'Zeile1\nZeile2\nZeile3')
	assert.equal(htmlToText('<p>Erster Absatz</p><p>Zweiter Absatz</p>'), 'Erster Absatz\nZweiter Absatz')
	assert.equal(htmlToText('<h3>Titel</h3><p>Text</p>'), 'Titel\nText')
	assert.equal(htmlToText('<table><tr><td>a</td></tr><tr><td>b</td></tr></table>'), 'a\nb')
})

test('#607 B1: </td> alone (no </tr> alongside it) is also a line-break boundary', () => {
	// Two table cells in the SAME row (no </tr> between them) — the exact shape of
	// renderItemList()'s image cell followed by its text cell, which used to glue together.
	assert.equal(htmlToText('<tr><td>Bild-Zelle</td><td>Text-Zelle</td></tr>'), 'Bild-Zelle\nText-Zelle')
})

test('#607 B1: a RUN of adjacent closing tags (</td></tr></table>) collapses to exactly one line break', () => {
	assert.equal(
		htmlToText('<table><tr><td>Erstes Item</td></tr></table><table><tr><td>Zweites Item</td></tr></table>'),
		'Erstes Item\nZweites Item'
	)
})

test('#607 B1: a link with no text content at all (e.g. an image-only link) is dropped entirely, not shown as a bare URL', () => {
	assert.equal(htmlToText('<a href="https://x.test"><img src="https://x.test/a.png" alt="Name"></a>'), '')
	assert.equal(
		htmlToText('<a href="https://x.test/item"><img alt="Name"></a><a href="https://x.test/item">Name</a>'),
		'Name (https://x.test/item)'
	)
})

test('style/script/head blocks are dropped entirely, including their content', () => {
	assert.equal(htmlToText('<head><title>t</title></head><style>.a{color:red}</style><p>Text</p><script>evil()</script>'), 'Text')
})

test('remaining tags are stripped, content kept', () => {
	assert.equal(htmlToText('<div><span style="color:red">Hallo</span> <strong>Welt</strong></div>'), 'Hallo Welt')
})

test('German umlaut and punctuation entities decode correctly', () => {
	assert.equal(
		htmlToText('R&uuml;ckblick &mdash; f&uuml;r Sie &ndash; &rarr; los. &Auml;&Ouml;&Uuml;&szlig;'),
		'Rückblick — für Sie – → los. ÄÖÜß'
	)
})

test('&amp; decodes last so it never re-expands entities produced by other replacements', () => {
	// If &amp; ran first, "&amp;uuml;" would become "&uuml;" and get wrongly decoded to "ü".
	// Decoding &amp; last means "&uuml;" is never literally present during the uuml step, so
	// this stays a literal (still-encoded-looking) "&uuml;" in the output.
	assert.equal(htmlToText('Tom &amp; Jerry &amp;uuml;'), 'Tom & Jerry &uuml;')
})

test('quote and apostrophe entities decode', () => {
	assert.equal(htmlToText('&quot;Hallo&quot; &amp; &#39;Welt&#39;'), '"Hallo" & \'Welt\'')
})

test('nbsp decodes to a plain space', () => {
	assert.equal(htmlToText('AllerLeih&nbsp;Teilen'), 'AllerLeih Teilen')
})

test('3+ blank lines collapse to 2, and the result is trimmed of surrounding whitespace', () => {
	assert.equal(htmlToText('<p>A</p><br><br><br><p>B</p>'), 'A\n\nB')
	assert.equal(htmlToText('  <p>Trim me</p>  '), 'Trim me')
})

test('real weekly-digest-shaped fragment renders sane plaintext with no leaked markup', () => {
	const html =
		'<p>Hallo Alice,</p>' +
		'<p>hier ist dein Wochen-R&uuml;ckblick &mdash; diese Woche neu auf AllerLeih:</p>' +
		'<h3>Neu auf der Plattform</h3>' +
		'<a href="https://allerleih.test/items/abc" style="color:#1F1F1F;">Bohrmaschine</a><br>' +
		'<a href="https://allerleih.test/search" style="display:inline-block;">Alle ansehen</a>'
	const text = htmlToText(html)
	assert.ok(text.includes('Hallo Alice,'))
	assert.ok(text.includes('Wochen-Rückblick — diese Woche neu auf AllerLeih:'))
	assert.ok(text.includes('Neu auf der Plattform'))
	assert.ok(text.includes('Bohrmaschine (https://allerleih.test/items/abc)'))
	assert.ok(text.includes('Alle ansehen (https://allerleih.test/search)'))
	assert.ok(!text.includes('<'), 'no HTML tags leak into the plaintext')
})
