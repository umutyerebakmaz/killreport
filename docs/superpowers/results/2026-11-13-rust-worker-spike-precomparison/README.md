# Rust worker denemesi — Linux ön karşılaştırmasının ham verileri

Sonuçlar ve yorumu spec'te:
[`../../specs/2026-11-12-rust-worker-spike-design.md`](../../specs/2026-11-12-rust-worker-spike-design.md),
bölüm _Ön karşılaştırma (Linux container, 2026-11-13)_. Bu klasör o bölümün
dayandığı verileri saklar.

| Dosya                        | İçerik                                                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compare.sh`                 | Ölçümü yapan script, çalıştırıldığı haliyle. Oturumun container'ına özgü yollar ve sahte `EVE_CLIENT_*` değerleri içerir; yeniden kullanmadan önce yollar uyarlanmalı. |
| `mem-node.csv`, `mem-rs.csv` | 5 saniyede bir bellek örneği: geçen saniye, worker sürecinin RSS'i (KB), süreç grubunun toplam RSS'i (KB), gruptaki süreç sayısı.                                      |
| `csv-checksums.txt`          | Koşulardan sonra alınan iki `alliances` CSV'sinin SHA-256 özeti ve satır sayısı. Özetler aynı: iki tablo birebir aynı.                                                 |
| `log-excerpts.txt`           | İki worker log'unun açılış satırları, işlenen mesaj sayısı, worker'ın kendi hata/throttle mesajlarının sayısı ve özet satırı.                                          |

Repoya alınmayanlar: iki CSV'nin kendisi (300 KB'lık iki aynı dosya; özetleri
yukarıda) ve log'ların tamamı (400 KB'lık iki dosya, satır başına bir
alliance). Log'ları sayarken dikkat: `ERROR`, `limited` gibi kelimeler alliance
adlarında da geçiyor ("Error 404 Alliance Not Found" adında gerçek bir alliance
var), bu yüzden sayımlar worker'ın kendi mesaj kalıplarına göre yapıldı.
