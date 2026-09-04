import { describe, expect, it, vi } from 'vitest';
import { parse } from 'graphql';

/**
 * The introspection block only runs when GRAPHQL_INTROSPECTION is false, which
 * in practice means production. `__schema` and `__type` are valid on the root
 * query type only — but an operation reaches that root through an inline
 * fragment or a fragment spread on Query just as well as through a plain
 * field, so those are what the tests below spend most of their time on.
 */

import { createDisableIntrospectionPlugin } from './disable-introspection.plugin';

type Hook = (args: {
  params: { documentAST: ReturnType<typeof parse> | undefined };
  setResult: (errors: unknown[]) => void;
}) => void;

function validate(query: string) {
  const setResult = vi.fn();
  const onValidate = (
    createDisableIntrospectionPlugin() as { onValidate: Hook }
  ).onValidate;
  onValidate({ params: { documentAST: parse(query) }, setResult });

  const errors = setResult.mock.calls[0]?.[0] as
    Array<{ message: string; extensions: Record<string, unknown> }> | undefined;
  return { blocked: setResult.mock.calls.length > 0, errors };
}

describe('blocking introspection', () => {
  it('blocks a __schema query', () => {
    expect(validate('{ __schema { types { name } } }').blocked).toBe(true);
  });

  it('blocks a __type query', () => {
    expect(validate('{ __type(name: "Query") { name } }').blocked).toBe(true);
  });

  it('blocks an aliased introspection field', () => {
    expect(validate('{ s: __schema { types { name } } }').blocked).toBe(true);
  });

  it('blocks introspection reached through an inline fragment', () => {
    expect(
      validate('query { ... on Query { __schema { types { name } } } }')
        .blocked,
    ).toBe(true);
  });

  it('blocks introspection reached through a fragment spread', () => {
    const query =
      'query { ...Peek } fragment Peek on Query { __schema { types { name } } }';

    expect(validate(query).blocked).toBe(true);
  });

  it('blocks introspection nested two fragments deep', () => {
    const query = [
      'query { ...Outer }',
      'fragment Outer on Query { ...Inner }',
      'fragment Inner on Query { __type(name: "Killmail") { name } }',
    ].join(' ');

    expect(validate(query).blocked).toBe(true);
  });

  it('blocks introspection under an inline fragment inside a spread', () => {
    const query = [
      'query { ...Peek }',
      'fragment Peek on Query { ... on Query { __schema { types { name } } } }',
    ].join(' ');

    expect(validate(query).blocked).toBe(true);
  });

  it('blocks a document where only the second operation introspects', () => {
    const query =
      'query Real { killmails { id } } query Peek { __schema { types { name } } }';

    expect(validate(query).blocked).toBe(true);
  });

  it('blocks introspection sitting beside a legitimate field', () => {
    expect(
      validate('{ killmails { id } __schema { types { name } } }').blocked,
    ).toBe(true);
  });
});

describe('letting real queries through', () => {
  it('allows a normal query', () => {
    expect(validate('{ killmails { id } }').blocked).toBe(false);
  });

  it('allows a query built from fragments', () => {
    const query =
      '{ killmails { ...Row } } fragment Row on Killmail { id victim { id } }';

    expect(validate(query).blocked).toBe(false);
  });

  it('allows __typename, which is not introspection of the schema', () => {
    expect(validate('{ killmails { __typename id } }').blocked).toBe(false);
  });

  it('allows a field whose name merely starts the same way', () => {
    expect(validate('{ __typename }').blocked).toBe(false);
  });

  it('ignores a fragment no operation spreads', () => {
    const query =
      '{ killmails { id } } fragment Peek on Query { __schema { types { name } } }';

    expect(validate(query).blocked).toBe(false);
  });

  it('ignores a spread whose fragment is not in the document', () => {
    expect(validate('{ ...Missing }').blocked).toBe(false);
  });

  it('terminates on a fragment cycle instead of recursing forever', () => {
    const query =
      '{ ...Loop } fragment Loop on Query { killmails { id } ...Loop }';

    expect(() => validate(query)).not.toThrow();
    expect(validate(query).blocked).toBe(false);
  });

  it('does nothing when there is no parsed document', () => {
    const setResult = vi.fn();
    const onValidate = (
      createDisableIntrospectionPlugin() as { onValidate: Hook }
    ).onValidate;

    expect(() =>
      onValidate({ params: { documentAST: undefined }, setResult }),
    ).not.toThrow();
    expect(setResult).not.toHaveBeenCalled();
  });
});

describe('the rejection', () => {
  it('reports one error the client can act on', () => {
    const { errors } = validate('{ __schema { types { name } } }');

    expect(errors).toHaveLength(1);
    expect(errors?.[0].message).toBe('GraphQL introspection is disabled.');
    expect(errors?.[0].extensions).toMatchObject({
      code: 'INTROSPECTION_DISABLED',
    });
  });
});
