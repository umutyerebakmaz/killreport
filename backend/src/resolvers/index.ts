import { Resolvers } from '@generated-types';
import { fields as allianceFields, mutations as allianceMutations, queries as allianceQueries } from './alliance';
import { analyticsResolvers } from './analytics.resolver';
import { authMutations, authQueries } from './auth.resolver';
import { bloodlineFieldResolvers, bloodlineQueries } from './bloodline.resolver';
import { cacheMutations, cacheQueries } from './cache.resolver';
import { categoryFieldResolvers, categoryMutations, categoryQueries } from './category.resolver';
import { characterFieldResolvers, characterMutations, characterQueries } from './character.resolver';
import { constellationFieldResolvers, constellationMutations, constellationQueries } from './constellation.resolver';
import { corporationFieldResolvers, corporationQueries } from './corporation.resolver';
import { dogmaAttributeMutations, dogmaAttributeQueries } from './dogma-attribute.resolver';
import { dogmaEffectMutations, dogmaEffectQueries } from './dogma-effect.resolver';
import { itemGroupFieldResolvers, itemGroupMutations, itemGroupQueries } from './item-group.resolver';
import {
  attackerFieldResolvers,
  killmailFieldResolvers,
  killmailItemFieldResolvers,
  killmailMutations,
  killmailQueries,
  killmailSubscriptions,
  victimFieldResolvers,
} from './killmail.resolver';
import { raceQueries } from './race.resolver';
import { regionFieldResolvers, regionMutations, regionQueries } from './region.resolver';
import { solarSystemFieldResolvers, solarSystemMutations, solarSystemQueries } from './solarSystem.resolver';
import { typeFieldResolvers, typeMutations, typeQueries } from './type.resolver';
import { userMutations, userQueries } from './user.resolver';
import { workerResolvers } from './worker.resolver';

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
    ...workerResolvers.Query,
    ...analyticsResolvers.Query,
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
    ...solarSystemMutations,
    ...cacheMutations,
  },
  Subscription: {
    ...workerResolvers.Subscription,
    ...killmailSubscriptions,
    ...analyticsResolvers.Subscription,
  },
  Character: characterFieldResolvers,
  Alliance: allianceFields,
  Bloodline: bloodlineFieldResolvers,
  Category: categoryFieldResolvers,
  ItemGroup: itemGroupFieldResolvers,
  Type: typeFieldResolvers,
  Corporation: corporationFieldResolvers,
  Constellation: constellationFieldResolvers,
  Region: regionFieldResolvers,
  SolarSystem: solarSystemFieldResolvers,
  Killmail: killmailFieldResolvers,
  Victim: victimFieldResolvers,
  Attacker: attackerFieldResolvers,
  KillmailItem: killmailItemFieldResolvers,
};
