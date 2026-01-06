# Dogma Services

EVE Online'ın Dogma sistemi için servis katmanı. Dogma, EVE'deki item'ların (ship, module, vb.) özelliklerini ve davranışlarını tanımlayan sistem.

## Genel Bakış

### Dogma Nedir?

Dogma sistemi iki ana bileşenden oluşur:

1. **Dogma Attributes**: Item'ların sayısal özellikleri (mass, capacity, damage, shield HP, vb.)
2. **Dogma Effects**: Bu özelliklerin nasıl değiştirildiği (bonus'lar, skill effect'leri, module davranışları)

### Veri Akışı

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

## Servisler

### DogmaAttributeService

Type'lara ait attribute bilgilerini ESI'dan çeker.

**Methodlar:**

```typescript
// Tüm attribute ID'lerini listele
const attributeIds = await DogmaAttributeService.getAllAttributeIds();
// Returns: [1, 2, 3, 4, 5, ...]

// Tek bir attribute'un detaylarını al
const massAttribute = await DogmaAttributeService.getAttributeInfo(4);
// Returns: { attribute_id: 4, name: "mass", display_name: "Mass", unit_id: 1, ... }

// Birden fazla attribute'u toplu çek
const attributes = await DogmaAttributeService.getBatchAttributeInfo([
  4, 38, 161,
]);
// Returns: [{ ... }, { ... }, { ... }]
```

### DogmaEffectService

Type'lara ait effect bilgilerini ESI'dan çeker.

**Methodlar:**

```typescript
// Tüm effect ID'lerini listele
const effectIds = await DogmaEffectService.getAllEffectIds();
// Returns: [1, 2, 3, 4, 5, ...]

// Tek bir effect'in detaylarını al
const loPowerEffect = await DogmaEffectService.getEffectInfo(11);
// Returns: { effect_id: 11, name: "loPower", display_name: "Low power", modifiers: [...], ... }

// Birden fazla effect'i toplu çek
const effects = await DogmaEffectService.getBatchEffectInfo([11, 12, 13]);
// Returns: [{ ... }, { ... }, { ... }]
```

## Kullanım Örnekleri

### Örnek 1: Type'ın Dogma Bilgilerini Almak

```typescript
import { TypeService } from "./services/type/type.service";
import { DogmaAttributeService, DogmaEffectService } from "./services/dogma";

// 1. Type bilgisini al (örnek: Retribution - 11393)
const typeInfo = await TypeService.getTypeInfo(11393);

// 2. Type'ın attribute'larını işle
if (typeInfo.dogma_attributes) {
  for (const attr of typeInfo.dogma_attributes) {
    const attrInfo = await DogmaAttributeService.getAttributeInfo(
      attr.attribute_id
    );
    console.log(`${attrInfo.name}: ${attr.value}`);
  }
}

// 3. Type'ın effect'lerini işle
if (typeInfo.dogma_effects) {
  for (const effect of typeInfo.dogma_effects) {
    const effectInfo = await DogmaEffectService.getEffectInfo(effect.effect_id);
    console.log(
      `${effectInfo.name}: ${effect.is_default ? "Default" : "Optional"}`
    );
  }
}
```

### Örnek 2: Belirli Bir Attribute'u Bulmak

```typescript
// Mass attribute'unu al (attribute_id: 4)
const typeInfo = await TypeService.getTypeInfo(11393); // Retribution
const massAttr = typeInfo.dogma_attributes?.find((a) => a.attribute_id === 4);

if (massAttr) {
  const massInfo = await DogmaAttributeService.getAttributeInfo(4);
  console.log(`Ship Mass: ${massAttr.value} ${massInfo.display_name}`);
  // Output: Ship Mass: 1053900 Mass (1,053,900 kg)
}
```

### Örnek 3: Retribution'ın Temel Özelliklerini Toplu Çekmek

```typescript
// Retribution gemisinin temel attribute'larını çek
const retributionAttributes = await DogmaAttributeService.getBatchAttributeInfo(
  [
    4, // mass: 1,053,900 kg
    38, // capacity: 135 m³
    9, // structure HP: 1,019
    265, // armor HP: 1,219
    263, // shield capacity: 316
    161, // volume: 28,600 m³
  ]
);

commonAttributes.forEach((attr) => {
  console.log(`${attr.display_name || attr.name}: ID ${attr.attribute_id}`);
});
```

## Yaygın Attribute ID'leri

| ID  | Name           | Display Name | Açıklama             |
| --- | -------------- | ------------ | -------------------- |
| 4   | mass           | Mass         | Item kütlesi (kg)    |
| 38  | capacity       | Capacity     | Kargo kapasitesi     |
| 161 | volume         | Volume       | Item hacmi           |
| 588 | shieldCapacity | Shield HP    | Kalkan hit point'i   |
| 263 | armorHP        | Armor HP     | Zırh hit point'i     |
| 265 | hp             | Structure HP | Yapı hit point'i     |
| 9   | mass           | Mass         | Item kütlesi         |
| 68  | shieldBonus    | Shield Bonus | Kalkan bonus miktarı |

## Yaygın Effect ID'leri

### Genel Effect'ler

| ID  | Name           | Display Name | Açıklama                  |
| --- | -------------- | ------------ | ------------------------- |
| 11  | loPower        | Low power    | Low slot module           |
| 12  | hiPower        | Hi power     | High slot module          |
| 13  | medPower       | Med power    | Medium slot module        |
| 16  | online         | Online       | Module online durumu      |
| 4   | shieldBoosting | Shield Boost | Kalkan iyileştirme effect |
| 10  | miningLaser    | Mining       | Mining laser effect       |

### Retribution Ship Effect'leri

| ID   | Name                           | Açıklama                               |
| ---- | ------------------------------ | -------------------------------------- |
| 511  | shipEnergyTCapNeedBonusAF      | Energy weapon capacitor need bonus     |
| 991  | eliteBonusGunshipLaserOptimal1 | Laser optimal range bonus (5% per lvl) |
| 1179 | eliteBonusGunshipLaserDamage2  | Laser damage bonus (10% per lvl)       |
| 4902 | MWDSignatureRadiusRoleBonus    | MWD signature radius reduction         |
| 7018 | shipSETROFAF                   | Small Energy Turret ROF bonus          |

## Test Scriptleri

Servisleri test etmek için hazır scriptler:

```bash
# Attribute servisini test et
yarn test:dogma:attributes

# Effect servisini test et
yarn test:dogma:effects

# Type ile Dogma entegrasyonunu test et (Retribution örneği)
yarn example:type-dogma
```

### Örnek Çıktı: Retribution Gemisi

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

Bu örnek, Amarr Empire'ın ünlü Assault Frigate'i Retribution'ın gerçek verilerini göstermektedir.

## KillReport Projesi İçin Kullanım Alanları

1. **Killmail Item Detayları**: Killmail'de kullanılan module/weapon bilgilerini göstermek
2. **Ship Stats**: Ship'lerin temel özelliklerini (HP, mass, capacity) göstermek
3. **Damage Analysis**: Weapon type'larının damage özelliklerini analiz etmek
4. **Fitting Bilgileri**: Module slot türlerini (hi/med/low) belirlemek

## ESI Endpoints

- **Tüm Attribute'lar**: `GET /dogma/attributes/`
- **Attribute Detayı**: `GET /dogma/attributes/{attribute_id}/`
- **Tüm Effect'ler**: `GET /dogma/effects/`
- **Effect Detayı**: `GET /dogma/effects/{effect_id}/`

## Rate Limiting

Tüm ESI çağrıları `esiRateLimiter.execute()` ile sarmalanmıştır. Bu, ESI'ın 150 req/sec limitine uymayı garanti eder (proje genelinde 50 req/sec kullanılıyor).

## İleri Okuma

- [ESI_DOGMA_HIERARCHY.md](../ESI_DOGMA_HIERARCHY.md) - Detaylı Dogma sistem açıklaması
- [EVE ESI Documentation](https://esi.evetech.net/ui/) - Resmi ESI API dokümantasyonu
