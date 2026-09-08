# Dokumentasi Implementasi - Aplikasi Keuangan Keluarga

## Ikhtisar

Aplikasi pencatatan keuangan keluarga berbasis web dengan fitur:
- Pencatatan pemasukan & pengeluaran dengan **From/To gabungan (Kategori + Kontak)**
- Rencana pengeluaran bulanan dengan kategori custom
- Checklist status rencana (sudah/sbelum dilakukan)
- Dashboard ringkasan keuangan dengan sisa budget
- Keamanan data (app-level, aman tanpa RLS)

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Frontend | HTML5, Vanilla JavaScript |
| Styling | Tailwind CSS (CDN) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Email/Password) |
| Hosting | GitHub Pages |

## Database Schema

### Tabel `profiles`
| Field | Type | Keterangan |
|-------|------|------------|
| id | uuid (PK) | Reference ke auth.users |
| email | text | Email user |
| full_name | text | Nama lengkap |

### Tabel `categories`
| Field | Type | Keterangan |
|-------|------|------------|
| id | uuid (PK) | Auto-generated |
| name | text | Nama kategori |
| type | text | 'income' atau 'expense' |
| month | int | Bulan (1-12). NULL = berlaku di semua bulan |
| year | int | Tahun. NULL = berlaku di semua bulan |
| user_id | uuid (FK) | Reference ke profiles |

### Tabel `transactions`
| Field | Type | Keterangan |
|-------|------|------------|
| id | uuid (PK) | Auto-generated |
| amount | numeric | Nominal transaksi |
| type | text | 'income' atau 'expense' |
| category_id | uuid (FK) | Reference ke categories |
| contact_id | uuid (FK) | Reference ke contacts. NULL = tanpa kontak (opsional) |
| date | date | Tanggal transaksi |
| note | text | Catatan (opsional) |
| user_id | uuid (FK) | Reference ke profiles |

### Tabel `contacts`
| Field | Type | Keterangan |
|-------|------|------------|
| id | uuid (PK) | Auto-generated |
| name | text | Nama kontak (misal: 'Pak Budi', 'Toko ABC') |
| user_id | uuid (FK) | Reference ke profiles |

Kontak bersifat **unified** — bisa dipakai sebagai pengirim (Dari) pada pemasukan maupun penerima (Ke) pada pengeluaran. Dipilih dari dropdown gabungan "Dari (Sumber)" / "Ke (Tujuan)" bersama kategori (dalam optgroup terpisah).

### Tabel `budget_plans`
| Field | Type | Keterangan |
|-------|------|------------|
| id | uuid (PK) | Auto-generated |
| amount | numeric | Nominal rencana |
| category_id | uuid (FK) | Reference ke categories |
| month | int | Bulan (1-12) |
| year | int | Tahun |
| is_completed | boolean | Sudah dilakukan atau belum |
| user_id | uuid (FK) | Reference ke profiles |

## Keamanan Data (App-Level)

Semua query ke database tidak memakai `supabaseClient` secara langsung, melainkan lewat wrapper **`js/db.js`**:

```js
DB.init(user); // dipanggil sekali setelah login

// Contoh: query membaca otomatis di-filter user_id
const { data } = await DB.from('transactions').select('*').eq('id', id);

// Contoh: update & delete otomatis di-filter user_id (tidak bisa akses data user lain)
await DB.from('transactions').update({ amount: 100 }).eq('id', id);
await DB.from('transactions').delete().eq('id', id);
```

**Fitur wrapper:**
- **Auto-inject `user_id`** — setiap query (SELECT/INSERT/UPDATE/DELETE) otomatis difilter ke user yang login. Tidak mungkin membaca/merubah data user lain.
- **Guard on write** — `UPDATE`/`DELETE` tanpa `WHERE` akan diblokir (throw error) demi mencegah modifikasi massal tak sengaja.
- **Konsisten untuk migrasi** — semua file menggunakan `DB.from()`; saat pindah ke MySQL tinggal ganti implementasi di dalam `db.js` (tanpa ubah satu pun file lain).

Walaupun RLS (Row Level Security) dianjurkan sebagai lapisan keamanan tambahan di Supabase, aplikasi ini **tetap aman tanpa RLS** karena filter `user_id` sudah terpusat di `db.js`. Ini memudahkan migrasi ke database tanpa RLS seperti MySQL.

## Struktur File

```
keuangan_keluarga/
├── index.html              # Halaman utama (SPA)
├── login.html              # Halaman login/register
├── css/
│   └── style.css           # Custom CSS
├── js/
│   ├── app.js              # Router & inisialisasi global
│   ├── supabase.js         # Koneksi Supabase (raw client)
│   ├── db.js               # DB wrapper — auto-inject user_id + query builder
│   ├── auth.js             # Autentikasi user
│   ├── transactions.js     # CRUD pemasukan & pengeluaran
│   ├── budget.js           # CRUD rencana + checkbox
│   └── dashboard.js        # Ringkasan & visualisasi
└── docs/
    └── IMPLEMENTASI.md     # Dokumen ini
```

## Halaman Aplikasi

### 1. Login/Register (`login.html`)
- Form login dengan email & password
- Form register untuk user baru
- Redirect ke index.html setelah login

### 2. Dashboard (`index.html` - default view)
- Total pemasukan bulan ini
- Total pengeluaran bulan ini
- Saldo (pemasukan - pengeluaran)
- Pie chart perbandingan kategori

### 3. Pemasukan (`index.html#pemasukan`)
- Form tambah pemasukan (tanggal, dari/sumber, nominal, catatan)
- Dropdown gabungan **Dari (Sumber)** dengan optgroup Kategori + Kontak
- Tombol "+ Kategori" & "+ Kontak" langsung dari form
- Tabel daftar pemasukan dengan kolom sumber (kategori/kontak)
- Filter berdasarkan bulan
- Edit & hapus data

### 4. Pengeluaran (`index.html#pengeluaran`)
- Form tambah pengeluaran (tanggal, ke/tujuan, nominal, catatan)
- Dropdown gabungan **Ke (Tujuan)** dengan optgroup Kategori + Kontak
- Tombol "+ Kategori" & "+ Kontak" langsung dari form
- Tabel daftar pengeluaran dengan kolom tujuan (kategori/kontak)
- Filter berdasarkan bulan
- Edit & hapus data

### 5. Rencana Budget (`index.html#budget`)
- Pilih bulan/tahun
- Form tambah rencana: kategori + nominal
- Daftar rencana dengan checkbox
- Perbandingan rencana vs realisasi + **sisa budget** per kategori
- Salin rencana dari bulan lalu

## Setup Supabase

### 1. Buat Project Supabase
1. Buka https://supabase.com
2. Klik "New Project"
3. Isi nama project & password database
4. Tunggu project selesai dibuat

### 2. Jalankan SQL Schema
Buka SQL Editor di dashboard Supabase, jalankan query berikut:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tabel profiles
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text,
  created_at timestamp default now()
);

-- Tabel kategori custom
-- month & year: kategori bulan-scoped. NULL berarti kategori global (semua bulan).
create table categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text check (type in ('income', 'expense')) not null,
  month int check (month between 1 and 12),
  year int,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamp default now()
);

-- Tabel kontak (unified, opsional; bisa jadi "Dari" maupun "Ke")
create table contacts (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamp default now()
);

-- Tabel transaksi
create table transactions (
  id uuid default uuid_generate_v4() primary key,
  amount numeric not null check (amount > 0),
  type text check (type in ('income', 'expense')) not null,
  category_id uuid references categories(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  date date not null default current_date,
  note text,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamp default now()
);

-- Tabel rencana budget
create table budget_plans (
  id uuid default uuid_generate_v4() primary key,
  amount numeric not null check (amount > 0),
  category_id uuid references categories(id) on delete set null,
  month int not null check (month between 1 and 12),
  year int not null,
  is_completed boolean default false,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamp default now()
);
```

### 3. Ambil API Keys
Buka **Settings > API** di dashboard Supabase:
- `SUPABASE_URL` - URL project
- `SUPABASE_ANON_KEY` - Anon/public key

Masukkan di `js/supabase.js`:

```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJxxxxx';
```

## Deploy ke GitHub Pages

### 1. Init Git Repository
```bash
git init
git add .
git commit -m "Initial commit: Aplikasi Keuangan Keluarga"
```

### 2. Buat Repository di GitHub
1. Buka https://github.com/new
2. Buat repository baru (public)
3. Connect local repo:
```bash
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages
1. Buka repository di GitHub
2. Klik **Settings** > **Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** / **root**
5. Klik **Save**

Aplikasi akan bisa diakses di:
`https://USERNAME.github.io/REPO_NAME/`

## Cara Penggunaan

### Menambah Kategori Custom
1. Buka halaman Pemasukan/Pengeluaran
2. Klik "Tambah Kategori"
3. Isi nama kategori & pilih tipe (income/expense)

### Mencatat Pemasukan
1. Buka halaman Pemasukan
2. Klik "Tambah Pemasukan"
3. Isi: tanggal, pilih **Dari (Sumber)** dari kategori atau kontak, nominal, catatan
4. Klik "Simpan"

### Mencatat Pengeluaran
1. Buka halaman Pengeluaran
2. Klik "Tambah Pengeluaran"
3. Isi: tanggal, pilih **Ke (Tujuan)** dari kategori atau kontak, nominal, catatan
4. Klik "Simpan"

### Kelola Kontak
1. Di form pemasukan/pengeluaran, klik "+ Kontak"
2. Isi nama kontak, klik "Tambah"
3. Kontak otomatis muncul di dropdown "Kontak" pada form

### Membuat Rencana Budget
1. Buka halaman Rencana Budget
2. Pilih bulan & tahun
3. Klik "Tambah Rencana"
4. Pilih kategori & isi nominal
5. Centang checkbox ketika sudah dilakukan

### Melihat Dashboard
- Dashboard otomatis menampilkan ringkasan bulan ini
- Gunakan navigasi untuk ganti bulan
