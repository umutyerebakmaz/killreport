import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.hoisted(() => vi.fn());
const sendToQueue = vi.hoisted(() => vi.fn());
const getRabbitMQChannel = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());

vi.mock('@services/prisma', () => ({
  default: { character: { findUnique } },
}));
vi.mock('@services/rabbitmq', () => ({ getRabbitMQChannel }));
vi.mock('@services/logger', () => ({
  default: { error: loggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { queueOwnCharacterIfMissing } from './queue-own-character';

describe('queueOwnCharacterIfMissing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRabbitMQChannel.mockResolvedValue({ sendToQueue });
  });

  it('does not queue when the character row exists', async () => {
    findUnique.mockResolvedValue({ id: 42 });
    await queueOwnCharacterIfMissing(42);
    expect(sendToQueue).not.toHaveBeenCalled();
  });

  it('queues once when the character row is missing', async () => {
    findUnique.mockResolvedValue(null);
    await queueOwnCharacterIfMissing(42);
    expect(sendToQueue).toHaveBeenCalledTimes(1);
    const [queue, buffer, options] = sendToQueue.mock.calls[0];
    expect(queue).toBe('esi_character_info_queue');
    const message = JSON.parse(buffer.toString());
    expect(message.entityId).toBe(42);
    expect(message.source).toBe('login');
    expect(typeof message.queuedAt).toBe('string');
    expect(options).toEqual({ persistent: true });
  });

  it('resolves and logs when the channel cannot be obtained', async () => {
    findUnique.mockResolvedValue(null);
    getRabbitMQChannel.mockRejectedValue(new Error('down'));
    await expect(queueOwnCharacterIfMissing(42)).resolves.toBeUndefined();
    expect(loggerError).toHaveBeenCalled();
  });
});
