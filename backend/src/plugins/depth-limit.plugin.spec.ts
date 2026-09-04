import { describe, expect, it, vi } from 'vitest';
import { parse } from 'graphql';

/**
 * The depth limit is the only thing standing between the recursive topology
 * schema — Stargate → StargateDestination → Stargate, Planet → Moon → Planet —
 * and a single request that walks the map forever. The tests below run real
 * documents through the validation hook and check the depth it measures, since
 * an off-by-one here either rejects legitimate queries or lets the recursion
 * through.
 */

import { createDepthLimitPlugin } from './depth-limit.plugin';

type Hook = (args: {
  params: { documentAST: ReturnType<typeof parse> | undefined };
  setResult: (errors: unknown[]) => void;
}) => void;

/** Validate a document and return the errors the plugin set, if any. */
function validate(query: string, maxDepth = 3) {
  const setResult = vi.fn();
  const onValidate = (createDepthLimitPlugin(maxDepth) as { onValidate: Hook })
    .onValidate;
  onValidate({ params: { documentAST: parse(query) }, setResult });

  const errors = setResult.mock.calls[0]?.[0] as
    Array<{ message: string; extensions: Record<string, unknown> }> | undefined;
  return { rejected: setResult.mock.calls.length > 0, errors };
}

describe('measuring depth', () => {
  it('counts a flat selection as one level', () => {
    expect(validate('{ a b c }', 1).rejected).toBe(false);
  });

  it('counts each nested selection set as another level', () => {
    expect(validate('{ a { b } }', 1).rejected).toBe(true);
    expect(validate('{ a { b } }', 2).rejected).toBe(false);
  });

  it('accepts a query exactly at the ceiling', () => {
    expect(validate('{ a { b { c } } }', 3).rejected).toBe(false);
  });

  it('rejects the first level past the ceiling', () => {
    expect(validate('{ a { b { c { d } } } }', 3).rejected).toBe(true);
  });

  it('measures the deepest branch, not the last one', () => {
    expect(validate('{ deep { a { b { c } } } shallow }', 3).rejected).toBe(
      true,
    );
  });

  it('checks every operation in the document', () => {
    const { rejected } = validate(
      'query Shallow { a } query Deep { a { b { c { d } } } }',
      3,
    );

    expect(rejected).toBe(true);
  });

  it('ignores fragment definitions that no operation spreads', () => {
    const { rejected } = validate(
      '{ a } fragment Unused on Query { a { b { c { d } } } }',
      3,
    );

    expect(rejected).toBe(false);
  });

  it('walks a recursive selection to its real depth', () => {
    const { errors } = validate(
      '{ stargate { destination { stargate { destination { stargate { name } } } } } }',
      3,
    );

    expect(errors?.[0].extensions.depth).toBe(6);
  });
});

describe('fragments', () => {
  it('counts a spread at the depth of the spread site', () => {
    const query =
      '{ ship { ...Type } } fragment Type on Ship { type { name } }';

    expect(validate(query, 3).rejected).toBe(false);
    expect(validate(query, 2).rejected).toBe(true);
  });

  it('measures a spread the same as the inlined selection', () => {
    const spread =
      '{ ship { ...Type } } fragment Type on Ship { type { name } }';
    const inlined = '{ ship { type { name } } }';

    expect(validate(spread, 2).errors?.[0].extensions.depth).toBe(
      validate(inlined, 2).errors?.[0].extensions.depth,
    );
  });

  it('adds no level for an inline fragment', () => {
    expect(validate('{ a { ... on Thing { b } } }', 2).rejected).toBe(false);
  });

  it('ignores a spread whose fragment is not in the document', () => {
    expect(validate('{ a { ...Missing } }', 2).rejected).toBe(false);
  });

  it('terminates on a fragment cycle instead of recursing forever', () => {
    const query = '{ a { ...Loop } } fragment Loop on Thing { b { ...Loop } }';

    expect(() => validate(query, 3)).not.toThrow();
    expect(validate(query, 3).rejected).toBe(false);
  });

  it('counts a fragment spread twice in sibling branches', () => {
    const query =
      '{ a { ...Pair } b { ...Pair } } fragment Pair on Thing { x { y } }';

    expect(validate(query, 3).rejected).toBe(false);
    expect(validate(query, 2).rejected).toBe(true);
  });
});

describe('introspection', () => {
  it('lets a deep introspection query through', () => {
    const query = `{
      __schema { types { fields { type { ofType { ofType { name } } } } } }
    }`;

    expect(validate(query, 3).rejected).toBe(false);
  });

  it('still measures the non-introspection siblings', () => {
    const query = '{ __schema { types { name } } a { b { c { d } } } }';

    expect(validate(query, 3).rejected).toBe(true);
  });
});

describe('the rejection', () => {
  it('names the operation, the ceiling and the depth reached', () => {
    const { errors } = validate('query TooDeep { a { b { c { d } } } }', 3);

    expect(errors).toHaveLength(1);
    expect(errors?.[0].message).toBe(
      'Query "TooDeep" exceeds the maximum operation depth of 3 (got 4).',
    );
    expect(errors?.[0].extensions).toMatchObject({
      code: 'QUERY_TOO_DEEP',
      maxDepth: 3,
      depth: 4,
    });
  });

  it('calls an unnamed operation anonymous', () => {
    const { errors } = validate('{ a { b { c { d } } } }', 3);

    expect(errors?.[0].message).toContain('Query "anonymous"');
  });

  it('reports the first offending operation only', () => {
    const { errors } = validate(
      'query First { a { b { c { d } } } } query Second { a { b { c { d { e } } } } }',
      3,
    );

    expect(errors).toHaveLength(1);
    expect(errors?.[0].message).toContain('First');
  });

  it('applies to mutations as well as queries', () => {
    expect(validate('mutation { a { b { c { d } } } }', 3).rejected).toBe(true);
  });

  it('does nothing when there is no parsed document', () => {
    const setResult = vi.fn();
    const onValidate = (createDepthLimitPlugin(3) as { onValidate: Hook })
      .onValidate;

    expect(() =>
      onValidate({ params: { documentAST: undefined }, setResult }),
    ).not.toThrow();
    expect(setResult).not.toHaveBeenCalled();
  });
});
