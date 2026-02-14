# Dogma Services

Service layer for EVE Online's Dogma system. Dogma is the system that defines the properties and behaviors of items (ships, modules, etc.) in EVE.

## Overview

### What is Dogma?

The Dogma system consists of two main components:

1. **Dogma Attributes**: Numerical properties of items (mass, capacity, damage, shield HP, etc.)
2. **Dogma Effects**: How these properties are modified (bonuses, skill effects, module behaviors)

### Data Flow

```text
Type: Retribution (Assault Frigate)
│
├─ dogma_attributes[] (102 attributes)
│  ├─ { attribute_id: 4, value: 1053900 }  → Mass (1,053,900 kg)
│  ├─ { attribute_id: 38, value: 135 }     → Capacity (135 m³)
│  ├─ { attribute_id: 9, value: 1019 }     → Structure HP
│  ├─ { attribute_id: 265, value: 1219 }   → Armor HP
│  └─ { attribute_id: 263, value: 316 }    → Shield Capacity
│
└─ dogma_effects[] (5 effects)
   ├─ { effect_id: 511, is_default: false }
   ├─ { effect_id: 991, is_default: false }
   ├─ { effect_id: 1179, is_default: false }
   ├─ { effect_id: 4902, is_default: false }
   └─ { effect_id: 7018, is_default: false }
```

## Services

### DogmaAttributeService

Fetches attribute information for types from ESI.

**Methods:**

```typescript
// List all attribute IDs
const attributeIds = await DogmaAttributeService.getAllAttributeIds();
// Returns: [1, 2, 3, 4, 5, ...]

// Get details for a single attribute
const massAttribute = await DogmaAttributeService.getAttributeInfo(4);
// Returns: { attribute_id: 4, name: "mass", display_name: "Mass", unit_id: 1, ... }

// Fetch multiple attributes in batch
const attributes = await DogmaAttributeService.getBatchAttributeInfo([
  4, 38, 161,
]);
// Returns: [{ ... }, { ... }, { ... }]
```

### DogmaEffectService

Fetches effect information for types from ESI.

**Methods:**

```typescript
// List all effect IDs
const effectIds = await DogmaEffectService.getAllEffectIds();
// Returns: [1, 2, 3, 4, 5, ...]

// Get details for a single effect
const loPowerEffect = await DogmaEffectService.getEffectInfo(11);
// Returns: { effect_id: 11, name: "loPower", display_name: "Low power", modifiers: [...], ... }

// Fetch multiple effects in batch
const effects = await DogmaEffectService.getBatchEffectInfo([11, 12, 13]);
// Returns: [{ ... }, { ... }, { ... }]
```

## Usage Examples

### Example 1: Getting Dogma Information for a Type

```typescript
import { TypeService } from "./services/type/type.service";
import { DogmaAttributeService, DogmaEffectService } from "./services/dogma";

// 1. Get type information (example: Retribution - 11393)
const typeInfo = await TypeService.getTypeInfo(11393);

// 2. Process the type's attributes
if (typeInfo.dogma_attributes) {
  for (const attr of typeInfo.dogma_attributes) {
    const attrInfo = await DogmaAttributeService.getAttributeInfo(
      attr.attribute_id,
    );
    console.log(`${attrInfo.name}: ${attr.value}`);
  }
}

// 3. Process the type's effects
if (typeInfo.dogma_effects) {
  for (const effect of typeInfo.dogma_effects) {
    const effectInfo = await DogmaEffectService.getEffectInfo(effect.effect_id);
    console.log(
      `${effectInfo.name}: ${effect.is_default ? "Default" : "Optional"}`,
    );
  }
}
```

### Example 2: Finding a Specific Attribute

```typescript
// Get the mass attribute (attribute_id: 4)
const typeInfo = await TypeService.getTypeInfo(11393); // Retribution
const massAttr = typeInfo.dogma_attributes?.find((a) => a.attribute_id === 4);

if (massAttr) {
  const massInfo = await DogmaAttributeService.getAttributeInfo(4);
  console.log(`Ship Mass: ${massAttr.value} ${massInfo.display_name}`);
  // Output: Ship Mass: 1053900 Mass (1,053,900 kg)
}
```

### Example 3: Batch Fetching Retribution's Core Attributes

```typescript
// Fetch core attributes for the Retribution ship
const retributionAttributes = await DogmaAttributeService.getBatchAttributeInfo(
  [
    4, // mass: 1,053,900 kg
    38, // capacity: 135 m³
    9, // structure HP: 1,019
    265, // armor HP: 1,219
    263, // shield capacity: 316
    161, // volume: 28,600 m³
  ],
);

commonAttributes.forEach((attr) => {
  console.log(`${attr.display_name || attr.name}: ID ${attr.attribute_id}`);
});
```

## Common Attribute IDs

| ID  | Name           | Display Name | Description          |
| --- | -------------- | ------------ | -------------------- |
| 4   | mass           | Mass         | Item mass (kg)       |
| 38  | capacity       | Capacity     | Cargo capacity       |
| 161 | volume         | Volume       | Item volume          |
| 588 | shieldCapacity | Shield HP    | Shield hit points    |
| 263 | armorHP        | Armor HP     | Armor hit points     |
| 265 | hp             | Structure HP | Structure hit points |
| 9   | mass           | Mass         | Item mass            |
| 68  | shieldBonus    | Shield Bonus | Shield bonus amount  |

## Common Effect IDs

### General Effects

| ID  | Name           | Display Name | Description            |
| --- | -------------- | ------------ | ---------------------- |
| 11  | loPower        | Low power    | Low slot module        |
| 12  | hiPower        | Hi power     | High slot module       |
| 13  | medPower       | Med power    | Medium slot module     |
| 16  | online         | Online       | Module online status   |
| 4   | shieldBoosting | Shield Boost | Shield boosting effect |
| 10  | miningLaser    | Mining       | Mining laser effect    |

### Retribution Ship Effects

| ID   | Name                           | Description                            |
| ---- | ------------------------------ | -------------------------------------- |
| 511  | shipEnergyTCapNeedBonusAF      | Energy weapon capacitor need bonus     |
| 991  | eliteBonusGunshipLaserOptimal1 | Laser optimal range bonus (5% per lvl) |
| 1179 | eliteBonusGunshipLaserDamage2  | Laser damage bonus (10% per lvl)       |
| 4902 | MWDSignatureRadiusRoleBonus    | MWD signature radius reduction         |
| 7018 | shipSETROFAF                   | Small Energy Turret ROF bonus          |

## Test Scripts

Ready-made scripts to test services:

```bash
# Test attribute service
yarn test:dogma:attributes

# Test effect service
yarn test:dogma:effects

# Test Type with Dogma integration (Retribution example)
yarn example:type-dogma
```

### Example Output: Retribution Ship

```
🚀 Fetching Type with Dogma Information

📋 Step 1: Fetching type 11393 (Retribution)...
✅ Type: Retribution
   Group ID: 324 (Assault Frigate)
   Attributes: 97
   Effects: 5

📋 Step 4: Displaying Retribution key stats...
   ✅ Mass: 1,053,900 (Mass)
   ✅ Cargo Capacity: 135 (Capacity)
   ✅ Structure HP: 1,019 (Structure Hitpoints)
   ✅ Armor HP: 1,219 (Armor Hitpoints)
   ✅ Shield Capacity: 316 (Shield Capacity)
```

This example displays real data for Retribution, the famous Assault Frigate of the Amarr Empire.

## Use Cases for KillReport Project

1. **Killmail Item Details**: Display information about modules/weapons used in killmails
2. **Ship Stats**: Display core ship properties (HP, mass, capacity)
3. **Damage Analysis**: Analyze damage properties of weapon types
4. **Fitting Information**: Determine module slot types (hi/med/low)

## ESI Endpoints

- **All Attributes**: `GET /dogma/attributes/`
- **Attribute Details**: `GET /dogma/attributes/{attribute_id}/`
- **All Effects**: `GET /dogma/effects/`
- **Effect Details**: `GET /dogma/effects/{effect_id}/`

## Rate Limiting

All ESI calls are wrapped with `esiRateLimiter.execute()`. This guarantees compliance with ESI's 150 req/sec limit (project uses 50 req/sec across the board).

## Further Reading

- [ESI_DOGMA_HIERARCHY.MD](../ESI_DOGMA_HIERARCHY.MD) - Detailed Dogma system explanation
- [EVE ESI Documentation](https://esi.evetech.net/ui/) - Official ESI API documentation
