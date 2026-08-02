// Dependency-free SMTP sink for the #607 mail-deliverability tests. Speaks just enough of the
// protocol (EHLO/MAIL FROM/RCPT TO/DATA/QUIT) to let PocketBase's mailer complete a full send —
// deliberately offering NO AUTH and NO STARTTLS, confirming (spike S3) that PocketBase's SMTP
// client works against such a server when SMTP_USERNAME is empty. node:net only, no external deps.
import net from 'node:net'

/**
 * Start a sink on an ephemeral localhost port.
 * @returns {Promise<{port: number, messages: string[], stop: () => void}>}
 *   `messages` accumulates the raw DATA payload (headers + body) of every message received, in
 *   order, for the lifetime of the sink.
 */
export function startSink() {
	const messages = []
	const server = net.createServer((socket) => {
		let buf = ''
		let dataMode = false
		let dataBuf = ''
		socket.write('220 allerleih-test-sink ESMTP\r\n')
		socket.on('data', (chunk) => {
			if (dataMode) {
				dataBuf += chunk.toString('utf8')
				const end = dataBuf.indexOf('\r\n.\r\n')
				if (end !== -1) {
					messages.push(dataBuf.slice(0, end))
					dataMode = false
					dataBuf = ''
					socket.write('250 OK: queued\r\n')
				}
				return
			}
			buf += chunk.toString('utf8')
			let idx
			while ((idx = buf.indexOf('\r\n')) !== -1) {
				const line = buf.slice(0, idx)
				buf = buf.slice(idx + 2)
				const upper = line.toUpperCase()
				if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
					// Deliberately advertises no AUTH, no STARTTLS.
					socket.write('250-allerleih-test-sink greets you\r\n250 SMTPUTF8\r\n')
				} else if (upper.startsWith('MAIL FROM')) {
					socket.write('250 OK\r\n')
				} else if (upper.startsWith('RCPT TO')) {
					socket.write('250 OK\r\n')
				} else if (upper.startsWith('DATA')) {
					dataMode = true
					socket.write('354 End data with <CR><LF>.<CR><LF>\r\n')
				} else if (upper.startsWith('QUIT')) {
					socket.write('221 Bye\r\n')
					socket.end()
				} else if (upper.startsWith('RSET') || upper.startsWith('NOOP')) {
					socket.write('250 OK\r\n')
				} else {
					socket.write('502 Command not implemented\r\n')
				}
			}
		})
	})

	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address()
			resolve({ port, messages, stop: () => server.close() })
		})
	})
}
