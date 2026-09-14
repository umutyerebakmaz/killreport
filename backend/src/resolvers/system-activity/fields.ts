import { SystemActivityResolvers } from '@generated-types';

/**
 * SystemActivity Field Resolvers
 * Handles field transformations for SystemActivity type
 */
export const systemActivityFields: SystemActivityResolvers = {
  // GraphQL automatically serializes Date objects to ISO strings
  // Just ensure we return a valid Date object
  timestamp: (parent) => {
    const prismaParent = parent as any;

    // If timestamp is already a Date object, return as is
    if (prismaParent.timestamp instanceof Date) {
      return prismaParent.timestamp.toISOString();
    }

    // If it's a string, pass through
    if (typeof prismaParent.timestamp === 'string') {
      return prismaParent.timestamp;
    }

    // Fallback to current date
    return new Date().toISOString();
  },
};
