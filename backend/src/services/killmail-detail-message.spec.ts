import { describe, expect, it } from 'vitest';
import {
  buildDetailMessage,
  KILLMAIL_DETAIL_QUEUE,
} from './killmail-detail-message';

describe('buildDetailMessage', () => {
  it('names the killmail and nothing about who found it', () => {
    const message = buildDetailMessage(128431979, 'abc123', true);

    expect(message).toEqual({
      killmailId: 128431979,
      killmailHash: 'abc123',
      announce: true,
    });
    // The detail endpoint is public; a credential here would be #238 undone.
    expect(Object.keys(message)).not.toContain('accessToken');
    expect(Object.keys(message)).not.toContain('userId');
  });

  it('carries the announce decision, because the publisher makes it and the worker acts on it', () => {
    expect(buildDetailMessage(1, 'h', false).announce).toBe(false);
  });

  it('names the queue in one place', () => {
    expect(KILLMAIL_DETAIL_QUEUE).toBe('esi_killmail_detail_queue');
  });
});
