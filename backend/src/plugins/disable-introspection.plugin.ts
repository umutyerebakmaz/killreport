import { Plugin } from 'graphql-yoga';
import {
  DefinitionNode,
  FragmentDefinitionNode,
  GraphQLError,
  SelectionSetNode,
} from 'graphql';

/**
 * Plugin to disable GraphQL introspection queries
 * Blocks __schema and __type queries when introspection is disabled
 *
 * `__schema` and `__type` are only valid on the root query type, but an
 * operation can reach that root through an inline fragment or a fragment
 * spread on Query — neither of which changes the level the field sits at. Both
 * are walked, or the block is a two-line detour away, as the depth limit
 * plugin beside this one already assumed.
 */
export const createDisableIntrospectionPlugin = (): Plugin => {
  return {
    onValidate({ params, setResult }) {
      const definitions = params.documentAST?.definitions ?? [];

      const fragments = new Map<string, FragmentDefinitionNode>();
      for (const definition of definitions) {
        if (definition.kind === 'FragmentDefinition') {
          fragments.set(definition.name.value, definition);
        }
      }

      // Guards against a fragment cycle, which would otherwise recurse forever.
      const visiting = new Set<string>();

      const selectsIntrospection = (
        selectionSet: SelectionSetNode | undefined,
      ): boolean => {
        if (!selectionSet) return false;

        return selectionSet.selections.some((selection) => {
          if (selection.kind === 'Field') {
            const fieldName = selection.name.value;
            return fieldName === '__schema' || fieldName === '__type';
          }

          if (selection.kind === 'InlineFragment') {
            return selectsIntrospection(selection.selectionSet);
          }

          const name = selection.name.value;
          if (visiting.has(name)) return false;
          const fragment = fragments.get(name);
          if (!fragment) return false;

          visiting.add(name);
          const found = selectsIntrospection(fragment.selectionSet);
          visiting.delete(name);
          return found;
        });
      };

      const isIntrospectionQuery = (definitions as DefinitionNode[]).some(
        (definition) =>
          definition.kind === 'OperationDefinition' &&
          selectsIntrospection(definition.selectionSet),
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
