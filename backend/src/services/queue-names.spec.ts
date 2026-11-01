import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_QUEUES } from './queue-names';

function policyPattern(): RegExp {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, '../../package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
  const match = pkg.scripts['rabbitmq:policy'].match(
    /set_policy killreport-dlx '([^']+)'/,
  );
  if (!match) throw new Error('rabbitmq:policy has no killreport-dlx pattern');
  return new RegExp(match[1]);
}

describe('killreport-dlx policy', () => {
  it('matches every queue in ALL_QUEUES', () => {
    const pattern = policyPattern();
    const uncovered = ALL_QUEUES.filter((name) => !pattern.test(name));
    expect(uncovered).toEqual([]);
  });
});
