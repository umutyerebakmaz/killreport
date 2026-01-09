import { Resolvers } from '@generated-types';
import { allianceFields, allianceMutations, allianceQueries } from './alliance';
import { analyticsQueries, analyticsSubscriptions } from './analytics';
import { authMutations, authQueries } from './auth';
import { bloodlineFields, bloodlineQueries } from './bloodline';
import { cacheMutations, cacheQueries } from './cache';
import { categoryFields, categoryMutations, categoryQueries } from './category';
import { characterFields, characterMutations, characterQueries } from './character';
import { constellationFields, constellationMutations, constellationQueries } from './constellation';
import { corporationFields, corporationQueries } from './corporation';
import { dogmaAttributeMutations, dogmaAttributeQueries } from './dogma-attribute';
import { dogmaEffectMutations, dogmaEffectQueries } from './dogma-effect';
import { itemGroupFields, itemGroupMutations, itemGroupQueries } from './item-group';
import {
  attackerFields,
  killmailFields,
  killmailItemFields,
  killmailMutations,
  killmailQueries,
  killmailSubscriptions,
  victimFields,
} from './killmail';
import { raceQueries } from './race';
import { regionFields, regionMutations, regionQueries } from './region';
import { solarSystemFields, solarSystemQueries } from './solar-system';
import { typeFields, typeMutations, typeQueries } from './type';
import { userMutations, userQueries } from './user';
import { workerQueries, workerSubscriptions } from './worker';

export const resolvers: Resolvers = {
  Query: {
    ...authQueries,
    ...userQueries,
    ...characterQueries,
    ...killmailQueries,
    ...allianceQueries,
    ...corporationQueries,
    ...raceQueries,
    ...bloodlineQueries,
    ...categoryQueries,
    ...itemGroupQueries,
    ...typeQueries,
    ...dogmaAttributeQueries,
    ...dogmaEffectQueries,
    ...constellationQueries,
    ...regionQueries,
    ...solarSystemQueries,
    ...cacheQueries,
    ...workerQueries,
    ...analyticsQueries,
  },
  Mutation: {
    ...authMutations,
    ...userMutations,
    ...characterMutations,
    ...killmailMutations,
    ...allianceMutations,
    ...categoryMutations,
    ...itemGroupMutations,
    ...typeMutations,
    ...dogmaAttributeMutations,
    ...dogmaEffectMutations,
    ...constellationMutations,
    ...regionMutations,
    ...cacheMutations,
  },
  Subscription: {
    ...workerSubscriptions,
    ...killmailSubscriptions,
    ...analyticsSubscriptions,
  },
  Character: characterFields,
  Alliance: allianceFields,
  Bloodline: bloodlineFields,
  Category: categoryFields,
  ItemGroup: itemGroupFields,
  Type: typeFields,
  Corporation: corporationFields,
  Constellation: constellationFields,
  Region: regionFields,
  SolarSystem: solarSystemFields,
  Killmail: killmailFields,
  Victim: victimFields,
  Attacker: attackerFields,
  KillmailItem: killmailItemFields,
};
