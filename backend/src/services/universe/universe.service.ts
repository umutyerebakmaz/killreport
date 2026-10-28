/**
 * Universe Service
 *
 * The six by-ID celestial endpoints. None of them has a list form, so callers
 * get their IDs from the database (see the queue-* scripts).
 *
 * Every call goes through esiClient, which takes a limiter slot per request.
 * The limiter paces dispatch from ESI's response headers, up to ESI_MAX_RPS.
 * Workers therefore do not sleep between requests; they set PREFETCH_COUNT and
 * let the limiter set the rate.
 */

import { esiClient } from '@services/esi-client';

async function get(path: string) {
  const response = await esiClient.get<any>(`/latest${path}`);
  return response.data;
}

export class UniverseService {
  /** Returns name, destination { system_id, stargate_id }, type_id, position. */
  static async getStargate(stargateId: number) {
    return get(`/universe/stargates/${stargateId}/`);
  }

  /** Returns name, type_id, spectral_class, temperature, radius, age, luminosity. NO star_id. */
  static async getStar(starId: number) {
    return get(`/universe/stars/${starId}/`);
  }

  /** Returns name, type_id, position, system_id. NO constellation or region. */
  static async getPlanet(planetId: number) {
    return get(`/universe/planets/${planetId}/`);
  }

  /** Returns moon_id, name, position, system_id. NO planet_id. */
  static async getMoon(moonId: number) {
    return get(`/universe/moons/${moonId}/`);
  }

  /** Returns name, position, system_id. NO asteroid_belt_id, NO planet_id. */
  static async getAsteroidBelt(beltId: number) {
    return get(`/universe/asteroid_belts/${beltId}/`);
  }

  /** Returns station_id, name, type_id, owner, race_id, services, reprocessing figures, office_rental_cost. */
  static async getStation(stationId: number) {
    return get(`/universe/stations/${stationId}/`);
  }
}
