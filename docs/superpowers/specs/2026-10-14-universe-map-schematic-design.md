# Evren haritası — şematik yerleşim ve galaktik görünüme animasyonlu geçiş

**Tarih:** 2026-10-14
**Durum:** tasarım, incelemeye hazır
**Üzerine kurulduğu iş:** #289 (sov katmanı ve URL'deki katman), #279 (`sde:meta-groups`, SDE import kalıbı)

---

## 1. Neden

`/map` bugün sistemleri galaktik konumlarına göre, yukarıdan bakılmış gibi
çiziyor: `sprite.position.set(node.x, node.z)`, yükseklik (`y`) atılıyor. Bu
düzende sistemler üst üste biniyor — K-space ve Pochven'de en yakın iki sistem arasında
4.86e13 m var — ve oyuncuların oyun içinde alıştığı harita bu değil.

Oyunun 2D haritası CCP'nin kendi şematik yerleşimi. zKillboard'ın canlı
haritası (`zkillboard.com/map/index.html`) bunu kullanıyor ve iki yerleşim
arasında animasyonla geçiyor. Kaynağı incelendi: yerleşimi kendisi hesaplamıyor,
CCP'nin SDE'sinden hazır alıyor.

Hedef: `/map` şematik yerleşimle açılsın, bir düğmeyle bugünkü galaktik
yerleşime animasyonla geçilsin.

**Kapsam dışı:** döndürülebilir, eğilebilir gerçek 3D kamera. İki görünüm de
düz; zKillboard'ın "3D" modu da yalnızca `x/z` kullanıyor ve dönmüyor. Gerçek 3D
render motorunun değişmesi demek (Pixi 2D bir motor) ve kendi spec'i olacak.

---

## 2. Veri kaynağı: SDE `position2D`

CCP'nin JSONL SDE'sinde (`eve-online-static-data-latest-jsonl.zip`, build 3607705) `mapSolarSystems.jsonl` her sistem için iki konum taşıyor:

```json
"position":   {"x": -8.851e+16, "y": 4.236e+16, "z": -4.451e+16},
"position2D": {"x":  6.985e+16, "y": -7.190e+16}
```

ESI bu alanı vermiyor; tek kaynak SDE.

2026-10-14'te indirilen build üzerinde ölçülenler:

| Ölçüm                                 | Değer                                                |
| ------------------------------------- | ---------------------------------------------------- |
| `position2D` olan sistem              | 5485 / 8490                                          |
| K-space (5458) ve Pochven (27)        | hepsinde var                                         |
| Wormhole (2604), Abyssal ve diğerleri | hiçbirinde yok                                       |
| Eksen eşleşmesi                       | `2D.x ~ x` r=0.98, `2D.y ~ z` r=0.98                 |
| Yerleşim genişliği                    | 2D 1.09e18 × 1.26e18 m, galaktik 8.45e17 × 9.57e17 m |
| En yakın iki sistem                   | 2D 4.59e15 m, galaktik 4.86e13 m                     |
| En büyük sistem yarıçapı              | 1.52e13 m                                            |

Bundan çıkanlar:

- **Birim aynı.** 2D koordinatlar galaktik metreyle aynı büyüklükte. Zoom
  sınırları, `radius`'ta diske dönüşme, gezegenler, float origin
  (`utils/map/origin.ts`) olduğu gibi çalışır.
- **Çakışma yok.** En yakın iki sistem arası en büyük yarıçapın 300 katı.
- **Eksen çevirmesi yok.** `position2D.y` doğrudan haritanın `z`'sine gider;
  `z`'yi ekranda çeviren tek yer zaten `cameraTransform` (`utils/map/camera.ts:105`,
  `scaleY: -scale`).
- **Geri düşüş gerekmez.** NEW_EDEN ve POCHVEN sahnelerinin her sisteminde 2D
  var; WORMHOLE sahnesinin hiçbirinde yok. Sistem başına karışık yerleşim hiçbir
  sahnede oluşmaz.

---

## 3. Şema ve migration

`backend/prisma/schema/solarSystem.prisma`'ya iki kolon:

```prisma
position_2d_x Float?
position_2d_y Float?
```

İsimler SDE'deki `position2D {x, y}`'yi birebir yansıtır. `y → z` çevirisi
serviste yapılır; veritabanı kaynağı olduğu gibi tutar.

Migration CLAUDE.md'deki diff-and-deploy prosedürüyle elle yazılır ve yalnızca
`ALTER TABLE solar_systems ADD COLUMN ...` içerir. Beş elle yönetilen tablonun
`DROP`'ları diff'ten silinir, satır sayıları önce ve sonra karşılaştırılır. Bu
adım `database` agent'ına verilir.

**Worker'la çakışma yok.** `worker-solar-systems`'in `systemRow`'u yalnızca ESI
alanlarını yazıyor (`backend/src/workers/worker-solar-systems.ts:67-76`), yani
ESI'den yeniden tarama 2D kolonları silmez. ESI'den sonradan gelen yeni bir
sistemin 2D'si import yeniden çalışana kadar boş kalır ve şematik sahnede
görünmez (bkz. §4).

---

## 4. Import

#279'daki `sde:meta-groups` kalıbının kopyası:

- **`backend/package.json`**, tek satır:

  ```text
  "sde:map-2d": "curl -fsSL https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip -o /tmp/killreport-sde.zip && unzip -p /tmp/killreport-sde.zip mapSolarSystems.jsonl | tsx src/scripts/import-sde-map-2d.ts"
  ```

- **`backend/src/helpers/sde-map-2d.ts`**: `parseMap2dLine(line): [id, x, y] | null`.
  Saf fonksiyon. `position2D` olmayan satır, boş satır ve bozuk JSON `null`.
- **`backend/src/scripts/import-sde-map-2d.ts`**: stdin'den okur, 1000'lik
  parçalar halinde

  ```sql
  UPDATE solar_systems s
  SET position_2d_x = v.x, position_2d_y = v.y
  FROM unnest(${ids}::int[], ${xs}::float8[], ${ys}::float8[]) AS v(id, x, y)
  WHERE s.system_id = v.id
    AND (s.position_2d_x IS DISTINCT FROM v.x OR s.position_2d_y IS DISTINCT FROM v.y)
  RETURNING s.system_id
  ```

  Yalnızca var olan ve değeri değişen satırlar. Girdi boşsa hata verir.
  Sonunda `map:geometry:*` ve `map:labels:*` Redis anahtarlarını siler,
  güncellenen satır sayısını loglar. `prismaWorker` kullanır.

- **Zamanlama yok.** Statik veri: elle, bir kez; yeni bir SDE build'i yeni
  sistem eklediğinde yeniden. `ecosystem.config.js`'e ve crontab'a girmez.

---

## 5. GraphQL ve servisler

### 5.1 Şema

`backend/src/schemas/UniverseMap.graphql`:

```graphql
"""
Which layout a scene is drawn in. Both are flat: SCHEMATIC is CCP's own 2D map
from the SDE's position2D, GALACTIC is the real position seen from above.
WORMHOLE has no schematic layout and is always GALACTIC, whatever is asked.
"""
enum MapProjection {
  SCHEMATIC
  GALACTIC
}

mapGeometry(scope: MapScope! = NEW_EDEN, projection: MapProjection! = SCHEMATIC): MapGeometry!
mapLabels(scope: MapScope! = NEW_EDEN, kind: MapLabelKind!, projection: MapProjection! = SCHEMATIC): [MapLabel!]!
```

`MapNode`, `MapLabel` ve `MapBounds` değişmez: `x/z` istenen projeksiyonun
koordinatıdır. `x/z` okuyan frontend modülleri (pick, framing, edges, labels,
sov, campaign marks) bu sayede hiç değişmez.

`mapCelestials` değişmez: koordinatları sistem merkezine göreli.

### 5.2 `universe-map.service.ts`

- `getMapGeometry(scope, projection)`. WORMHOLE'da `projection` `GALACTIC`'e
  sabitlenir.
- `SCHEMATIC`: `scoped` CTE'si `position_2d_x AS x, position_2d_y AS z` seçer,
  `IS NOT NULL` filtresi bu kolonlara uygulanır. `bounds` seçilen yerleşimden.
  `radius` (gezegen uzantısı) ve `edges` aynı kalır.
- Cache anahtarı `map:geometry:${scope}:${projection}`, TTL değişmez (86400 s).

### 5.3 `map-labels.service.ts`

- `getMapLabels(scope, kind, projection)`, WORMHOLE'da yine `GALACTIC`.
- **Bölge:** medoid, seçilen yerleşimin sistem koordinatlarıyla hesaplanır;
  `bounds` da öyle.
- **Takımyıldız:** SDE'de takımyıldızın 2D konumu yok. `SCHEMATIC`'te etiket
  üye sistemlerin 2D koordinatlarının `AVG`'sine konur; `GALACTIC`'te bugünkü
  `constellations.position_x/z`.
- Anahtar `map:labels:v3:${scope}:${kind}:${projection}`. `v3`, eski `v2`
  satırlarının yeni koddan okunmaması için.

### 5.4 Response cache

`config/cache.ts:92`'deki `PUBLIC_CACHE_QUERIES` sorgu adına göre bakıyor,
anahtar değişkenleri de içeriyor; iki projeksiyon ayrı cache'lenir. Değişiklik
yok.

---

## 6. Frontend

### 6.1 URL

Projeksiyon `layer` gibi URL durumu; sahibi URL'in tek yazarı `useMapCamera`.

- `utils/map/camera.ts`: `parseProjection(params)` — `view=galactic` →
  `GALACTIC`, başka her şey `SCHEMATIC`. `cameraQuery` ve `sharedMapUrl`
  `projection` parametresini zorunlu alır (`layer`'ın gerekçesiyle: unutan bir
  yazım URL'den silerdi) ve `view=galactic`'i yalnızca galaktikte yazar.
- WORMHOLE'da `view` yazılmaz ve okunmaz.
- `?focus=` linkleri iki görünümde de çalışır: sistemi ID'den çerçeveliyorlar.
- **Kabul edilen bozulma:** `x/z/zoom` taşıyan eski adres çubuğu URL'leri artık
  şematik uzayda okunur ve başka bir yere açılır. Paylaşılan linkler kamera
  taşımadığı için (`sharedMapUrl`) etkilenmez.

### 6.2 Düğme

`MapLayerSwitch` jenerik bir `MapSwitch`'e dönüşür:
`{ options: { id, label }[], value, onChange }`. İki kez kullanılır: katmanlar
ve `Schematic | Galactic`. Yeni stil yok: `button-ghost` ve `aria-pressed`,
bugünkü gibi. Sol üst sütunda katman düğmesinin altında durur. WORMHOLE
sahnesinde gösterilmez.

### 6.3 Veri

`UniverseMap` (`mapGeometry`) ve `useMapLabels` aktif projeksiyonla sorgular.
Düğmeye basıldığında hedef projeksiyonun geometrisi yüklenir; morph iki geometri
de elde olunca başlar. Yükleme sürerken düğme basılı görünür, harita yerinde
kalır. Apollo cache'i iki geometriyi tuttuğu için geri dönüş beklemesiz.

### 6.4 Morph

**`utils/map/morph.ts`** (saf):

- `MORPH_DURATION_MS = 600`, `easeInOut(t)`.
- `lerpNodes(from, to, t)`: `systemId` eşleşmesiyle her node için ara konum.
  Yalnızca bir tarafta olan node (şematikte 2D'si henüz import edilmemiş yeni
  sistem) morph'ta yer almaz.
- `morphTarget({ camera, fitFrom, fitTo, anchorFrom, anchorTo })`: kamera
  `fitFrom`'daysa (kullanıcı kaydırmamış) hedef `fitTo`. Değilse çapanın ekrandaki
  yeri sabit kalacak şekilde `camera.x/z` çapanın yer değiştirmesi kadar
  kaydırılır, zoom aynı. Çapa: seçili sistem (`focus`), yoksa ekran merkezine en
  yakın sistem (`nearestNode`).

**`components/UniverseMap/useProjectionMorph.ts`**, `useRingSpin` gibi Pixi
ticker'ına bağlanır:

1. **Başta:** `edgesGalaxy`, `edgesHighlight`, `edgesLocal`, `discs`,
   `celestials`, `rings` ve DOM etiketleri gizlenir; popup ve hover kapanır;
   pointer girdisi yok sayılır.
2. **600 ms boyunca:** her karede sprite'lar `lerpNodes` ile konumlanır, sahne
   transform'u kameranın `lerp`'iyle güncellenir. React state'e ve URL'e
   yazılmaz.
3. **Sonda:** sahne yeni geometriyle normal yoldan kurulur (kenarlar, diskler,
   etiketler, halkalar), kamera `onCameraChange` ile bir kez yazılır, gizlenenler
   görünür olur, pointer açılır.

**Neden yalnızca noktalar:** kenar Graphics'i bir kez kurulmak üzere tasarlandı,
~14.400 segment (`scene/edges.ts:35`). Her karede yeniden kurmak takılma
getirir. Çizgilerin de kayması (GPU'da iki vertex attribute'lu özel shader)
mümkün ama bu işin kapsamı dışında.

**`prefers-reduced-motion`:** morph atlanır, adım 3 doğrudan çalışır.

---

## 7. Dağıtım sırası

1. Migration (`npx prisma migrate deploy`).
2. `yarn workspace backend sde:map-2d`.
3. Backend ve frontend.

Import'tan önce `SCHEMATIC` boş sahne döner ve varsayılan görünüm bu olduğu
için harita boş açılır; 2. adım atlanamaz.

---

## 8. Test ve doğrulama

**Backend**

- `parseMap2dLine`: `position2D` olan satır, olmayan satır, boş satır, bozuk JSON.
- `universe-map.service` ve `map-labels.service`: `projection`'ın SQL'e ve cache
  anahtarına girdiği, WORMHOLE'da `GALACTIC`'e sabitlendiği.

**Frontend**

- `morph.ts`: `t=0` ve `t=1` uçları, tek tarafta olan node, fit hedefi, çapa
  hedefi.
- `camera.ts`: `view` parse ve yazma; varsayılanda yazılmadığı; WORMHOLE'da yok
  sayıldığı.
- `MapSwitch`: seçili segmentin `aria-pressed`'i; WORMHOLE'da projeksiyon
  düğmesinin gizlendiği.

**Veri**

- Import sonrası `SELECT COUNT(*) FROM solar_systems WHERE position_2d_x IS NOT NULL`
  ≈ 5485 (veritabanındaki K-space ve Pochven sistem sayısı kadar).
- `mapGeometry(scope: NEW_EDEN, projection: SCHEMATIC)` doğrudan backend'e
  sorgulanır: node sayısı galaktikle aynı, `bounds` 2D genişliğinde.

Görsel kontrol (yerleşimin oyundakiyle örtüşmesi, morph'un akıcılığı)
kullanıcıda.
