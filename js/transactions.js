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
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const { data } = await supabaseClient
      .from('transactions')
      .select('id, amount, date, note, categories(name)')
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
      return;
    }

    emptyEl.classList.add('hidden');
    tbody.innerHTML = data.map(t => `
      <tr class="border-b hover:bg-gray-50">
        <td class="py-2">${Format.date(t.date)}</td>
        <td class="py-2">${t.categories?.name || '-'}</td>
        <td class="py-2 text-right font-medium">${Format.currency(t.amount)}</td>
        <td class="py-2 text-gray-500">${t.note || '-'}</td>
        <td class="py-2 text-center">
          <button onclick="Transactions.showEditModal('${t.id}','${type}')" class="btn-edit mr-1">Edit</button>
          <button onclick="Transactions.deleteTransaction('${t.id}','${type}')" class="btn-danger">Hapus</button>
        </td>
      </tr>
    `).join('');

    this.loadCategories(type);
  },

  async loadCategories(type) {
    const user = await Auth.getUser();
    if (!user) return;

    const { data } = await supabaseClient
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('name');

    const selectId = type === 'income' ? 'income-category' : 'expense-category';
    const select = document.getElementById(selectId);
    const currentVal = select.value;
    select.innerHTML = '<option value="">Pilih kategori</option>';
    (data || []).forEach(c => {
      select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    if (currentVal) select.value = currentVal;
  },

  async addTransaction(e, type) {
    e.preventDefault();
    const user = await Auth.getUser();
    if (!user) return;

    const date = document.getElementById(`${type === 'income' ? 'income' : 'expense'}-date`).value;
    const category_id = document.getElementById(`${type === 'income' ? 'income' : 'expense'}-category`).value;
    const amount = document.getElementById(`${type === 'income' ? 'income' : 'expense'}-amount`).value;
    const note = document.getElementById(`${type === 'income' ? 'income' : 'expense'}-note`).value;

    const { error } = await supabaseClient.from('transactions').insert({
      date,
      category_id,
      amount: Number(amount),
      type,
      note: note || null,
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
    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
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

    const { data } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (!data) return;

    document.getElementById('edit-id').value = data.id;
    document.getElementById('edit-type').value = type;
    document.getElementById('edit-date').value = data.date;
    document.getElementById('edit-amount').value = data.amount;
    document.getElementById('edit-note').value = data.note || '';

    const catSelect = document.getElementById('edit-category');
    const { data: cats } = await supabaseClient
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('name');

    catSelect.innerHTML = '<option value="">Pilih kategori</option>';
    (cats || []).forEach(c => {
      catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    catSelect.value = data.category_id;

    document.getElementById('modal-edit').classList.remove('hidden');
  },

  hideEditModal() {
    document.getElementById('modal-edit').classList.add('hidden');
  },

  async updateTransaction(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const type = document.getElementById('edit-type').value;

    const { error } = await supabaseClient.from('transactions').update({
      date: document.getElementById('edit-date').value,
      category_id: document.getElementById('edit-category').value,
      amount: Number(document.getElementById('edit-amount').value),
      note: document.getElementById('edit-note').value || null
    }).eq('id', id);

    if (error) {
      alert('Gagal update: ' + error.message);
      return;
    }

    this.hideEditModal();
    this.render(type);
    Dashboard.render();
  },

  showCategoryModal(type) {
    document.getElementById('category-type').value = type;
    document.getElementById('category-name').value = '';
    document.getElementById('modal-category').classList.remove('hidden');
  },

  hideCategoryModal() {
    document.getElementById('modal-category').classList.add('hidden');
  },

  async addCategory(e) {
    e.preventDefault();
    const user = await Auth.getUser();
    if (!user) return;

    const name = document.getElementById('category-name').value;
    const type = document.getElementById('category-type').value;

    const { error } = await supabaseClient.from('categories').insert({
      name,
      type,
      user_id: user.id
    });

    if (error) {
      alert('Gagal tambah kategori: ' + error.message);
      return;
    }

    this.hideCategoryModal();
    this.loadCategories(type);
    Budget.loadCategories();
  }
};
