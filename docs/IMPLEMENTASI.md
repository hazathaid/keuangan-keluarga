# Dokumentasi Implementasi - Aplikasi Keuangan Keluarga

## Ikhtisar

Aplikasi pencatatan keuangan keluarga berbasis web dengan fitur:
- Pencatatan pemasukan
- Pencatatan pengeluaran real
- Rencana pengeluaran bulanan dengan kategori custom
- Checklist status rencana (sudah/sbelum dilakukan)
- Dashboard ringkasan keuangan

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
| user_id | uuid (FK) | Reference ke profiles |

### Tabel `transactions`
| Field | Type | Keterangan |
|-------|------|------------|
| id | uuid (PK) | Auto-generated |
| amount | numeric | Nominal transaksi |
| type | text | 'income' atau 'expense' |
| category_id | uuid (FK) | Reference ke categories |
| date | date | Tanggal transaksi |
| note | text | Catatan (opsional) |
| user_id | uuid (FK) | Reference ke profiles |

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

## Struktur File

```
keuangan_keluarga/
├── index.html              # Halaman utama (SPA)
├── login.html              # Halaman login/register
├── css/
│   └── style.css           # Custom CSS
├── js/
│   ├── app.js              # Router & inisialisasi global
│   ├── supabase.js         # Koneksi Supabase
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
- Form tambah pemasukan (tanggal, kategori, nominal, catatan)
- Tabel daftar pemasukan
- Filter berdasarkan bulan
- Edit & hapus data

### 4. Pengeluaran (`index.html#pengeluaran`)
- Form tambah pengeluaran (tanggal, kategori, nominal, catatan)
- Tabel daftar pengeluaran
- Filter berdasarkan bulan
- Edit & hapus data

### 5. Rencana Budget (`index.html#budget`)
- Pilih bulan/tahun
- Form tambah rencana: kategori + nominal
- Daftar rencana dengan checkbox
- Perbandingan rencana vs realisasi

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

-- Tabel profiles (auto-create saat register)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text,
  created_at timestamp default now()
);

-- Tabel kategori custom
create table categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text check (type in ('income', 'expense')) not null,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamp default now()
);

-- Tabel transaksi
create table transactions (
  id uuid default uuid_generate_v4() primary key,
  amount numeric not null check (amount > 0),
  type text check (type in ('income', 'expense')) not null,
  category_id uuid references categories(id) on delete set null,
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

-- Enable RLS (Row Level Security)
alter table profiles enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budget_plans enable row level security;

-- RLS Policies: User hanya bisa akses data sendiri
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "Users can manage own categories" on categories
  for all using (auth.uid() = user_id);

create policy "Users can manage own transactions" on transactions
  for all using (auth.uid() = user_id);

create policy "Users can manage own budget plans" on budget_plans
  for all using (auth.uid() = user_id);

-- Trigger: Auto-create profile saat register
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
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
3. Isi: tanggal, kategori, nominal, catatan
4. Klik "Simpan"

### Mencatat Pengeluaran
1. Buka halaman Pengeluaran
2. Klik "Tambah Pengeluaran"
3. Isi: tanggal, kategori, nominal, catatan
4. Klik "Simpan"

### Membuat Rencana Budget
1. Buka halaman Rencana Budget
2. Pilih bulan & tahun
3. Klik "Tambah Rencana"
4. Pilih kategori & isi nominal
5. Centang checkbox ketika sudah dilakukan

### Melihat Dashboard
- Dashboard otomatis menampilkan ringkasan bulan ini
- Gunakan navigasi untuk ganti bulan
