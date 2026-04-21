/**
 * F15/F16/F17 — shared text/plain streaming response wrapper.
 *
 * The F14 greeting route already ships the exact shape the mode routes
 * need: a ReadableStream that enqueues encoded chunks from an
 * AsyncIterable<string>, closes the response after the consumer
 * finishes, and awaits a `done` promise so metrics/logging math
 * completes before the HTTP response ends.
 *
 * Pulling it into a helper so the chat/plan/advise routes don't
 * copy-paste the ReadableStream plumbing.
 *
 * A trailing JSON frame is supported so F16 Plan can emit
 * `{"proposals":["p1","p2"]}` after the human-readable text. Clients
 * slice the last LF-delimited line and JSON.parse it. The header
 * `x-council-has-proposals: true` signals the trailer will be present;
 * absence means pure text.
 *
 * Errors inside the trailer are logged and swallowed — a trailer miss
 * must never truncate the user-visible reply.
 */

export type StreamCouncilReplyInput = {
  /** The human-readable chunks (what the user sees). */
  chunks: AsyncIterable<string>;
  /**
   * Settles after `chunks` drains. The wrapper awaits this before
   * closing the response so metrics/log writes in upstream code have
   * a chance to finish.
   */
  done: Promise<unknown>;
  /** Response header `x-council-mode` value. */
  mode: string;
  /**
   * Optional trailer producer. Fires AFTER `chunks` drains, BEFORE
   * `done` is awaited. Whatever it returns is JSON-serialized and
   * appended to the stream on a fresh line. Return `null` to skip the
   * trailer for this response.
   *
   * When this property is present we emit `x-council-has-proposals`
   * so the client knows to look for the trailer line.
   */
  trailer?: () => Promise<Record<string, unknown> | null>;
  /** Optional logger; defaults to console.error. */
  log?: (msg: string, err: unknown) => void;
};

export const TRAILER_NEWLINE = '\n';

export function streamCouncilReply(input: StreamCouncilReplyInput): Response {
  const log = input.log ?? ((msg, err) => console.error(msg, err));
  const encoder = new TextEncoder();

  const webStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of input.chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (streamErr) {
        log('stream-response: mid-stream error', streamErr);
      }

      if (input.trailer) {
        try {
          const payload = await input.trailer();
          if (payload !== null) {
            controller.enqueue(
              encoder.encode(TRAILER_NEWLINE + JSON.stringify(payload)),
            );
          }
        } catch (trailerErr) {
          log('stream-response: trailer error (swallowed)', trailerErr);
        }
      }

      try {
        await input.done;
      } catch (doneErr) {
        log('stream-response: done-promise rejected (swallowed)', doneErr);
      }

      controller.close();
    },
  });

  const headers: Record<string, string> = {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-council-mode': input.mode,
  };
  if (input.trailer) {
    headers['x-council-has-proposals'] = 'true';
  }

  return new Response(webStream, { status: 200, headers });
}
