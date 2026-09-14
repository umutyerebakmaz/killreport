import { systemActivityFields } from './fields';
import { systemActivityQueries } from './queries';

export const systemActivityResolvers = {
  Query: systemActivityQueries,
  SystemActivity: systemActivityFields,
};
