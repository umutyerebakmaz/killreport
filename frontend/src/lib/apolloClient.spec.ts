import { describe, expect, it } from 'vitest';
import {
  MapLabelKind,
  MapLabelsDocument,
  MapProjection,
  MapScope,
  type MapLabelsQuery,
} from '@/generated/graphql';
import { createApolloCache } from './apolloClient';

function labels(x: number, z: number): MapLabelsQuery {
  return {
    mapLabels: [
      {
        __typename: 'MapLabel',
        id: 10000002,
        name: 'The Forge',
        kind: MapLabelKind.Region,
        x,
        z,
        systemId: 30000142,
        bounds: {
          __typename: 'MapBounds',
          minX: x - 1,
          maxX: x + 1,
          minZ: z - 1,
          maxZ: z + 1,
        },
      },
    ],
  };
}

function variables(projection: MapProjection) {
  return { scope: MapScope.NewEden, kind: MapLabelKind.Region, projection };
}

describe('createApolloCache', () => {
  it('keeps a label in one projection when the other projection is written', () => {
    const cache = createApolloCache();
    const schematic = labels(1, 2);

    cache.writeQuery({
      query: MapLabelsDocument,
      variables: variables(MapProjection.Schematic),
      data: schematic,
    });
    cache.writeQuery({
      query: MapLabelsDocument,
      variables: variables(MapProjection.Galactic),
      data: labels(9e17, -4e17),
    });

    const read = cache.readQuery<MapLabelsQuery>({
      query: MapLabelsDocument,
      variables: variables(MapProjection.Schematic),
    });
    expect(read).toEqual(schematic);
  });
});
