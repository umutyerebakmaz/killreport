/**
 * Universe Service
 *
 * The six by-ID celestial endpoints. None of them has a list form, so callers
 * get their IDs from the database (see the queue-* scripts).
 *
 * Every call goes through esiRateLimiter, which dispatches at up to 50 req/sec
 * with up to 50 concurrent in flight. Workers therefore do not sleep between
 * requests; they set PREFETCH_COUNT and let the limiter be the ceiling.
 */

import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';

async function get(path: string) {
  return esiRateLimiter.execute(async () => {
    const response = await axios.get(`${ESI_BASE_URL}${path}`);
    return response.data;
  });
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
