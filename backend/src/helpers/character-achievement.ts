import type { EsiCharacterInfo } from '@services/character/character.service';
import logger from '@services/logger';

const INT32_MAX = 2_147_483_647;

/**
 * The three character columns ESI's title data feeds. Every key ESI leaves
 * out becomes null, so a stale value never survives an update. A score that
 * is not an integer in 0..int32 max would make the upsert throw, so it is
 * dropped with a warning instead.
 */
export function characterTitleFields(info: EsiCharacterInfo): {
  title: string | null;
  character_title_id: string | null;
  achievement_score: number | null;
} {
  const score = info.achievement_score;
  let achievementScore: number | null = null;
  if (score !== undefined && score !== null) {
    if (Number.isInteger(score) && score >= 0 && score <= INT32_MAX) {
      achievementScore = score;
    } else {
      logger.warn(
        `Ignoring achievement_score ${String(score)}: not an int32 >= 0`,
      );
    }
  }
  return {
    title: info.corporation_title ?? null,
    character_title_id: info.character_title_id ?? null,
    achievement_score: achievementScore,
  };
}
