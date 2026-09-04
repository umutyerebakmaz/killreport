import { solarSystemFields as baseSolarSystemFields } from './fields';
import { solarSystemTopologyFields } from './topology-fields';

export const solarSystemFields = {
    ...baseSolarSystemFields,
    ...solarSystemTopologyFields,
};

export {
    asteroidBeltFields,
    moonFields,
    planetFields,
    stargateDestinationFields,
    stargateFields,
    starFields,
    stationFields,
} from './topology-fields';

export { solarSystemQueries } from './queries';
