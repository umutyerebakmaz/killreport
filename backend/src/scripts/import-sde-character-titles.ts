/**
 * Fill character_titles from CCP's Static Data Export.
 *
 * ESI sends only the UUID of a character's equipped achievement title; the
 * name lives in the SDE's characterTitles.jsonl. Only the English name is kept.
 *
 * Reads characterTitles.jsonl on stdin; `yarn sde:character-titles` downloads
 * the archive and pipes the file in. Rows are upserted, never deleted. Static
 * data: run by hand, again whenever a new SDE build adds titles, never on a
 * schedule. Redis is untouched: title names are not cached.
 */

import { createInterface } from 'node:readline';

import { parseCharacterTitleLine } from '@helpers/sde-character-title';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

async function importCharacterTitles() {
  let lines = 0;
  let written = 0;

  for await (const line of createInterface({ input: process.stdin })) {
    lines++;
    const title = parseCharacterTitleLine(line);
    if (!title) continue;

    await prismaWorker.characterTitle.upsert({
      where: { id: title.id },
      create: { id: title.id, name: title.name },
      update: { name: title.name },
    });
    written++;
  }

  if (lines === 0) {
    throw new Error('no input on stdin: pipe the SDE characterTitles.jsonl in');
  }
  logger.info(
    `read ${lines.toLocaleString()} lines, wrote ${written.toLocaleString()} character titles`,
  );
}

importCharacterTitles()
  .then(async () => {
    await prismaWorker.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('sde character title import failed:', error);
    await prismaWorker.$disconnect();
    process.exit(1);
  });
