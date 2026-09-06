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
      tbody.innerHTML = data.map(t => `
        <tr>
          <td>${Format.date(t.date)}</td>
          <td><span class="category-tag">${t.categories?.name || '-'}</span></td>
          <td class="text-gray-600">${t.contacts?.name || '-'}</td>
          <td class="text-right"><span class="amount-text amount-positive">${Format.currency(t.amount)}</span></td>
          <td class="text-gray-500">${t.note || '-'}</td>
          <td>
            <div class="action-buttons justify-center">
              <button onclick="Transactions.showEditModal('${t.id}','${type}')" class="btn-edit">✏️ Edit</button>
              <button onclick="Transactions.deleteTransaction('${t.id}','${type}')" class="btn-danger">🗑️ Hapus</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    this.loadCategories(type);
    this.loadContacts();
  },

  async loadCategories(type) {
    const user = await Auth.getUser();
    if (!user) return;

    const dateRef = type === 'income' ? this.incomeDate : this.expenseDate;
    const month = dateRef.getMonth() + 1;
    const year = dateRef.getFullYear();

    const { data } = await DB
      .from('categories')
      .select('id, name, month, year')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('name');

    const selectId = type === 'income' ? 'income-category' : 'expense-category';
    const select = document.getElementById(selectId);
    const currentVal = select.value;
    select.innerHTML = '<option value="">Pilih kategori</option>';
    Format.categoriesForMonth(data, month, year).forEach(c => {
      select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    if (currentVal) select.value = currentVal;
  },

  async loadContacts() {
    const user = await Auth.getUser();
    if (!user) return;

    const { data } = await DB
      .from('contacts')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name');

    const opts = '<option value="">Tanpa kontak</option>' + (data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const incomeSel = document.getElementById('income-contact');
    const incomeVal = incomeSel.value;
    incomeSel.innerHTML = opts;
    if (incomeVal) incomeSel.value = incomeVal;

    const expenseSel = document.getElementById('expense-contact');
    const expenseVal = expenseSel.value;
    expenseSel.innerHTML = opts;
    if (expenseVal) expenseSel.value = expenseVal;
  },

  async addTransaction(e, type) {
    e.preventDefault();
    const user = await Auth.getUser();
    if (!user) return;

    const date = document.getElementById(`${type === 'income' ? 'income' : 'expense'}-date`).value;
    const category_id = document.getElementById(`${type === 'income' ? 'income' : 'expense'}-category`).value;
    const amount = Format.parseAmount(document.getElementById(`${type === 'income' ? 'income' : 'expense'}-amount`).value);
    const note = document.getElementById(`${type === 'income' ? 'income' : 'expense'}-note`).value;
    const contact_id = document.getElementById(`${type === 'income' ? 'income' : 'expense'}-contact`).value;

    const { error } = await DB.from('transactions').insert({
      date,
      category_id,
      amount,
      type,
      note: note || null,
      contact_id: contact_id || null,
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

    const contactLabel = document.getElementById('edit-contact-label');
    contactLabel.textContent = type === 'income' ? 'Dari (Sumber)' : 'Ke (Tujuan)';

    const catSelect = document.getElementById('edit-category');
    const { data: cats } = await DB
      .from('categories')
      .select('id, name, month, year')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('name');

    const t = new Date(data.date);
    const tMonth = t.getMonth() + 1;
    const tYear = t.getFullYear();

    catSelect.innerHTML = '<option value="">Pilih kategori</option>';
    Format.categoriesForMonth(cats, tMonth, tYear).forEach(c => {
      catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    catSelect.value = data.category_id;

    const contactSelect = document.getElementById('edit-contact');
    const { data: contacts } = await DB
      .from('contacts')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name');

    contactSelect.innerHTML = '<option value="">Tanpa kontak</option>';
    (contacts || []).forEach(c => {
      contactSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    contactSelect.value = data.contact_id || '';

    document.getElementById('modal-edit').classList.remove('hidden');
  },

  hideEditModal() {
    document.getElementById('modal-edit').classList.add('hidden');
  },

  async updateTransaction(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const type = document.getElementById('edit-type').value;

    const { error } = await DB.from('transactions').update({
      date: document.getElementById('edit-date').value,
      category_id: document.getElementById('edit-category').value,
      amount: Format.parseAmount(document.getElementById('edit-amount').value),
      note: document.getElementById('edit-note').value || null,
      contact_id: document.getElementById('edit-contact').value || null
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
    this.loadCategories(type);
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
    this.loadCategories(type);
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
    this.loadContacts();
  },

  async deleteContact(id) {
    if (!confirm('Yakin hapus kontak ini?\nTransaksi yang memakai kontak ini akan menjadi "Tanpa Kontak".')) return;

    const { error } = await DB.from('contacts').delete().eq('id', id);
    if (error) {
      alert('Gagal hapus: ' + error.message);
      return;
    }

    this.renderContactList();
    this.loadContacts();
    this.render('income');
    this.render('expense');
  }
};
