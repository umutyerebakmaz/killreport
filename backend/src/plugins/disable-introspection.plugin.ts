import { Plugin } from 'graphql-yoga';
import { GraphQLError, DefinitionNode } from 'graphql';

/**
 * Plugin to disable GraphQL introspection queries
 * Blocks __schema and __type queries when introspection is disabled
 */
export const createDisableIntrospectionPlugin = (): Plugin => {
  return {
    onValidate({ params, setResult }) {
      // Check if introspection query
      const isIntrospectionQuery = params.documentAST?.definitions.some(
        (definition: DefinitionNode) => {
          if (definition.kind === 'OperationDefinition') {
            return definition.selectionSet.selections.some((selection) => {
              if (selection.kind === 'Field') {
                const fieldName = selection.name.value;
                return fieldName === '__schema' || fieldName === '__type';
              }
              return false;
            });
          }
          return false;
        }
      );

      if (isIntrospectionQuery) {
        setResult([
          new GraphQLError('GraphQL introspection is disabled.', {
            extensions: { code: 'INTROSPECTION_DISABLED' },
          }),
        ]);
      }
    },
  };
};
