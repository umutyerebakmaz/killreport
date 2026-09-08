import { PassThrough } from 'node:stream';
import winston from 'winston';
import { beforeEach, describe, expect, it } from 'vitest';
import logger from './logger';

/**
 * Captures what the real logger writes, formatting and all, by attaching a
 * stream transport to the exported instance. Testing through the assembled
 * pipeline is the point: the defect these cover was a mismatch between what
 * winston puts on `info` and what the format reads back off it, and only the
 * whole chain shows that.
 */
async function capture(log: () => void): Promise<string> {
  const stream = new PassThrough();
  let output = '';
  stream.on('data', (chunk) => {
    output += chunk.toString();
  });

  const transport = new winston.transports.Stream({ stream });
  logger.add(transport);
  try {
    log();
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    logger.remove(transport);
  }

  // The format colorizes; the assertions care about the text, not the escapes.
  return output.replace(/\u001b\[\d+m/g, '');
}

describe('logger', () => {
  beforeEach(() => {
    const previousLevel = logger.level;
    logger.level = 'debug';
    return () => {
      logger.level = previousLevel;
    };
  });

  it('prints a string passed as a second argument', async () => {
    const output = await capture(() => {
      logger.error('Error saving faction 500001:', 'client is undefined');
    });

    expect(output).toContain(
      'Error saving faction 500001: client is undefined',
    );
  });

  it('prints a number passed as a second argument', async () => {
    const output = await capture(() => {
      logger.debug('Token length:', 42);
    });

    expect(output).toContain('Token length: 42');
  });

  it('prints every extra primitive argument', async () => {
    const output = await capture(() => {
      logger.error('Two extras:', 'first', 'second');
    });

    expect(output).toContain('Two extras: first second');
  });

  it('prints an object second argument once, as meta', async () => {
    const output = await capture(() => {
      logger.error('Upsert failed:', { code: 'P2002' });
    });

    expect(output).toContain('Upsert failed: {"code":"P2002"}');
    // winston merges the object into `info` itself; rendering the splat as
    // well would print it a second time.
    expect(output.match(/P2002/g)).toHaveLength(1);
  });

  it('prints an Error second argument once, message and stack', async () => {
    const output = await capture(() => {
      logger.error('Fetch failed:', new Error('boom'));
    });

    expect(output).toContain('Fetch failed: boom');
    expect(output).toContain('"stack"');
    expect(output.match(/Fetch failed/g)).toHaveLength(1);
  });

  it('leaves a message with no extra arguments untouched', async () => {
    const output = await capture(() => {
      logger.info('Faction sync completed');
    });

    expect(output).toContain('info: Faction sync completed');
    expect(output.trim()).toMatch(/Faction sync completed$/);
  });
});
