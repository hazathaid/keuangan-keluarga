const Transactions = {
  incomeDate: new Date(),
  expenseDate: new Date(),

  init() {
    document.getElementById('btn-prev-month-income').addEventListener('click', () => this.changeMonth('income', -1));
    document.getElementById('btn-next-month-income').addEventListener('click', () => this.changeMonth('income', 1));
    document.getElementById('btn-prev-month-expense').addEventListener('click', () => this.changeMonth('expense', -1));
    document.getElementById('btn-next-month-expense').addEventListener('click', () => this.changeMonth('expense', 1));

    document.getElementById('form-income').addEventListener('submit', (e) => this.addTransaction(e, 'income'));
    document.getElementById('form-expense').addEventListener('submit', (e) => this.addTransaction(e, 'expense'));

    document.getElementById('btn-add-income-category').addEventListener('click', () => this.showCategoryModal('income'));
    document.getElementById('btn-add-expense-category').addEventListener('click', () => this.showCategoryModal('expense'));

    document.getElementById('form-category').addEventListener('submit', (e) => this.addCategory(e));
    document.getElementById('btn-close-modal').addEventListener('click', () => this.hideCategoryModal());

    document.getElementById('form-edit').addEventListener('submit', (e) => this.updateTransaction(e));
    document.getElementById('btn-close-modal-edit').addEventListener('click', () => this.hideEditModal());

    document.getElementById('btn-add-income-contact').addEventListener('click', () => this.showContactModal());
    document.getElementById('btn-add-expense-contact').addEventListener('click', () => this.showContactModal());
    document.getElementById('form-contact').addEventListener('submit', (e) => this.addContact(e));
    document.getElementById('btn-close-modal-contact').addEventListener('click', () => this.hideContactModal());

    document.getElementById('income-date').valueAsDate = new Date();
    document.getElementById('expense-date').valueAsDate = new Date();

    this.render('income');
    this.render('expense');
  },

  changeMonth(type, delta) {
    const dateRef = type === 'income' ? this.incomeDate : this.expenseDate;
    dateRef.setMonth(dateRef.getMonth() + delta);
    this.render(type);
  },

  getMonthLabel(type) {
    const dateRef = type === 'income' ? this.incomeDate : this.expenseDate;
    return dateRef.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  },

  async render(type) {
    const user = await Auth.getUser();
    if (!user) return;

    const dateRef = type === 'income' ? this.incomeDate : this.expenseDate;
    const month = dateRef.getMonth() + 1;
    const year = dateRef.getFullYear();
    const labelId = type === 'income' ? 'income-month' : 'expense-month';
    const tableId = type === 'income' ? 'table-income' : 'table-expense';
    const emptyId = type === 'income' ? 'empty-income' : 'empty-expense';

    document.getElementById(labelId).textContent = this.getMonthLabel(type);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(Format.lastDayOfMonth(year, month)).padStart(2, '0')}`;

    const { data } = await DB
      .from('transactions')
      .select('id, amount, date, note, contact_id, categories(name), contacts(name)')
      .eq('user_id', user.id)
      .eq('type', type)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    const tbody = document.getElementById(tableId);
    const emptyEl = document.getElementById(emptyId);

    if (!data || data.length === 0) {
      tbody.innerHTML = '';
      emptyEl.classList.remove('hidden');
    } else {
      emptyEl.classList.add('hidden');
      tbody.innerHTML = data.map(t => {
        const sourceName = t.categories?.name || t.contacts?.name || '-';
        const sourceTag = t.categories?.name ? 'category-tag' : (t.contacts?.name ? 'category-tag category-tag-contact' : '');
        return `
        <tr>
          <td>${Format.date(t.date)}</td>
          <td>${sourceName === '-' ? '<span class="text-gray-400">-</span>' : `<span class="${sourceTag}">${sourceName}</span>`}</td>
          <td class="text-right"><span class="amount-text amount-positive">${Format.currency(t.amount)}</span></td>
          <td class="text-gray-500">${t.note || '-'}</td>
          <td>
            <div class="action-buttons justify-center">
              <button onclick="Transactions.showEditModal('${t.id}','${type}')" class="btn-edit">✏️ Edit</button>
              <button onclick="Transactions.deleteTransaction('${t.id}','${type}')" class="btn-danger">🗑️ Hapus</button>
            </div>
          </td>
        </tr>
      `;
      }).join('');
    }

    this.loadSource(type);
  },

  async loadSource(type) {
    const user = await Auth.getUser();
    if (!user) return;

    const dateRef = type === 'income' ? this.incomeDate : this.expenseDate;
    const month = dateRef.getMonth() + 1;
    const year = dateRef.getFullYear();

    const [catsRes, contactsRes] = await Promise.all([
      DB.from('categories')
        .select('id, name, month, year')
        .eq('user_id', user.id)
        .eq('type', type)
        .order('name'),
      DB.from('contacts')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name')
    ]);

    const selectId = type === 'income' ? 'income-source' : 'expense-source';
    this.populateSource(selectId, Format.categoriesForMonth(catsRes.data, month, year), contactsRes.data || []);
  },

  populateSource(selectId, categories, contacts, chosenKind, chosenValue) {
    const select = document.getElementById(selectId);
    let html = '<option value="">Pilih kategori / kontak</option>';
    html += '<optgroup label="Kategori">';
    (categories || []).forEach(c => {
      html += `<option value="${c.id}" data-kind="category">${c.name}</option>`;
    });
    html += '</optgroup>';
    html += '<optgroup label="Kontak">';
    (contacts || []).forEach(c => {
      html += `<option value="${c.id}" data-kind="contact">${c.name}</option>`;
    });
    html += '</optgroup>';
    select.innerHTML = html;

    if (chosenKind && chosenValue) {
      select.value = '';
      const opt = Array.from(select.options).find(o =>
        o.value === String(chosenValue) && o.dataset.kind === chosenKind);
      if (opt) select.value = opt.value;
    }
  },

  resolveSource(selectId) {
    const select = document.getElementById(selectId);
    const idx = select.selectedIndex;
    const opt = select.options[idx];
    const kind = opt?.dataset.kind;
    const value = opt?.value;
    if (kind === 'category') return { category_id: value || null, contact_id: null };
    if (kind === 'contact') return { contact_id: value || null, category_id: null };
    return { category_id: null, contact_id: null };
  },

  async addTransaction(e, type) {
    e.preventDefault();
    const user = await Auth.getUser();
    if (!user) return;

    const date = document.getElementById(`${type === 'income' ? 'income' : 'expense'}-date`).value;
    const amount = Format.parseAmount(document.getElementById(`${type === 'income' ? 'income' : 'expense'}-amount`).value);
    const note = document.getElementById(`${type === 'income' ? 'income' : 'expense'}-note`).value;
    const source = this.resolveSource(`${type === 'income' ? 'income' : 'expense'}-source`);

    const { error } = await DB.from('transactions').insert({
      date,
      amount,
      type,
      note: note || null,
      category_id: source.category_id,
      contact_id: source.contact_id,
      user_id: user.id
    });

    if (error) {
      alert('Gagal menyimpan: ' + error.message);
      return;
    }

    e.target.reset();
    if (type === 'income') document.getElementById('income-date').valueAsDate = new Date();
    else document.getElementById('expense-date').valueAsDate = new Date();

    this.render(type);
    Dashboard.render();
  },

  async deleteTransaction(id, type) {
    if (!confirm('Yakin hapus transaksi ini?')) return;
    const { error } = await DB.from('transactions').delete().eq('id', id);
    if (error) {
      alert('Gagal hapus: ' + error.message);
      return;
    }
    this.render(type);
    Dashboard.render();
  },

  async showEditModal(id, type) {
    const user = await Auth.getUser();
    if (!user) return;

    const { data } = await DB
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (!data) return;

    document.getElementById('edit-id').value = data.id;
    document.getElementById('edit-type').value = type;
    document.getElementById('edit-date').value = data.date;
    document.getElementById('edit-amount').value = Format.formatAmount(data.amount);
    document.getElementById('edit-note').value = data.note || '';

    const sourceLabel = document.getElementById('edit-source-label');
    sourceLabel.textContent = type === 'income' ? 'Dari (Sumber)' : 'Ke (Tujuan)';

    const t = new Date(data.date);
    const tMonth = t.getMonth() + 1;
    const tYear = t.getFullYear();

    const { data: cats } = await DB
      .from('categories')
      .select('id, name, month, year')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('name');

    const { data: contacts } = await DB
      .from('contacts')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name');

    let chosenKind = null;
    let chosenValue = null;
    if (data.category_id) { chosenKind = 'category'; chosenValue = data.category_id; }
    else if (data.contact_id) { chosenKind = 'contact'; chosenValue = data.contact_id; }

    this.populateSource('edit-source', Format.categoriesForMonth(cats, tMonth, tYear), contacts || [], chosenKind, chosenValue);

    document.getElementById('modal-edit').classList.remove('hidden');
  },

  hideEditModal() {
    document.getElementById('modal-edit').classList.add('hidden');
  },

  async updateTransaction(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const type = document.getElementById('edit-type').value;
    const source = this.resolveSource('edit-source');

    const { error } = await DB.from('transactions').update({
      date: document.getElementById('edit-date').value,
      amount: Format.parseAmount(document.getElementById('edit-amount').value),
      note: document.getElementById('edit-note').value || null,
      category_id: source.category_id,
      contact_id: source.contact_id
    }).eq('id', id);

    if (error) {
      alert('Gagal update: ' + error.message);
      return;
    }

    this.hideEditModal();
    this.render(type);
    Dashboard.render();
  },

  setCategoryContext(type, dateRef) {
    document.getElementById('category-type').value = type;
    document.getElementById('category-month').value = dateRef.getMonth() + 1;
    document.getElementById('category-year').value = dateRef.getFullYear();
  },

  showCategoryModal(type) {
    const dateRef = type === 'income' ? this.incomeDate : this.expenseDate;
    this.setCategoryContext(type, dateRef);
    document.getElementById('category-name').value = '';
    document.getElementById('modal-category').classList.remove('hidden');
    this.renderCategoryList(type);
  },

  hideCategoryModal() {
    document.getElementById('modal-category').classList.add('hidden');
  },

  async renderCategoryList(type) {
    const user = await Auth.getUser();
    if (!user) return;

    const month = Number(document.getElementById('category-month').value);
    const year = Number(document.getElementById('category-year').value);

    const { data } = await DB
      .from('categories')
      .select('id, name, type, month, year')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('name');

    const listEl = document.getElementById('category-list');
    const cats = Format.categoriesForMonth(data, month, year);
    if (!cats.length) {
      listEl.innerHTML = '<p class="empty-state py-3">Belum ada kategori.</p>';
      return;
    }

    listEl.innerHTML = cats.map(c => `
      <div class="category-row">
        <span class="category-name">${c.name}</span>
        <button type="button" class="btn-danger-sm" onclick="Transactions.deleteCategory('${c.id}')">🗑 Hapus</button>
      </div>
    `).join('');
  },

  async deleteCategory(id) {
    const type = document.getElementById('category-type').value;
    const month = Number(document.getElementById('category-month').value);
    const year = Number(document.getElementById('category-year').value);
    if (!confirm(`Yakin hapus kategori ini (${month}/${year})?\nTransaksi & rencana budget bulan ini yang memakai kategori ini akan menjadi "Tanpa Kategori".`)) return;

    const { error } = await DB.from('categories').delete().eq('id', id);
    if (error) {
      alert('Gagal hapus: ' + error.message);
      return;
    }

    this.renderCategoryList(type);
    this.loadSource(type);
    Budget.loadCategories();
    this.render('income');
    this.render('expense');
    Budget.render();
  },

  async addCategory(e) {
    e.preventDefault();
    const user = await Auth.getUser();
    if (!user) return;

    const name = document.getElementById('category-name').value;
    const type = document.getElementById('category-type').value;
    const month = Number(document.getElementById('category-month').value);
    const year = Number(document.getElementById('category-year').value);

    const { error } = await DB.from('categories').insert({
      name,
      type,
      month,
      year,
      user_id: user.id
    });

    if (error) {
      alert('Gagal tambah kategori: ' + error.message);
      return;
    }

    document.getElementById('category-name').value = '';
    this.renderCategoryList(type);
    this.loadSource(type);
    Budget.loadCategories();
    this.render('income');
    this.render('expense');
    Budget.render();
  },

  showContactModal() {
    document.getElementById('contact-name').value = '';
    document.getElementById('modal-contact').classList.remove('hidden');
    this.renderContactList();
  },

  hideContactModal() {
    document.getElementById('modal-contact').classList.add('hidden');
  },

  async renderContactList() {
    const user = await Auth.getUser();
    if (!user) return;

    const { data } = await DB
      .from('contacts')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name');

    const listEl = document.getElementById('contact-list');
    if (!data || data.length === 0) {
      listEl.innerHTML = '<p class="empty-state py-3">Belum ada kontak.</p>';
      return;
    }

    listEl.innerHTML = data.map(c => `
      <div class="category-row">
        <span class="category-name">${c.name}</span>
        <button type="button" class="btn-danger-sm" onclick="Transactions.deleteContact('${c.id}')">🗑 Hapus</button>
      </div>
    `).join('');
  },

  async addContact(e) {
    e.preventDefault();
    const user = await Auth.getUser();
    if (!user) return;

    const name = document.getElementById('contact-name').value.trim();
    if (!name) return;

    const { error } = await DB.from('contacts').insert({
      name,
      user_id: user.id
    });

    if (error) {
      alert('Gagal tambah kontak: ' + error.message);
      return;
    }

    document.getElementById('contact-name').value = '';
    this.renderContactList();
    this.loadSource('income');
    this.loadSource('expense');
  },

  async deleteContact(id) {
    if (!confirm('Yakin hapus kontak ini?\nTransaksi yang memakai kontak ini akan menjadi "Tanpa Kontak".')) return;

    const { error } = await DB.from('contacts').delete().eq('id', id);
    if (error) {
      alert('Gagal hapus: ' + error.message);
      return;
    }

    this.renderContactList();
    this.loadSource('income');
    this.loadSource('expense');
    this.render('income');
    this.render('expense');
  }
};
