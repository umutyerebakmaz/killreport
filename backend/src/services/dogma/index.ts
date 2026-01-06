/**
 * Dogma service exports
 *
 * Provides access to EVE Online's Dogma system:
 * - Attributes: Numerical values that define item characteristics (mass, damage, capacitor, etc.)
 * - Effects: Define how attributes are modified (bonuses, penalties, skill effects)
 *
 * Useful for:
 * - Displaying module stats on killmail items
 * - Showing ship base stats
 * - Understanding weapon/damage types
 * - Calculating fitting information
 */

export { DogmaAttributeService } from './dogma-attribute.service';
export { DogmaEffectService } from './dogma-effect.service';

