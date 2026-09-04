import { Plugin } from 'graphql-yoga';
import {
  DefinitionNode,
  FragmentDefinitionNode,
  GraphQLError,
  OperationDefinitionNode,
  SelectionSetNode,
} from 'graphql';

/**
 * Plugin to reject queries nested deeper than `maxDepth`.
 *
 * The universe topology schema is recursive — Stargate -> StargateDestination ->
 * Stargate, and Planet -> Moon -> Planet — so without a ceiling a single request
 * can ask the server to walk the map forever. The server had no depth or
 * complexity rule of any kind before this.
 *
 * Introspection fields are skipped: __schema is legitimately deep.
 */
export const createDepthLimitPlugin = (maxDepth: number): Plugin => {
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

      const depthOf = (selectionSet: SelectionSetNode | undefined): number => {
        if (!selectionSet) return 0;

        let deepest = 0;
        for (const selection of selectionSet.selections) {
          if (selection.kind === 'Field') {
            if (selection.name.value.startsWith('__')) continue;
            deepest = Math.max(deepest, 1 + depthOf(selection.selectionSet));
          } else if (selection.kind === 'InlineFragment') {
            deepest = Math.max(deepest, depthOf(selection.selectionSet));
          } else if (selection.kind === 'FragmentSpread') {
            const name = selection.name.value;
            if (visiting.has(name)) continue;
            const fragment = fragments.get(name);
            if (!fragment) continue;
            visiting.add(name);
            deepest = Math.max(deepest, depthOf(fragment.selectionSet));
            visiting.delete(name);
          }
        }
        return deepest;
      };

      for (const definition of definitions as DefinitionNode[]) {
        if (definition.kind !== 'OperationDefinition') continue;
        const operation = definition as OperationDefinitionNode;
        const depth = depthOf(operation.selectionSet);

        if (depth > maxDepth) {
          const name = operation.name?.value ?? 'anonymous';
          setResult([
            new GraphQLError(
              `Query "${name}" exceeds the maximum operation depth of ${maxDepth} (got ${depth}).`,
              { extensions: { code: 'QUERY_TOO_DEEP', maxDepth, depth } },
            ),
          ]);
          return;
        }
      }
    },
  };
};
