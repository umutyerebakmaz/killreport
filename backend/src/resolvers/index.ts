import { Resolvers } from '@generated-types';
import { allianceFields, allianceMutations, allianceQueries } from './alliance';
import { analyticsQueries, analyticsSubscriptions } from './analytics';
import { authMutations, authQueries } from './auth';
import { bloodlineFields, bloodlineQueries } from './bloodline';
import { cacheMutations, cacheQueries } from './cache';
import { categoryFields, categoryMutations, categoryQueries } from './category';
import { characterFields, characterMutations, characterQueries } from './character';
import { constellationFields, constellationMutations, constellationQueries } from './constellation';
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
    ...solarSystemMutations,
    ...cacheMutations,
  },
  Subscription: {
    ...workerResolvers.Subscription,
    ...killmailSubscriptions,
    ...analyticsSubscriptions,
  },
  Character: characterFields,
  Alliance: allianceFields,
  Bloodline: bloodlineFields,
  Category: categoryFields,
  ItemGroup: itemGroupFieldResolvers,
  Type: typeFieldResolvers,
  Corporation: corporationFieldResolvers,
  Constellation: constellationFields,
  Region: regionFieldResolvers,
  SolarSystem: solarSystemFieldResolvers,
  Killmail: killmailFieldResolvers,
  Victim: victimFieldResolvers,
  Attacker: attackerFieldResolvers,
  KillmailItem: killmailItemFieldResolvers,
};
