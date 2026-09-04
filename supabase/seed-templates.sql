-- ===========================================================
-- Infarm CS — isi tabel templates & template_rules
-- Dibangkitkan dari berkas .md pada 4 September 2026.
--
-- Prasyarat: supabase/schema.sql dan schema-kb.sql sudah
-- dijalankan lebih dulu.
--
-- Isi: 152 template, 43 aturan pemicu.
--
-- Ini BUKAN data karangan — isinya balasan CS yang sungguhan
-- dipakai, disalin apa adanya dari keempat berkas FAQ.
--
-- Cara pakai: SQL Editor → tempel seluruh isi → Run
--
-- Sifat: idempoten. Menjalankan ulang MEMPERBARUI isi template
-- dari berkas .md (on conflict do update), jadi berkas tetap
-- bisa dipakai sebagai sumber selama tabel belum jadi acuan.
--
-- ⚠️  Setelah tim CS mulai mengedit lewat halaman Kelola
-- Template, JANGAN jalankan ulang berkas ini — suntingan mereka
-- akan tertimpa isi berkas .md yang lebih lama.
-- ===========================================================

begin;

-- ---------- templates ----------
insert into public.templates
  (code, category_slug, body, action, is_active, is_sensitive, note)
values
  ('BANTU', 'interaksi', 'Halo kak, apa ada yang bisa mimin bantu?😊🙏', 'AUTO_REPLY', true, false, NULL),
  ('BANTU LAGI', 'interaksi', 'Baik kak. Ada yang bisa aku bantu lagi kah?😊🙏', 'AUTO_REPLY', true, false, NULL),
  ('AKHIRI', 'interaksi', 'Baik ka, jika sudah tidak ada lagi yang ingin ditanyakan minfarm mohon izin ya untuk mengakhiri chat nya. Silahkan hubungi minfarm kembali jika ada yang ingin ditanyakan. Have a nice day dan sehat selalu kakak 🥰🥰', 'AUTO_REPLY', true, false, NULL),
  ('REQ BENIH', 'interaksi', 'Halo kak silahkan cek etalase benih ini ya untuk req benih. Saat ini benih yang sedang kosong BAYAM MERAH, KALE, dan KALE NERO 🙏🙏🙏', 'AUTO_REPLY', true, false, NULL),
  ('SENIN', 'interaksi', 'Halo kak pesanan kakak sudah terkonfirmasi. Mohon berkenan menunggu ya karena tim packing kami off selama akhir pekan maka pesanan yang masuk di akhir pekan akan kami proses dan kirim di hari senin. Terimakasih banyak 😊🙏', 'AUTO_REPLY', true, false, NULL),
  ('KIRIM BESOK', 'interaksi', 'Halo kak terimakasih sudah order, untuk pesanan diatas jam 10 akan kami proses besok ya kak, mohon ditunggu😊🙏
🌱 NANAM LEBIH MUDAH, PASTI PANEN🌱', 'AUTO_REPLY', true, false, NULL),
  ('MAKSIMALKAN', 'interaksi', 'Halo kak dimaksimalkan kirim hari ini ya kak mohon ditunggu🥰🙏', 'AUTO_REPLY', true, false, NULL),
  ('OVERLOAD', 'interaksi', 'Hai kak 
Mohon maaf karna pengirman kami sedang overload jadi ada sedikit keterlambatan kak😢
Mohon ditunggu yah kak sedang kami maksimalkan pengiriman hari ini  kak 🙏😊', 'AUTO_REPLY', true, false, NULL),
  ('KOMPLAIN', 'interaksi', 'Halo kak mohon maaf atas ketidaknyamanannya🥺🙏🙏 apa boleh dibantu kirim video unboxingnya kak?🙏', 'AUTO_REPLY', true, false, NULL),
  ('LIBUR', 'interaksi', 'Halo ka untuk pesanan kaka sudah aku terima mohon ditunggu proses kirim hari operasional berikutnya ya kak karena hari minggu dan tanggal merah toko libur, terimakasih😊🙏', 'AUTO_REPLY', true, false, NULL),
  ('BONUS', 'interaksi', 'Hai ka untuk bonus paket berupa e-book dan grup konsultasi nanti kaka bisa klaim dengan cara scan qr code yang ada di thankyou card kalau paket sudah datang ya kak🥰🙏', 'AUTO_REPLY', true, false, NULL),
  ('INSTANT', 'interaksi', 'Halo kak!

Pesanan instant yang masuk dibawah jam 15.00 WIB akan dikirim di hari yang sama, sementara pesanan diatas jam 15.00 WIB akan dikiirm di jam operasional toko berikutnya yaa

Mohon berkenan menunggu, pesanan kakak akan kami maksimalkan agar bisa terkirim sesuai jadwal 🥰🥰🥰', 'AUTO_REPLY', true, false, NULL),
  ('OFFLINE', 'interaksi', 'Hai ka mohon maaf saat ini belum tersediaoffline karena adanya keterbatasan lokasi🥺🙏
Silahkan order secara online dulu ya kak, soon akan segera buka offline mohon doanya ka😊🙏', 'AUTO_REPLY', true, false, NULL),
  ('PENGEMBANGAN', 'interaksi', 'Hai kak
Mohon maaf saat ini produk sedang dalam pengembangan jadi tdk bisa diorder, diusahakan secepatnya agar produk bisa segera diorder kembali ya kak nanti akan di info di instag.ram🥰🥰', 'AUTO_REPLY', true, false, NULL),
  ('LACAK', 'interaksi', 'Hai ka untuk posisi paket kaka bisa cek secara berkala di menu lacak pesanan ya kak🙏😊', 'AUTO_REPLY', true, false, NULL),
  ('EKSPEDISI', 'interaksi', 'Hai ka untuk kendala ekspedisi ini sudah diluar kuasa seller ya ka, aku hanya bisa bantu untuk follow up ke ekspedisi terkait mohon ditunggu ya kak🙏', 'AUTO_REPLY', true, false, NULL),
  ('KONFIRMASI PESANAN', 'interaksi', 'Hai ka untuk pesanan sudah aku terima, mohon ditunggu proses kirim ya kak, terimakasih😊🙏

Jika pesanan sudah diterima mohon rekam 𝘃𝗶𝗱𝗲𝗼 𝘂𝗻𝗯𝗼𝘅𝗶𝗻𝗴 dari awal hingga akhir yang memperlihatkan resi dengan jelas. Komplain tidak akan kami proses tanpa video unboxing. 🙏🙏

🌱 NANAM LEBIH MUDAH, PASTI PANEN🌱', 'AUTO_REPLY', true, false, NULL),
  ('READY', 'interaksi', 'Hai ka untuk produknya ready yah ka, rencana mau ambil berapa pcs ka biar aku bantu siapin😊🙏', 'AUTO_REPLY', true, false, NULL),
  ('INFARM', 'interaksi', 'Terima kasih telah mempercayakan kebutuhanmu pada Infarm.id 🌿
kami harapkan review terbaik dari kakak yaa kak..
selamat dan sukses selalu berkebunnya 😊🙏
Ditunggu orderan selanjutnya ya 😊🙏

🌱 NANAM LEBIH MUDAH, PASTI PANEN🌱', 'AUTO_REPLY', true, false, NULL),
  ('TQ', 'interaksi', 'Baik terimakasih kak😊🙏', 'AUTO_REPLY', true, false, NULL),
  ('PROSES REQ', 'interaksi', 'Halo ka baik siap aku bantu catat sesuai request yah ka🥰🙏', 'AUTO_REPLY', true, false, NULL),
  ('REKENING', 'interaksi', 'BCA - 7625012350
A.N I Dewa Gede Agung', 'AUTO_REPLY', false, true, 'Memuat nomor rekening/telepon — dimatikan agar tidak terkirim otomatis (claude-core.md melarang mengarahkan transaksi ke luar marketplace).'),
  ('PICKUP', 'interaksi', 'Halo ka untuk pesanan kaka sudah di proses, mohon ditunggu ya kaa tinggal nunggu ekspedisi untuk pick up🙏🙏🙏', 'AUTO_REPLY', true, false, NULL),
  ('DATA', 'interaksi', 'Baik ka apa bisa dibantu untuk data nama dan nomor yang aktif kah untuk aku bantu proses kirim ulang kak🙏🙏🙏', 'AUTO_REPLY', true, false, NULL),
  ('RESI REVISI', 'interaksi', 'Hai ka berikut aku infokan untuk nomor resi kirim ulang barang kaka yang kurang yah🙏😊', 'AUTO_REPLY', true, false, NULL),
  ('KOSONG', 'interaksi', 'Halo kak!

Mohon maaf kak sementara produk yang kakak cari sedang kosong 😢😢😢
Saat ini kami sedang mengusahakan agar produk tersebut dapat segera restock kembali

Agar kakak mendapatkan info saat produk sudah kembali restokck, kakak bisa masukkan produk kami ke wishlist dulu yaaa

Terimakasih banyak 😊🙏🙏', 'AUTO_REPLY', true, false, NULL),
  ('HARGA', 'interaksi', 'Halo kak!

Harga produk bisa dilihat di bawah gambar di halaman produk yaa 😊🙏

Kakak juga dapat melihat apakah ada diskon atau promo yang tersedia untuk produk yang diinginkan di bawah nama produk', 'AUTO_REPLY', true, false, NULL),
  ('KIRIM REGULER', 'interaksi', 'Halo kak!

Pesanan reguler yang masuk dibawah jam 10.00 WIB akan dikirim di hari yang sama, sementara pesanan diatas jam 10.00 WIB akan dikiirm di jam operasional toko berikutnya yaa

Mohon berkenan menunggu, pesanan kakak akan kami maksimalkan agar bisa terkirim sesuai jadwal 🥰🥰🥰', 'AUTO_REPLY', true, false, NULL),
  ('KIRIM INSTANT', 'interaksi', 'Halo kak!

Pesanan instant yang masuk dibawah jam 13.00 WIB akan dikirim di hari yang sama, sementara pesanan diatas jam 10.00 WIB akan dikiirm di jam operasional toko berikutnya yaa

Mohon berkenan menunggu, pesanan kakak akan kami maksimalkan agar bisa terkirim sesuai jadwal 🥰🥰🥰', 'AUTO_REPLY', true, false, NULL),
  ('OTW', 'interaksi', 'Halo kak
Kami cek pesanannya sedang dalam pengiriman, mohon ditunggu ya 😊🙏', 'AUTO_REPLY', true, false, NULL),
  ('GARANSI', 'interaksi', 'Halo kak 🥰🥰🥰

Untuk menjamin kepuasan dari pelanggan infarm, kami menyediakan garansi selama 7 hari.

Syarat klaim:
1. Video unboxing paket (tampilkan nomor resi dan inisial packer untuk data toko). Video tidak boleh diedit dan harus menampilkan paket saat masih dalam kondisi tertutup
2. Sertakan data diri kakak untuk data toko melakukan follow up (meliputi nama, nomor telp, dan alamat lengkap)

Mohon menyertakan syarat klaim saat melakukan komplain. Tidak menyertakan syarat komplain, toko dapat menolak komplain 🙏🙏🙏', 'AUTO_REPLY', true, false, NULL),
  ('REQ RANDOM', 'interaksi', 'Halo kak, untuk benih terkadang ada yang kosong ya kak🙏 jadi semisal nanti kaka req tbtb benih nya kebetulan lagi kosong akan kami kirimkan benih random ya kak😊 terimakasih🙏', 'AUTO_REPLY', true, false, NULL),
  ('PAKAI ABMB', 'cara-pakai', 'Cara Penggunaan AB MIX
1. Larutkan semua nutrisi A ke Aquades hingga volume 500 ml
2. Larutkan semua nutrisi B ke Aquades hingga volume 500ml
3. Siapkan 1 Liter air
4. Ambil 5ml (kira-kira satu tutup botol) nutrisi A dan 5 ml nutrisi B
5. Campurkan nutrisi A (5ml) dan nutrisi B (5ml) ke dalam 1 L air
6. Siram ke tanah/hidroponik 7 hari sekali

Catatan : Stok nutrisi A dan nutrisi B tidak boleh dicampur karena akan terjadi pengkristalan', 'AUTO_REPLY', true, false, NULL),
  ('PAKAI NEEM', 'cara-pakai', 'Berikut cara penggunaan neem oil atau pestisida infarm

Dosis
Pencegahan: 5ml/L
Penanganan: 30ml/L

Aplikasi
1. Semprotkan campuran neem oil/pestisida dan air secara merata ke seluruh bagian tanaman yang terkena hama
2. Pengaplikasian dilakukan setiap hari sampai hama bersih
3. Sebaiknya diaplikasikan di pagi atau sore hari', 'AUTO_REPLY', true, false, NULL),
  ('PAKAI POC', 'cara-pakai', 'Cara penggunaan POC:

Larutkan POC dengan dosis 2 pump per liter air
Siram ke media tanam secara merata
Interval pemakaian 1 kali dalam seminggu', 'AUTO_REPLY', true, false, NULL),
  ('PAKAI FRUITEXPERT', 'cara-pakai', 'Hai ka ini dipakainya selang seling jeda seminggu ya ka, jadi minggu pertama pakai fruit expert dan minggu kedua pakai poc ya ka😍😊

untuk takarannya :
Fruit expert 4gr (1 tutup botol) dilarutkan ke 1L air
POC buah 2 pump diencerkan ke 1L air', 'AUTO_REPLY', true, false, NULL),
  ('PAKAI ABMC', 'cara-pakai', 'Cara penggunaan AB MIX instant:

1. Ambil 5ml (kira-kira satu tutup botol) nutrisi A dan 5 ml nutrisi B
2. Campurkan nutrisi A (5ml) dan nutrisi B (5ml) ke dalam 1 L air
3. Siram ke tanah/hidroponik 7 hari sekali

Catatan : Stok nutrisi A dan nutrisi B tidak boleh dicampur karena akan terjadi pengkristalan', 'AUTO_REPLY', true, false, NULL),
  ('PAKAI AKAR', 'cara-pakai', 'Cara penggunaan nutrisi akar:

Untuk Stek
1. Encerkan hormon akar dengan takaran 0,5 ml/L air
2. Rendam batang stek sealam 5 menit
3. Batang stek siap ditanam

Untuk Nutrisi Akar
1. Encerkan hormon akar dengan takaran 0,5 ml/L air
2. Siram secara merata ke area perakaran', 'AUTO_REPLY', true, false, NULL),
  ('BIVI', 'cara-pakai', 'Cara Pakai Singkat:
1. Pencegahan: 0,5 gr/liter air, semprot ke daun dan batang
2. Pengendalian: 1 gr/liter air
3. Ulangi tiap 3–7 hari
4. Tambahkan perekat agar menempel lebih baik
5. Saring pestisida terlebih dahulu sebelum dimasukkan ke dalam botol sprayer. Saringan sudah disediakan di kemasan pestisida.', 'AUTO_REPLY', true, false, NULL),
  ('POLYBAG 1KG', 'produk', 'Halo kak berikut estimasi isi polybag 1 kg ya

10x15 = 370
15x15 = 246
20x20 = 138
25x25 = 89
35x35 = 45
40x40 = 38
50x50 = 10
60x60 = 5

Untuk ukuran detalnya pastikan kakak cek di gambar produk 🙏😊', 'AUTO_REPLY', true, false, NULL),
  ('POLYBAG 500GR', 'produk', 'Halo kak berikut estimasi isi polybag 500 gr ya

10x15 = 185
15x15 = 123
20x20 = 69
25x25 = 45
35x35 = 23
40x40 = 19
50x50 = 5
60x60 = 2

Untuk ukuran detalnya pastikan kakak cek di gambar produk 🙏😊', 'AUTO_REPLY', true, false, NULL),
  ('POLYBAG 250 GR', 'produk', 'Halo kak berikut estimasi isi polybag 250 gr ya

10x15 = 93
15x15 = 62
20x20 = 35
25x25 = 22
35x35 = 11
40x40 = 10

Untuk ukuran detalnya pastikan kakak cek di gambar produk 🙏😊', 'AUTO_REPLY', true, false, NULL),
  ('VELCRO', 'produk', 'Hai ka untuk panjangnya velcro ini diakumulasikan ya kak, apa boleh dibantu ukur dulu kaa?🙏🙏🙏', 'AUTO_REPLY', true, false, NULL),
  ('PRODUK POC', 'produk', 'Halo kak!

Pupuk POC ini merupakan pupuk organik yang berwujud cairan
Produk ini populer banget karena ampuh banget buat melebatkan tanaman buah dan sayur di kebun', 'AUTO_REPLY', true, false, NULL),
  ('PRODUK MIRACLE', 'produk', 'Halo kak!

Produk Miracle Powder ini ampuh banget dipakai untuk membuat tanah yang keras jadi gembur kembali
Cocok buat kakak yang menanam menggunakan pot atau polybag yang tanahnya rawan mengeras 🥰', 'AUTO_REPLY', true, false, NULL),
  ('PRODUK AKAR', 'produk', 'Halo kak!

Produk nutrisi akar ini punya manfaat untuk melebatkan akar tanaman
Cocok banget buat tanaman yang baru aja di stek karena selain melebatkan akar juga bisa mengurangi stress tanaman ya 🥰🥰', 'AUTO_REPLY', true, false, NULL),
  ('PRODUK PELEBAT', 'produk', 'Halo kak!

Paket pelebat ini cocok banget buat kakak yang menanam tanaman berbuah baik tanaman buah semusim maupun tanaman tahunan
Dengan nutrisi yang lengkap menunjang tanamanmu agar lekas berbuah 😍', 'AUTO_REPLY', true, false, NULL),
  ('PRODUK PESTISIDA', 'produk', 'Halo kak!

Produk pestisida ini cocok banget buat mencegah atau menangani tanamannya lagi terserang hama ulat atau kutu
Bahannya yang organik dan ramah lingkungan gak bikin was was sama residunya 🥰🥰', 'AUTO_REPLY', true, false, NULL),
  ('PRODUK SEEDBOOSTER', 'produk', 'Halo kak!

Produk seed booster ini merupakan produk khusus yang bisa membantu proses semai kamu
Benih yang sulit tumbuh karena dorman jadi lebih cepat bertunas karena diberi seed booster 😍😍', 'AUTO_REPLY', true, false, NULL),
  ('PBL', 'produk', 'halo kak mohon maaf sebelumnya kami perlu menginfokan bahwa penutupan paket berbuah lebat dikarenakan adanya pengembangan komposisi produk dengan ekstra kalsium untuk mencegah buah rontok

tapi jangan khawatir karena paket berbuah lebat akan segera launching dan dapat kakak order kembali di tanggal 27 juli ya kak
sementara itu mohon berkenan menunggu proses pengembangan produk kami 😊🙏🙏', 'AUTO_REPLY', true, false, NULL),
  ('VOUCHER KOMPLAIN', 'umum', 'kalau admin bantu kompensasi voucher untuk kaka co ulang berkenan kah kak', 'AUTO_REPLY', true, false, NULL),
  ('CANCEL', 'umum', 'halo kak, mohon maaf sebelumnya kak karena resi sudah di rts dan sudah masuk packing tinggal pickup kurir🙏 jadi kami belum bisa acc ya kak🙏😊', 'AUTO_REPLY', true, false, NULL),
  ('KIRIM PUSAT', 'umum', 'halo kak kebetulan gudang sedang dalam perbaikan kaka, jadi dialihkan ke gudang pusat yang di surabaya ya kaka🙏😊', 'AUTO_REPLY', true, false, NULL),
  ('NATAL', 'umum', 'Halo kak mohon maaf untuk tnggl 25-26 kami sedang libur pengirman yah kak jadi akan kami proses kembali pengirman di tnggl 27 desember yah kka, terimakasih sudah berkenan menunggu 🙏🙏', 'AUTO_REPLY', true, false, 'Promo bertanggal. Periksa masa berlakunya sebelum diaktifkan; isi berkas .md tidak menyebutkan tahun.'),
  ('ORDER ULANG', 'umum', 'Silahkan diorder kembali ya kak, minfarm tunggu orderannya kalau mau ikut pengiriman hari ini maks di jam 12.00 nanti.', 'AUTO_REPLY', true, false, NULL),
  ('PESAN ULANG', 'umum', 'halo kka maaf karna kendala kami overload jadi belum bisa maksimal dalam proses paking , jadi kendala otomatis bazal nih kak 🙏😢 mungkin jika berkenan di bantu pemesanan ulang yah kka😢🙏', 'AUTO_REPLY', true, false, NULL),
  ('TANGGAL 7', 'umum', 'halo kak mohon maaf karna kendala overload paket kemaren kami sudah maksimalkan paking kak, tpi masih kendala karna overload paket jadi kami maksimalkan untuk kami proses di tanggal 7 yah kak, mohon ditunggu kak 🙏', 'AUTO_REPLY', true, false, NULL),
  ('TEAM AHLI', 'umum', 'baik kak ditunggu yah kak admin bantu tanyakan ke team ahli kami yah kka 🙏', 'AUTO_REPLY', true, false, NULL),
  ('CATATANBENIHPAKET', 'umum', 'catatan: untuk benih kami sedang menipis jika benih req tidak ada kami akan mengirimkan benih yg ready di gudang kami yah kka terimaksih 🙏', 'AUTO_REPLY', true, false, NULL),
  ('KOMPOSISI TANAH', 'umum', 'halo kakak benar kak media tanah tetap harus dengan campuran yg seimbang nih kak, lebih baik campurannya tanah ,pupuk kandang ,arang sekam, cocopeat ya kak 🙏', 'AUTO_REPLY', true, false, NULL),
  ('TANGGAL MERAH', 'umum', 'Hai kak pesanan sudah diterima, mohon maaf kami libur pengirman saat tanggal merah , kami proses kembali di hari berikutnya yah kak,  harap ditunggu kak terimakasih kak🙏🙏', 'AUTO_REPLY', true, false, NULL),
  ('PILIHAN BENIH', 'umum', 'pilihan benihnya yang tersedia di toko shopee kami kakak https://shopee.co.id/infarmofficialshop?shopCollection=130719148#product_list 
boleh cek yah kak', 'AUTO_REPLY', true, false, NULL),
  ('KLAIM BARANG', 'umum', 'mohon maaf kak untuk sop klaim barang kurang ini kami butuh vidio unboxing dan foto produk untuk kami klaim kan ke team kami kak  🙏', 'AUTO_REPLY', true, false, NULL),
  ('KLIK PESANAN SELESAI', 'umum', 'Halo kak, aman kak ekspedisi tetap melakukan pengiriman. nanti dibantu di cek secara berkala jika pengiriman stuck nanti bisa admin untuk dibantu komplain ke ekspedisi 🙏', 'AUTO_REPLY', true, false, NULL),
  ('BENIH PATEN', 'umum', 'halo kak untuk benihnya sudah paten nih kak kangkung pokcoy caisim dan bayam yah kakak 🙏', 'AUTO_REPLY', true, false, NULL),
  ('CHAT 321', 'umum', 'Halo kak mohon maaf untuk kendalanya yah kak, admin cek di penilaian kakak ada kendala yah kka, boleh di info kan kak kendalanya apa agar admin bantu beri solusi terbaiknya kak terimaksih kak🙏', 'AUTO_REPLY', true, false, NULL),
  ('CS WA', 'umum', '811-3075-1469', 'AUTO_REPLY', false, true, 'Memuat nomor rekening/telepon — dimatikan agar tidak terkirim otomatis (claude-core.md melarang mengarahkan transaksi ke luar marketplace).'),
  ('TANPA', 'umum', 'Halo kak, mohon maaf ada kesalahan stok QC dari kami, maka paket kakak kami kirim TANPA produk ...... nanti jika produk sampai, boleh diajukan pengembalian dana pada produk yang tidak ada yaa kak🙏', 'AUTO_REPLY', true, false, NULL),
  ('CARA TANAM', 'umum', 'Halo kak, berikut yaa untuk cara penanaman🙏', 'AUTO_REPLY', true, false, NULL),
  ('UKURAN POLYBAG', 'umum', 'Halo kak, berikut untuk ukuran polybag🙏', 'AUTO_REPLY', true, false, NULL),
  ('PAKAI GUANO', 'umum', 'Halo kak, berikut untuk cara pemakaian pupuk guano. Taburkan pupuk guano sebanyak 1 sdt ke media tanaman (untuk 1 tanaman) penggunaan secara rutin seminggu sekali🙏', 'AUTO_REPLY', true, false, NULL),
  ('MIRACLE POWDER', 'umum', 'Cara penggunaan miracle powder

1. Untuk aplikasi tabur, taburkan asam humat secara merata ke area media tanam. Aplikasikan setiap 1 minggu sekali
2. Untuk aplikasi kocor, larutkan asam humat sebanyak 2 gram/liter air. Aplikasikan setiap 1 minggu sekali
3. Untuk aplikasi semprot sebagai pupuk daun, larutkan asam humat sebanyak 1 gram/liter air. Aplikasikan setiap 1 minggu sekali.', 'AUTO_REPLY', true, false, NULL),
  ('BERAT', 'umum', 'Halo kak, 1 liter bukan berarti 1 kg kak , karena itu massanya air , mengukurnya kita pakai gelas takar kak dan tidak dipadatkan', 'AUTO_REPLY', true, false, NULL),
  ('PARANET', 'umum', 'Halo kak
Untuk paranet, harga diatas per 1x3 meter yaa. Lebar paten di 3 meter sedangkan panjang nya per 1 meter, bisa di adjust sesuai dengan QTY yang di co.
CONTOH: QTY 2 pcs, akan tiba dalam ukuran 2x3 meter, QTY 3 pcs akan tiba dalam ukuran 3x3 meter.
Pesan lebih dari 1 QTY, dikirim tidak potongan 🙏', 'AUTO_REPLY', true, false, NULL),
  ('ONGKIR', 'umum', 'Halo kak
Untuk ongkir kami mengikuti dari sistem yaa kak, Terutama untuk produk yang memang terkena berat dan volume 🙏 Bergantung juga ke domisili kakak, dari admin bisa sarankan
1. coba tambahkan kuantiti barangnya
2. jangan lupa klaim voucher dari aps dulu
3. bisa pantau/checkout saat kami live
Terima kasih🤗🙏', 'AUTO_REPLY', true, false, NULL),
  ('SPRAYER KIMIA KERAS', 'umum', 'Halo kak, tidak disarankan yaa kak. karena bahan sprayer kami, tidak berfungsi untuk menyimpan larutan keras🙏', 'AUTO_REPLY', true, false, NULL),
  ('PAKAI B1', 'umum', 'CARA PAKAI :

1. Larutkan 1 tutup botol dengan 2 Liter air
2. Semprot / Siram larutan B1 pada tanaman dan media tanam
3. Baik digunakan untuk tanaman saat pindah tanam, repotting, dan tanaman yang baru dari pengiriman
4. Gunakan 1 minggu sekali untuk tanaman yang Stress / Berpotensi Stress
5. Penggunaan rutin cukup 2 minggu sekali (opsional)', 'AUTO_REPLY', true, false, NULL),
  ('CANGKOK', 'umum', '𝗖𝗮𝗿𝗮 𝗽𝗮𝗸𝗮𝗶

Untuk Stek / cangkok :
- Oleskan cairan groot pada batang yang akan ditumbuhkan akarnya
- Boleh dilakukan dengan cara dicelupkan dan tunggu hingga 5 menit (stek)
- Tancapkan batang yang telah dioles/dicelup dengan Infarm groot pada tanah atau media tanam yg lain.

Untuk Nutrisi Akar :
- Campurkan 0,5ml Nutrisi Akar untuk 1 Liter air
- Siramkan pada media tanam rutin 1 minggu sekali', 'AUTO_REPLY', true, false, NULL),
  ('BEDA NEEM DAN PESNAB', 'umum', 'Halo kakak🤗🙏
Neem oil dan pestisida nabati kami yang ungu itu sama sama produk pestisida yaa kak. Kegunaan dan manfaat nya sama untuk mengusir hama pada tanaman. Perbedaan nya hanya dari kandungan nya kak, yang neem oil dari ekstrak daun mimba sedangkan yang ungu dari ekstrak bawang putih🙏', 'AUTO_REPLY', true, false, NULL),
  ('PAKAI USIA', 'umum', 'halo kakak, dipakai nya saat tanaman tumbuh minimal 4 daun yaa kak 🤗🙏', 'AUTO_REPLY', true, false, NULL),
  ('REPELLENT', 'umum', 'halo kakak, repellent ini aman yaa kak kalau kena kulit atau terhirup. Namun mimin konfirmasi kan bahwa produk ini tidak food grade yaa🙏', 'AUTO_REPLY', true, false, NULL),
  ('PAKAI ROUNDOUP', 'umum', '1. Campur 10–20 ml Roundup per 1 liter air (cek label kemasan untuk dosis pasti).
2. Aduk rata, jangan tambahkan sabun atau pupuk.
3. Semprotkan langsung ke daun gulma saat cuaca cerah, tidak hujan.
4. Gunakan saat gulma aktif tumbuh, jangan semprot ke tanaman utama.

⚠️ Gunakan sarung tangan & masker, dan hindari kontak langsung dengan kulit atau mata.', 'AUTO_REPLY', true, false, NULL),
  ('TOKO INSTAN', 'umum', 'Halo kakak, maaf di toko ini belum bisa instan yaa kak, hanya bisa reguler saja.
Karena kebetulan gudang sedang dalam perbaikan kaka, jadi dialihkan ke gudang pusat yang di surabaya ya kaka🙏😊', 'AUTO_REPLY', true, false, NULL),
  ('CS KOMPLAIN', 'umum', 'kosong812,,1644,,,4934', 'AUTO_REPLY', false, true, 'Memuat nomor rekening/telepon — dimatikan agar tidak terkirim otomatis (claude-core.md melarang mengarahkan transaksi ke luar marketplace).'),
  ('LINK BENIH', 'umum', 'https://pupukorganik-infarm-my.berdu.pw/', 'AUTO_REPLY', true, false, NULL),
  ('ATRAKTAN PETROGENOL', 'umum', '𝗖𝗮𝗿𝗮 𝗣𝗲𝗻𝗴𝗴𝘂𝗻𝗮𝗮𝗻

1. menggunakan bekas wadah air minum yang berbentuk tabung botol yang lehernya berbentuk kerucut
2. Atraktan petrogenol 800L dipaparkan pada medium kapas
3. mampatkan kapas dengan dipilin sampai sebesar ibu jari kemudian di ikat dengan kawat kecil
4. teteskan petrogenol sebanyak 0,125-0,25 ml pada kapas sampai basah namun tidak menetes ke bawah
5. pasang pilinan kapas yang sudah diberi petrogenol 800 L didalam tabung perangkap sehingga mengantung pada bagian tengah tabung perangkap
6. gantungkan perangkap pada dahan atau ranting setinggi2-3 meter dari tanah', 'AUTO_REPLY', true, false, NULL),
  ('HITUNG PPM TDS', 'umum', 'Ngitungnya gini :

Ppm di tds - ppm air baku = ppm nutrisi

Contoh :
1000 ppm (tds) - 250 ppm (air baku) = 750 ppm (ab mix).', 'AUTO_REPLY', true, false, NULL),
  ('BEDA AB MIX POC', 'umum', 'halo kakak, kalau ab mix itu non organik yang bisa digunakan media tanah dan hidroponik. sedangkan poc sendiri itu organik yang hanya bisa digunakan di media tanah kak🤗🙏', 'AUTO_REPLY', true, false, NULL),
  ('NUTRIPOD', 'umum', 'Cara Penggunaan Nutripod

1. Larutkan 1 sachet (25 gram) ke dalam 10 liter air.
2. Aduk rata dan biarkan selama beberapa menit.
3. Kocorkan ke media tanam 250-500mL per tanaman.
4. Ulangi pemakaian setiap 2 minggu.', 'AUTO_REPLY', true, false, NULL),
  ('CAMPAIGN3', 'umum', 'PANEN 5 LANGKAH #4 AKAN DIMULAI!

Siap-siap panen lebat bareng Infarm 🍅🥬🍋
💥 Flash Sale hanya 1 hari!

📆 Payday 25 Agustus 2025
Kamu bisa dapetin DISKON dan FREE GUNTING DAHAN khusus untuk:
✅ Paket Berbuah Lebat
✅ Paket Booster Magic

Pas buat kamu yang lagi rawat tanaman buah dan sayur
⚠️Stok terbatas & hanya berlaku 1 hari dan tidak berlaku kelipatan 

Yuk bisa pantau etalase kami dan dapatkan hadiah nya~~', 'AUTO_REPLY', true, false, NULL),
  ('1PROMO NUTRIPOD', 'umum', '[🎉PRODUK BARU INFARM!🎉]  
Pupuk praktis buat yang sibuk? Cukup 2 minggu sekali? ADA!

🌱 Nutripod Infarm – solusi buat kamu yang gak punya banyak waktu tapi tetap mau tanamannya subur 🍀

✅ 20x bakteri baik  
✅ Unsur hara makro & mikro  
✅ Langsung tabur, gak ribet!

Buruan checkout sekarang ya, stok promo terbatas! 
Minfarm tambah voucher khusus untuk kakak', 'AUTO_REPLY', true, false, NULL),
  ('BEDA BLOCK PRESS', 'umum', 'halo kakak, untuk keduanya ini berat nya sama kak hanya beda di bentuk nya saja yaa kak🤗🙏 kalau yang block di padatkan serupa batu bata, sedangkan yang press di tekan sampai pipih yaa kak', 'AUTO_REPLY', true, false, NULL),
  ('TRAY PS', 'umum', 'Halo kaka, Bahan Plastik PS (Polystyrene)
lebih mahal dan kuat dari PET', 'AUTO_REPLY', true, false, NULL),
  ('TANAM STRAWBERRY', 'umum', 'Halo kak, berikut untuk cara tanam strawberry yaa kak 🙏', 'AUTO_REPLY', true, false, NULL),
  ('NOTA', 'umum', 'halo kakak mohon maaf kami tidak ada nota kosong/toko kak adanya invoice digital yang bisa kami kirimkan ke ema,il kakak', 'AUTO_REPLY', true, false, NULL),
  ('SOIL METER', 'umum', 'Cara Penggunaan Soil meter

1. Tancapkan ujung sensor ke dalam tanah dekat wilayah akar tanaman.
2. Geser tombol swith ke moist untuk mengukur tingkat kelembaban, Light kadar cahaya dan pH.', 'AUTO_REPLY', true, false, NULL),
  ('WA KOL', 'umum', 'halo kakak, untuk terkait kol dan affiliate bisa ditanyakan ke  812,,1659,,,6159 🙏', 'AUTO_REPLY', true, false, NULL),
  ('PROMOMINGGUAN', 'umum', '🌟 Promo Spesial Terbatas! 🌟
Khusus kamu yang suka tanam-tanam dan rawat tanaman di rumah, ada banyak hadiah menarik dan voucher khusus chat yang bisa kamu klaim hari ini juga! 😍

📌 Promo-promo menarik yang bisa kamu dapat:
✅ Beli 6 benih, GRATIS rockwool isi 24 lubang buat semai benihnya langsung!
✅ Beli 2 pcs Repellent, dapat FREE gift Maowang yang super berguna!
✅ Beli pupuk lebih banyak, kamu akan otomatis dapat diskon lebih besar! 

Minfarm tambahkan juga voucher diskon eksklusif untuk kamu 🤗', 'AUTO_REPLY', true, false, NULL),
  ('NO PURCHASING KAK RENI', 'umum', '811...3075,,,,1640', 'AUTO_REPLY', true, false, NULL),
  ('ORGANIK', 'umum', 'halo kakak, bisa pakai poc sayur di masa pertumbuhan dan poc buah di masa pembuahan yaa kak 🙏🤗', 'AUTO_REPLY', true, false, NULL),
  ('MAAF KENDALA EKSPEDISI', 'umum', 'Kami mohon maaf atas kendala yang diluar kuasa kami ini, dari admin pastinya akan membantu pengembalian setelah paket retur sampai di tempat serta akan memberikan kompensasi berupa voucher 🙏
Solusi untuk pesanan kakak Mungkin bisa co ulang, namun pilih pengiriman ekonomi/hemat yaa kak, bukan standart. karena pengiriman tersebut menggunakan jasa kirim via laut', 'AUTO_REPLY', true, false, NULL),
  ('BENIH', 'umum', 'Halo kakak, mengingat kebijakan admin di marketplace saat ini jadi untuk benih ada minimal order 2 pcs/etalase benih yaa kak🙏', 'AUTO_REPLY', true, false, NULL),
  ('COCO SEMENTARA', 'umum', 'halo kakak, mohon maaf izin konfirmasi ini ada kendala tidak lolos QC dari kami untuk produk cocopeat kak. 
Demi menjaga kualitas, kami mohon pengertiannya untuk dilakukan pembatealan terlebih dahulu ya. Besok kakak bisa order kembali jika produk  baru telah datang 😊🌱', 'AUTO_REPLY', true, false, NULL),
  ('AKAR AUKSIN', 'umum', 'halo kak, mohon maaf memang ada perubahan standar warna kak  dari kami khususnya pada hormon auksin nya. namun tidak perlu khawatir karena kualitas kami tidak berubah yaa kak🤗🙏', 'AUTO_REPLY', true, false, NULL),
  ('KANDUNGAN PENGKILAP', 'umum', 'kandungan utamanya minyak sebagai pmberi efek kilap dan bersih pada daun yang dipadukan dengan Aroma Essence yang memberi sensasi wangi saat disemprotkan', 'AUTO_REPLY', true, false, NULL),
  ('FREE GIFT', 'umum', 'halo kakak, maaf sebelumnya jika mendapatkan free gift barang akan masuk ke dalam resi yaa kak. ini di resi kakak tidak ada tambahan produk tersebut, jadi mohon maaf artinya tidak dapat yaa kak🙏 mengingat pula persediaan yang terbatas 🙏', 'AUTO_REPLY', true, false, NULL),
  ('UKURAN SARUNG TANGAN', 'umum', 'Halo kakak, untuk sarung tangan ukuran nya All size large dewasa tidak ada ukuran lain yaa🙏 untuk panjang produk nya di 32cm', 'AUTO_REPLY', true, false, NULL),
  ('IKUT', 'umum', 'Ikut pengiriman hari ini yaa kak, harap ditunggu 🙏', 'AUTO_REPLY', true, false, NULL),
  ('PESTNAB SEMENTARA', 'umum', 'Hai kak 🌱, terima kasih sudah order di Infarm 🙏 Minfarm seneng banget karena produk kami dipercaya sahabat kebun.

Mohon maaf sebelumnya ya kak, untuk Pestisida Nabati Spray saat ini tidak lolos QC. Karena kami selalu jaga kualitas, bolehkah kami kirimkan penggantinya dengan Pestisida Nabati Pekat?
Terima kasih banyak kak, sehat selalu 🌿✨

Jika setuju balas YES, jika tidak balas NO.', 'AUTO_REPLY', true, false, NULL),
  ('DOLOMIT', 'umum', 'Halo kak berikut untuk pemakaian dolomit yaa kak

Dosis:
- Tanah kebun: 100-200 gr/m².
- Pot: 1-2 sdm per pot.
Taburkan dolomit: Sebarkan merata di permukaan tanah, lalu campurkan.
Setelah pemberian, siram tanah dengan air bersih. Sebar pupuk dolomit secara merata pada lahan tanam tujuh hingga sepuluh 10 hari sebelum pupuk kandang atau pupuk kimia lainnya diberikan.', 'AUTO_REPLY', true, false, NULL),
  ('1010', 'umum', '🎃 SHOCKTOBER DEALS INFARM! 🌿
Rayakan 10.10 Halloween Deals bareng Infarm ✨

Hanya Hari ini, 10 Oktober!
Nikmati promo heboh:
🔥 Diskon hingga 60%
🔥 Free Benih Cabe Rawit Min Cha*
(setiap pembelian Paket Booster Magic, tidak berlaku kelipatan)

🌱 DAPATKAN BONUS & DISKON GANDA!
Beli Paket Booster Magic berisi:
✅ POC Buah — bantu tanaman berbuah lebat 🍅
✅ POC Sayur — bikin daun hijau segar 🌿
✅ Miracle Powder — booster nutrisi biar tanaman makin kuat 💪

➡️ Lengkap banget buat tanaman sayur & buah di rumah! yuk jangan sampai ketinggalan yaa', 'AUTO_REPLY', true, false, 'Promo bertanggal. Periksa masa berlakunya sebelum diaktifkan; isi berkas .md tidak menyebutkan tahun.'),
  ('SINGLE', 'umum', 'halo kakak, mohon maaf izin konfirmasi bahwa ada kesalahan stok QC dari kami maka untuk produk ....... tidak dapat kami kirimkan🙏 apakah bisa dibantu ajukan pembatealan dari kakak? atau kami batealkan dengan alasan stok kosong yaa kak🙏', 'AUTO_REPLY', true, false, NULL),
  ('COCOPEAT', 'umum', 'Cara Pakai Cocopeat

1. Rendam cocopeat block selama kurang lebih 10 menit atau sampai cocopeat mengembang/luruh
2. Selama proses perendaman, tambahkan air jika dirasa kurang air, dan kurangi air jika air terlalu banyak', 'AUTO_REPLY', true, false, NULL),
  ('ISI PAKET 25', 'umum', '1. Benih Sayuran: Kangkung, Bayam, Cabai keriting, Sawi Pagoda, Selada, Koro, Samhong, Terong, Lobak Putih, Kemangi, Pokcoy, Pokcoy batang putih, Cabai rawit merah, Kailan, Caisim, Buncis, Pare belut 
2. Benih Buah: Semangka Jumbo, Paprika, Timun, Labu air, Labu Kuning, Labu Madu, Tomat Mawar 
3. Benih Bunga: Matahari', 'AUTO_REPLY', true, false, NULL),
  ('AWAL PEMULA', 'umum', 'halo kakak, di awal butuh media semai, media tanam (disarankan campuran tanah dan sekam) lalu bisa pakai pupuk poc sesuai dengan tanaman nya yaa kak', 'AUTO_REPLY', true, false, NULL),
  ('POLINASI MANUAL TOMAT', 'umum', 'halo kakak untuk tomat ini sering terkendala seperti itu. pertama perlu tau dulu kak apakah sinar matahari sudah full kak?
lalu kalau sudah, setelah nanti berbunga lagi bisa dilakukan polinasi manual atau dengan sentil sentil batang nya untuk membantu penyerbukan 🤗🙏', 'AUTO_REPLY', true, false, NULL),
  ('ALIHKAN', 'umum', 'halo kakak, mohon maaf izin konfirmasi bahwa ini ada kesalahan stok QC dari kami untuk produk ....., maka kami konfirmasi untuk alihkan ke produk ..... yaa kak. semoga masih berkenan menerima 🙏', 'AUTO_REPLY', true, false, NULL),
  ('PBM', 'umum', '𝐂𝐀𝐑𝐀 𝐏𝐄𝐍𝐆𝐆𝐔𝐍𝐀𝐀𝐍 :
- Encerkan POC Sayur 2 mL/L air ( 2 Pump ) Pada saaf fase Vegetatif
- Encerkan POC Buah 2 mL/L air ( 2 Pump ) Pada saaf fase Generatif
- siram merata ke area perakaran 200-500ml (tergantung besarnya tanaman)
- interval penyiraman 1 kali dalam seminggu

 Cara penggunaan Miracle powder:
1. Untuk aplikasi tabur, taburkan asam humat secara merata ke area media tanam. Aplikasikan setiap 1 minggu sekali
2. Untuk aplikasi kocor, larutkan asam humat sebanyak 2 gram/liter air. Aplikasikan setiap 1 minggu sekali
3. Untuk aplikasi semprot sebagai pupuk daun, larutkan asam', 'AUTO_REPLY', true, false, NULL),
  ('TUTUP SUSAH BUKA', 'umum', 'hai kaka, mohon maaf atas kendala nya yaa kak. buka nya diputar saja seperti biasa kak, namun jika susah kakak bisa pakai bantuan karet gelang yang diikat kuat kemudian di coba putar kembali', 'AUTO_REPLY', true, false, NULL),
  ('MAGNESIUM', 'umum', 'Cara pakai Magnesium Sulfate (MgSO₄):

Kocor: 5–10 gram per 1 liter air, siram ke pangkal tanaman tiap 2–3 minggu.
Semprot daun: 5 gram per 1 liter air, semprot pagi/sore hari.
Jangan dicampur pupuk asam kuat, simpan di tempat kering.', 'AUTO_REPLY', true, false, NULL),
  ('BAIK', 'umum', 'Baik kakak, sama sama🤗🙏', 'AUTO_REPLY', true, false, NULL),
  ('EKSPEDISI 2', 'umum', 'Hai ka untuk kendala ekspedisi ini sudah diluar kuasa seller ka, namun mimin bantu untuk push dan follow up ke ekspedisi terkait yaa kak. Sepertinya ini di ekspedisi sedang ada kendala massal. Ditunggu yaa kak🙏', 'AUTO_REPLY', true, false, NULL),
  ('BEDA BOOSTER BIO DAN FRUIT EXPERT', 'umum', 'halo kakak, kandungan kedua nya berbeda yaa kak. lalu booster bio ini lebih ke perangsang keseluruhan bagian tanaman, sedangkan fruit expert hanya untuk booster pembuahan🤗', 'AUTO_REPLY', true, false, NULL),
  ('ABMIX MELON', 'umum', '🔥 PAYDAY SALE 🔥
AB MIX MELON launching cuma Rp18.900 dari Rp25.000!
Bikin melon lebih besar, seragam, dan manis legit 🍈
Stok terbatas hanya untuk 100 orang tercepat.
Berlaku khusus 25 November 2025.

Siapkan alarm, jangan sampai kehabisan!
Checkout besok di Shopee Official Infarm! 💚🌱', 'AUTO_REPLY', true, false, NULL),
  ('12.12', 'umum', '12.12 SUPER BLAST DEAL

 Beli Paket Pelebat Buah → FREE Miracle Powder 100gr
 Beli Paket 25 Benih → FREE Rockwool
 Pestisida Nabati cuma 12.000 untuk 100 orang pertama!
 HOT DEAL! Paket Vitamin Akar CUMA 1.000 jam 00.00 — stok super terbatas', 'AUTO_REPLY', true, false, 'Promo bertanggal. Periksa masa berlakunya sebelum diaktifkan; isi berkas .md tidak menyebutkan tahun.'),
  ('VITAMIN AKAR', 'umum', 'Hai kak, Cara Pakainya selang seling jeda 1 minggu tidak bisa dicampur yaa

-  Vitamin B1: Larutkan 1 tutup botol ke 2 liter air, lalu semprot/siram ke tanaman & media tanam 1-2 minggu sekali
-  Nutrisi Akar: Campurkan 0,5 ml per 1 liter air, siramkan ke media tanam 1 minggu sekali
-  Untuk stek batang: Celupkan batang ke larutan nutrisi akar selama 5 menit, lalu tanam di media', 'AUTO_REPLY', true, false, NULL),
  ('EXPRESS ECO', 'umum', 'hi kak, ini mimin cek kakak menggunakan jasa Kirim Express Eco yang mana layanan virtual sementara yang disediakan oleh Shopee untuk menampung pesanan Hemat Kargo antar pulau selama pembatasan angkutan di pelabuhan diberlakukan oleh pemerintah selama Idulfitri 2026

Jadi jasa kirim tersebut hanya bersifat sementara & nanti akan berubah ke jasa kirim hemat cargo normal ketika jasa kirim lainnya sudah beroperasi dengan normal kak.

untuk saat ini harap ditunggu yaa, karena belum bisa di proses pesanan kakak🙏', 'AUTO_REPLY', true, false, NULL),
  ('BEDA GUANO DAN POP', 'umum', 'hai kakak guano ini dari kotoran kelelawar yang lebih tinggi phospat penyerapan lebih cepat, sedangkan POP ini lebih seimbang kandungan N, P, K nya dan penyerapan pop lebih lambat. Kalau kakak mau cari untuk bunga mimin sarankan guano, kalau mau yang cocok saat musim hujan mimin sarankan POP', 'AUTO_REPLY', true, false, NULL),
  ('PENINJAUAN', 'umum', 'hai kakak, jika ada produk media tanam siap pakai, netpot, arang sekam, weed clear dan arang kayu boleh coba dikecualikan dulu yaa kak. sedang dalam peninjauan shopee soalnya', 'AUTO_REPLY', true, false, NULL),
  ('COD', 'umum', 'Berikut kak jika tidak bisa cod

- Alamat belum dijangkau layanan COD ekspedisi.
- Nilai pesanan melebihi batas COD.
- Akun pembeli pernah bermasalah saat COD sebelumnya.
- Produk atau ekspedisi yang dipilih tidak mendukung COD di wilayah/daerah Kakak.', 'AUTO_REPLY', true, false, NULL),
  ('PAKET5BENIH', 'umum', 'Isi Paket 5 Benih Panen 30 Hari

Benih yang cepat tumbuh, gampang dirawat, dan hasilnya melimpah:

1. Bayam Hijau – cepat tumbuh, renyah, cocok untuk tumisan & sayur bening
2. Kangkung – favorit semua orang!
3. Sawi Hijau dan Pokcoy – ideal untuk pot kecil
4. Selada – panen bertahap, awet dan produktif', 'AUTO_REPLY', true, false, NULL),
  ('SAMPLE', 'umum', 'haloo kakak, bisa silahkan diajukan untuk sample yang tersedia yaa, nantinya pengajuan akan ditinjau langsung oleh sistem kami😊🙏', 'AUTO_REPLY', true, false, NULL),
  ('KIRIM DARI', 'umum', 'Hai kakak saat ini kami multiwarehouse, akan dikirim dari surabaya, jakarta dan semarang ya. Paket kakak akan dikirim dari gudang terdekat dari domisili kakak🙏🙏', 'AUTO_REPLY', true, false, NULL),
  ('CARA PAKAI NPK', 'umum', 'Cara Pakai NPK hitam

1. Kocor / Semprot: Larutkan 1 sdm per 1 liter air, aplikasikan ke akar atau daun
2. Tabur: 1 sdt per tanaman, tabur di area perakaran
3. Interval: 2–3 minggu sekali', 'AUTO_REPLY', true, false, NULL),
  ('BAHAN PLANTER BAG', 'umum', 'hai kakak bahannya dari Geotextile Non-Woven (Polypropylene / Polyester)', 'AUTO_REPLY', true, false, NULL),
  ('CARA PAKAI TDS METER', 'umum', 'Nyalakan alat, pastikan di mode PPM.
Celupkan ujung sensor ke larutan sekitar 2–3 cm.
Tunggu angka stabil lalu baca hasilnya.
Setelah selesai, bilas sensor dengan air bersih dan keringkan.

Tips: Jangan ukur dengan air panas, bersihkan sensor jika angka tidak stabil, dan simpan alat dalam keadaan kering.', 'AUTO_REPLY', true, false, NULL),
  ('CARA PAKAI PH METER', 'umum', 'Nyalakan alat.
Celupkan elektroda ke larutan hingga batas sensornya.
Aduk perlahan dan tunggu angka stabil.
Baca hasil pH pada layar.
Bilas elektroda dengan air bersih setelah dipakai dan keringkan.

Tips: Jangan mengukur di air panas, simpan elektroda selalu dalam keadaan lembap (gunakan cairan penyimpanan jika ada), dan kalibrasi pH meter secara rutin.', 'AUTO_REPLY', true, false, NULL),
  ('CARA KALIBRASI ULANG TDS METER', 'umum', '1. Siapkan larutan kalibrasi TDS (biasanya 342 ppm atau 1000 ppm).
2. Nyalakan TDS meter.
3. Celupkan sensor ke larutan kalibrasi.
4. Tunggu beberapa detik sampai angka stabil.
5. Putar sekrup kecil “CAL” di bagian belakang menggunakan obeng kecil.
6. Sesuaikan angka hingga sama dengan nilai larutan kalibrasi (misalnya 342 ppm).
7. Angkat alat lalu bilas dengan air bersih.
TDS meter siap digunakan kembali.', 'AUTO_REPLY', true, false, NULL),
  ('CARA KALIBRASI ULANG PH METER', 'umum', '1. Siapkan larutan buffer pH (biasanya pH 4.01, 6.86/7.00, dan 9.18 atau 10.01).
2. Nyalakan pH meter lalu bilas ujung sensor dengan air bersih atau aquades.
3. Keringkan dengan tisu secara perlahan (jangan digosok keras).
4. Celupkan sensor ke larutan buffer pH 6.86 atau 7.00 sebagai kalibrasi awal.
5. Tekan tombol CAL atau HOLD (tergantung tipe alat) sampai angka stabil.
6. Tunggu sampai angka menunjukkan nilai buffer (misalnya 6.86 atau 7.00).
7. Bilas sensor lagi dengan air bersih.
8. Ulangi dengan buffer pH 4.01 (dan pH 9.18/10.01 jika ingin kalibrasi 3 titik).', 'AUTO_REPLY', true, false, NULL),
  ('CARA PAKAI EM4', 'umum', 'Cara pakai EM4 untuk pengomposan:
1. Siapkan bahan organik (daun, rumput, sisa sayur).
2. Cacah bahan agar cepat terurai.
3. Buat larutan: 10 ml EM4 + 10 g gula merah/molase + 1 liter air.
4. Siram larutan ke bahan kompos sampai lembap (tidak becek).
5. Masukkan ke komposter atau tumpukan kompos lalu tutup.
6. Aduk kompos setiap 3–7 hari.
7. Kompos biasanya matang dalam ±2–4 minggu.', 'AUTO_REPLY', true, false, NULL),
  ('CARA PAKAI ASAM AMINO', 'umum', 'Cara Pakai
1. Larutkan 5 ml Asam Amino per 1 liter air
2. Kocorkan ke media tanam secara merata
3. Gunakan setiap 3–7 hari sekali', 'AUTO_REPLY', true, false, NULL),
  ('TIPS SEMAI ANTI KUTILANG', 'umum', '1.semai benih di rockwool yang basah/lembab (bukan becek dan bukan kering) . letakkan di wadah nampan
2.jika ditaruh di ruangan gelap, ketika sudah terlihat pecah benih mulai tumbuh mau kecambah, langsung taruh luar kenakan sinar matahari untuk berfotosintesis, supaya tidak kutilang (pastikan matahari kena sampai ke tanah/rockwool)
3.jaga kelembaban dan pastikan dapat sinar matahri yang cukup setiap hari
4.jangan pindah tanam dulu sebelum tanaman benar2 siap pindah tanam', 'AUTO_REPLY', true, false, NULL),
  ('IDUL FITRI', 'umum', 'Halo kak 😊 Kami informasikan bahwa selama periode Lebaran, aktivitas terakhir seluruh warehouse dan cabang adalah pada tanggal 18 Maret 2026 pukul 17.00. Untuk operasional kembali, warehouse Surabaya akan mulai beroperasi pada 23 Maret 2026, sedangkan gudang cabang lainnya akan kembali beroperasi pada 26 Maret 2026. Selama periode tersebut, pesanan tetap bisa dilakukan, namun proses pengiriman akan menyesuaikan dengan jadwal operasional yang berlaku. Mohon pengertiannya ya kak, terima kasih🌱', 'AUTO_REPLY', true, false, 'Promo bertanggal. Periksa masa berlakunya sebelum diaktifkan; isi berkas .md tidak menyebutkan tahun.'),
  ('BERTAHAP', 'umum', 'Halo kakak, pesanan sedang dalam proses harap ditunggu yaa akan dikirimkan secara bertahap', 'AUTO_REPLY', true, false, NULL),
  ('PAKAI AGK LENGKAP', 'umum', 'Cara Pakai Singkat:

1. Semprot miracle mist spray ke daun & batang 1x/minggu (hindari bunga).
2. Tetes power serum 6-BAP 1x/minggu pada tunas atau spike muda.
3. Larutkan Vitamin B1 (1 tutup botol / 2 liter air), kocorkan ke akar.
    * Untuk pencegahan streas → tiap 2 minggu sekali
    * Untuk penanganan streas → 1x seminggu atau setelah repotting.
4. Semprot fungi,,sida ke daun & batang 1x/minggu (beda hari dengan pupuk).', 'AUTO_REPLY', true, false, NULL),
  ('HARGANAIK', 'umum', 'hai kakak untuk kenaikan produk mengikuti di sistem yaa kak, memang naik karena adanya issue global yaa 😊🙏', 'AUTO_REPLY', true, false, NULL),
  ('BENIH50', 'umum', 'Isi benih 50;
Kohlrabi, Selada Head, Kale Dwarf, Kenikir, Kubis Ungu, Okra Hijau, Selada Air, Selada Romaine, Selada Merah, Seledri Utah, Jagung Ungu, Oyong, Terong Dadali, Timun Baby, Timun Rampai, Terong Ungu, Pare Hibrida, Kecipir, Paprika Hijau, Paprika Merah, Tomat Pucung, Cabai Rawit, Asparagus, Bayam, Bayam Jepang, Beetroot, Brokoli, Caisim, Daun Bawang, Kailan, Kangkung, Kemangi, Ketumbar, Kol, Kubis, Lobak Putih, Pokcoy, Samhong, Sawi Mustard, Sawi Pagoda, Sawi Putih, Selada, Seledri, Siomak, Bunga Telang, Wortel, Bombay, Cabai Merah, Bawang Merah, dan Brussel Sprout.', 'AUTO_REPLY', true, false, NULL),
  ('PAKET25SAYUR', 'umum', 'Hai kakak berikut untuk paket 25 benih sayur', 'AUTO_REPLY', true, false, NULL),
  ('BEDA SIMPLE PACK DAN PRO PACK', 'umum', 'halo kakak, untuk pro pack sudah dapat tds meter yaa', 'AUTO_REPLY', true, false, NULL),
  ('PROMO HARI INI', 'umum', '🌱Promo Paket Nutrisi Organik Infarm lagi jalan khusus 25.5🌱

Cuma Rp75.000, sudah dapat:
✅ POC Buah 500ml
✅ POC Sayur 500ml
✅ FREE 5 Benih Terong

Harga normal Rp110.000, jadi ini lumayan banget buat Kakak yang mau rawat tanaman lebih praktis dari rumah.

Promo hanya untuk 20 orang tercepat ya 🌱
Pembelian berlaku lewat official shop Infarm

Checkout sekarang sebelum kehabisan', 'AUTO_REPLY', true, false, NULL),
  ('6.6', 'umum', '📣 Infarm 6.6 HOT SALE!

Cabe udah mulai rawan keriting?
Jangan tunggu sampai gagal panen! 🌶️

Di tanggal 6.6 nanti, Minfarm punya promo spesial:

Paket Perawatan Cabe
Isi paket:
✅ Fruit Expert
✅ Pupuk Organik Cair Cabai
✅ Perisai Cabe

Harga normal Rp81.000
Sekarang cuma Rp66.000 aja! 🔥

Yuk rawat cabe dari sekarang, biar tanamannya lebih sehat dan siap panen.', 'AUTO_REPLY', true, false, 'Promo bertanggal. Periksa masa berlakunya sebelum diaktifkan; isi berkas .md tidak menyebutkan tahun.'),
  ('PERAWATAN CABAI', 'umum', 'Hai ka ini dipakainya selang seling jeda seminggu ya ka, jadi minggu pertama pakai fruit expert dan minggu kedua pakai poc ya ka😍😊

untuk takarannya :
Fruit expert 4gr (1 tutup botol) dilarutkan ke 1L air
POC buah 2 pump diencerkan ke 1L air

untuk perisai cabai nya bisa di semprotkan seminggu sekali boleh berbarengan dengan poc maupun fruit expert yaa', 'AUTO_REPLY', true, false, NULL)
on conflict (code) do update set
  category_slug = excluded.category_slug,
  body          = excluded.body,
  is_active     = excluded.is_active,
  is_sensitive  = excluded.is_sensitive,
  note          = excluded.note;

-- ---------- template_rules ----------
-- priority = urutan penilaian di router.js. URUTAN ADALAH LOGIKA:
-- "cara pakai miracle powder" jatuh ke [MIRACLE POWDER] dan bukan
-- [PRODUK MIRACLE] semata karena nomornya lebih kecil.
--
-- Dikosongkan dulu supaya penomoran ulang tidak bertabrakan dengan
-- baris lama. Aman: barisnya memang selalu dibangkitkan dari
-- router.js, bukan diedit langsung di database.
delete from public.template_rules;

insert into public.template_rules
  (template_id, priority, when_patterns, also_pattern, unless_patterns, why)
select t.id, v.priority, v.when_patterns, v.also_pattern, v.unless_patterns, v.why
from (values
  ('BANTU', 1, ARRAY['^\s*(halo|hallo|hai|hay|hi|hello|pagi|siang|sore|malam|permisi|assalamualaikum|assalamu''alaikum)(\s+(kak|ka|kk|min|minfarm|admin|bang|sis))?[\s\p{P}\p{S}]*$', '^\s*(min|kak|kk|admin|minfarm)[\s\p{P}\p{S}]*$']::text[], NULL, '{}'::text[], 'Sapaan tanpa pertanyaan. Balasan pembuka CS memang kalimat tetap.'),
  ('TQ', 2, ARRAY['^\s*(makasih|makasi|mksh|terima ?kasih|thanks|thank you|tq|oke|okey|ok|sip|siap|baik|noted)(\s+(kak|ka|kk|min|minfarm|admin))?[\s\p{P}\p{S}]*$']::text[], NULL, '{}'::text[], 'Ucapan terima kasih. Tidak ada informasi yang perlu dicari.'),
  ('LACAK', 3, ARRAY['\b(lacak|tracking)\b', '\b(posisi|status)\s+(paket|pesanan|barang)\b', '\bpaket\w*\s+(saya|aku|ku)?\s*(sudah )?(sampai )?mana\b', '\bsampai mana\b']::text[], NULL, ARRAY['\b(belum sampai|tidak sampai|hilang|lama|telat|terlambat|refund|komplain)\b']::text[], 'Permintaan cara melacak paket. Balasannya arahan baku ke menu lacak.'),
  ('HARGA', 4, ARRAY['\bharga(nya)?\b', '\bberapa(an)? (harganya|duit|rupiah)\b']::text[], NULL, ARRAY['\b(dosis|takaran|ongkir|ongkos kirim)\b']::text[], 'Pertanyaan harga. Template mengarahkan ke halaman produk tanpa menyebut angka — sesuai larangan sop.md.'),
  ('GARANSI', 5, ARRAY['\bgaransi\b']::text[], NULL, '{}'::text[], 'Syarat garansi adalah kebijakan tetap yang tidak boleh bervariasi.'),
  ('OFFLINE', 6, ARRAY['\b(toko|gerai|outlet)\s*(offline|fisik)\b', '\boffline store\b', '\b(bisa|boleh)\s+(datang|mampir|ke toko)\b']::text[], NULL, '{}'::text[], 'Ketersediaan toko offline adalah fakta tetap.'),
  ('LIBUR', 7, ARRAY['\b(tanggal merah|hari libur|libur nasional)\b']::text[], NULL, '{}'::text[], 'Jadwal operasional hari libur adalah kebijakan tetap.'),
  ('SENIN', 8, ARRAY['\b(sabtu|minggu|weekend|akhir pekan)\b.*\b(kirim|dikirim|proses|diproses)\b', '\b(kirim|dikirim|proses|diproses)\b.*\b(sabtu|minggu|weekend|akhir pekan)\b']::text[], NULL, '{}'::text[], 'Kebijakan pemrosesan pesanan akhir pekan, kalimatnya tetap.'),
  ('PAKAI POC', 9, ARRAY['\b(cara (pakai|penggunaan|pake|aplikasi)|gimana pakai|dosis|takaran)\b.*\bpoc\b', '\bpoc\b.*\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b']::text[], NULL, '{}'::text[], 'Dosis POC wajib persis Knowledge Base — justru berbahaya bila dikarang AI.'),
  ('PAKAI NEEM', 10, ARRAY['\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b.*\b(neem|pestisida)\b', '\b(neem|pestisida)\b.*\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b']::text[], NULL, '{}'::text[], 'Dosis pestisida wajib persis Knowledge Base.'),
  ('PAKAI ABMB', 11, ARRAY['\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b.*\bab ?mix\b', '\bab ?mix\b.*\b(cara (pakai|penggunaan|pake)|dosis|takaran)\b']::text[], NULL, ARRAY['\binstan(t)?\b']::text[], 'Dosis AB Mix wajib persis Knowledge Base, termasuk larangan mencampur stok A dan B.'),
  ('CARA KALIBRASI ULANG TDS METER', 12, ARRAY['\bkalibrasi\b.*\btds\b|\btds\b.*\bkalibrasi\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Prosedur kalibrasi TDS meter — langkah baku, salah urutan bikin alat meleset.'),
  ('CARA KALIBRASI ULANG PH METER', 13, ARRAY['\bkalibrasi\b.*\bph\b|\bph\b.*\bkalibrasi\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Prosedur kalibrasi pH meter — langkah baku.'),
  ('HITUNG PPM TDS', 14, ARRAY['\b(hitung|ngitung|menghitung)\b.*\bppm\b|\bppm\b.*\b(hitung|ngitung|rumus)\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Rumus ppm nutrisi = ppm TDS dikurangi ppm air baku. Angka tetap.'),
  ('CARA PAKAI TDS METER', 15, ARRAY['\btds( ?meter)?\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Langkah pemakaian TDS meter — prosedur baku.'),
  ('CARA PAKAI PH METER', 16, ARRAY['\bph ?meter\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Langkah pemakaian pH meter — prosedur baku.'),
  ('SOIL METER', 17, ARRAY['\bsoil ?meter\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Langkah pemakaian soil meter — prosedur baku.'),
  ('PAKAI ABMC', 18, ARRAY['\bab ?mix instan(t)?\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis AB Mix instan 5 ml A + 5 ml B — wajib persis Knowledge Base.'),
  ('PAKAI FRUITEXPERT', 19, ARRAY['\bfruit ?expert\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Jadwal selang-seling Fruit Expert & POC — aturan tetap, bukan penilaian.'),
  ('VITAMIN AKAR', 20, ARRAY['\bvitamin akar\b|\bvitamin b ?1\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Jadwal selang-seling vitamin akar — aturan tetap.'),
  ('PAKAI AKAR', 21, ARRAY['\b(nutrisi|hormon) akar\b|\bauksin\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis hormon akar 0,5 ml/L untuk stek — wajib persis Knowledge Base.'),
  ('PAKAI B1', 22, ARRAY['\bb ?1\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis B1: 1 tutup botol per 2 liter — wajib persis.'),
  ('MAGNESIUM', 23, ARRAY['\b(magnesium|mgso4|garam inggris)\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis Magnesium Sulfat kocor 5-10 gr/L — wajib persis.'),
  ('CARA PAKAI NPK', 24, ARRAY['\bnpk\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis NPK 1 sdm per liter — wajib persis.'),
  ('PAKAI GUANO', 25, ARRAY['\bguano\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis pupuk guano — wajib persis Knowledge Base.'),
  ('DOLOMIT', 26, ARRAY['\bdolomit\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis dolomit 100-200 gr/m2 — wajib persis.'),
  ('MIRACLE POWDER', 27, ARRAY['\bmiracle( ?powder)?\b|\basam humat\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis Miracle Powder (asam humat) — wajib persis. Ditaruh sebelum [PRODUK MIRACLE] supaya pertanyaan pemakaian tidak dijawab deskripsi.'),
  ('NUTRIPOD', 28, ARRAY['\bnutripod\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis Nutripod 1 sachet per 10 liter — wajib persis.'),
  ('CARA PAKAI ASAM AMINO', 29, ARRAY['\basam amino\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis asam amino 5 ml/L — wajib persis.'),
  ('CARA PAKAI EM4', 30, ARRAY['\bem ?4\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Langkah pengomposan dengan EM4 — prosedur baku.'),
  ('PBM', 31, ARRAY['\bpbm\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis POC Sayur pada paket PBM — wajib persis.'),
  ('PAKAI AGK LENGKAP', 32, ARRAY['\bagk\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Urutan pemakaian paket AGK lengkap — prosedur baku.'),
  ('COCOPEAT', 33, ARRAY['\bcocopeat\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Langkah merendam & memakai cocopeat block — prosedur baku.'),
  ('CANGKOK', 34, ARRAY['\b(cangkok|groot)\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Langkah stek/cangkok dengan groot — prosedur baku.'),
  ('ATRAKTAN PETROGENOL', 35, ARRAY['\b(petrogenol|atraktan)\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Langkah pemasangan perangkap atraktan — prosedur baku.'),
  ('BIVI', 36, ARRAY['\bbivi\b']::text[], '\b(cara (pakai|penggunaan|pake|aplikasi|menggunakan|hitung|menghitung|ngitung|kalibrasi|cangkok|stek|semai|tanam|rendam|merendam)|gimana (cara )?(pakai|pake|makai)|cara nya|caranya|dosis|takaran|kalibrasi|berapa (ml|gram|gr|sendok|sdm|sdt|tutup|sachet)|per liter|per l\b)', '{}'::text[], 'Dosis BIVI 0,5 gr/L pencegahan — wajib persis.'),
  ('PRODUK POC', 37, ARRAY['\bpoc\b']::text[], '\b(apa itu|itu apa|ini apa|apa sih|apaan|fungsi(nya)?|manfaat(nya)?|kegunaan(nya)?|kandungan(nya)?|deskripsi(nya)?|jelasin|jelaskan|buat apa|untuk apa|produk apa)\b', ARRAY['\b(cara (pakai|penggunaan|pake|aplikasi)|gimana pakai|dosis|takaran|berapa ml|berapa gram|semprot|siram)\b', '\b(ready|stok|stock|kosong|harga|ongkir|kirim|resi|promo|diskon|garansi)\b']::text[], 'Deskripsi POC: pupuk organik cair untuk melebatkan buah & sayur. Kalimat tetap, tidak bergantung situasi pelanggan.'),
  ('PRODUK MIRACLE', 38, ARRAY['\bmiracle( ?powder)?\b']::text[], '\b(apa itu|itu apa|ini apa|apa sih|apaan|fungsi(nya)?|manfaat(nya)?|kegunaan(nya)?|kandungan(nya)?|deskripsi(nya)?|jelasin|jelaskan|buat apa|untuk apa|produk apa)\b', ARRAY['\b(cara (pakai|penggunaan|pake|aplikasi)|gimana pakai|dosis|takaran|berapa ml|berapa gram|semprot|siram)\b', '\b(ready|stok|stock|kosong|harga|ongkir|kirim|resi|promo|diskon|garansi)\b']::text[], 'Deskripsi Miracle Powder: menggemburkan tanah yang mengeras. Kalimat tetap.'),
  ('PRODUK AKAR', 39, ARRAY['\b(produk|nutrisi|booster) akar\b']::text[], '\b(apa itu|itu apa|ini apa|apa sih|apaan|fungsi(nya)?|manfaat(nya)?|kegunaan(nya)?|kandungan(nya)?|deskripsi(nya)?|jelasin|jelaskan|buat apa|untuk apa|produk apa)\b', ARRAY['\b(cara (pakai|penggunaan|pake|aplikasi)|gimana pakai|dosis|takaran|berapa ml|berapa gram|semprot|siram)\b', '\b(ready|stok|stock|kosong|harga|ongkir|kirim|resi|promo|diskon|garansi)\b']::text[], 'Deskripsi nutrisi akar: melebatkan akar & mengurangi stres tanaman stek. Kalimat tetap.'),
  ('PRODUK PELEBAT', 40, ARRAY['\b(paket )?pelebat\b']::text[], '\b(apa itu|itu apa|ini apa|apa sih|apaan|fungsi(nya)?|manfaat(nya)?|kegunaan(nya)?|kandungan(nya)?|deskripsi(nya)?|jelasin|jelaskan|buat apa|untuk apa|produk apa)\b', ARRAY['\b(cara (pakai|penggunaan|pake|aplikasi)|gimana pakai|dosis|takaran|berapa ml|berapa gram|semprot|siram)\b', '\b(ready|stok|stock|kosong|harga|ongkir|kirim|resi|promo|diskon|garansi)\b']::text[], 'Deskripsi paket pelebat untuk tanaman berbuah. Kalimat tetap.'),
  ('PRODUK PESTISIDA', 41, ARRAY['\bpestisida\b']::text[], '\b(apa itu|itu apa|ini apa|apa sih|apaan|fungsi(nya)?|manfaat(nya)?|kegunaan(nya)?|kandungan(nya)?|deskripsi(nya)?|jelasin|jelaskan|buat apa|untuk apa|produk apa)\b', ARRAY['\b(cara (pakai|penggunaan|pake|aplikasi)|gimana pakai|dosis|takaran|berapa ml|berapa gram|semprot|siram)\b', '\b(ready|stok|stock|kosong|harga|ongkir|kirim|resi|promo|diskon|garansi)\b']::text[], 'Deskripsi pestisida organik untuk ulat & kutu. Kalimat tetap; dosisnya tetap milik [PAKAI NEEM] atau AI.'),
  ('PRODUK SEEDBOOSTER', 42, ARRAY['\bseed ?booster\b']::text[], '\b(apa itu|itu apa|ini apa|apa sih|apaan|fungsi(nya)?|manfaat(nya)?|kegunaan(nya)?|kandungan(nya)?|deskripsi(nya)?|jelasin|jelaskan|buat apa|untuk apa|produk apa)\b', ARRAY['\b(cara (pakai|penggunaan|pake|aplikasi)|gimana pakai|dosis|takaran|berapa ml|berapa gram|semprot|siram)\b', '\b(ready|stok|stock|kosong|harga|ongkir|kirim|resi|promo|diskon|garansi)\b']::text[], 'Deskripsi seed booster untuk mempercepat benih dorman bertunas. Kalimat tetap.'),
  ('KOMPLAIN', 43, ARRAY['\b(rusak|pecah|bocor|penyok|jamuran|busuk)\b', '\b(salah kirim|kurang|tidak sesuai|gak sesuai|nggak sesuai|beda)\b.*\b(pesanan|barang|isi|produk)\b']::text[], NULL, '{}'::text[], 'Keluhan barang. sop.md mewajibkan alih ke CS manusia — balasan baku justru lebih aman daripada AI menyusun kalimat sendiri.')
) as v(code, priority, when_patterns, also_pattern, unless_patterns, why)
join public.templates t on t.code = v.code;

commit;

-- ===========================================================
-- Periksa hasilnya
-- ===========================================================
-- select count(*) as template from public.templates;          -- harus 152
-- select count(*) as aturan   from public.template_rules;     -- harus 43
--
-- Template yang BELUM punya pemicu — ini daftar kerja tim CS,
-- tiap satu yang ditutup memindahkan pertanyaannya dari jalur
-- berbayar ke jalur Rp 0:
-- select t.code, t.category_slug
-- from public.templates t
-- left join public.template_rules r on r.template_id = t.id
-- where r.id is null and t.is_active
-- order by t.category_slug, t.code;
