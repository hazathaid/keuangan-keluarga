const Budget = {
  currentDate: new Date(),

  init() {
    document.getElementById('btn-prev-month-budget').addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('btn-next-month-budget').addEventListener('click', () => this.changeMonth(1));
    document.getElementById('form-budget').addEventListener('submit', (e) => this.addBudget(e));
    document.getElementById('btn-add-budget-category').addEventListener('click', () => this.showCategoryModal());
    document.getElementById('btn-copy-budget').addEventListener('click', () => this.showCopyModal());
    document.getElementById('btn-close-modal-copy').addEventListener('click', () => this.hideCopyModal());
    document.getElementById('btn-cancel-copy').addEventListener('click', () => this.hideCopyModal());
    document.getElementById('btn-save-copy').addEventListener('click', () => this.saveCopyBudget());
    this.render();
  },

  changeMonth(delta) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    this.render();
  },

  getMonthLabel() {
    return this.currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  },

  async render() {
    const user = await Auth.getUser();
    if (!user) return;

    const month = this.currentDate.getMonth() + 1;
    const year = this.currentDate.getFullYear();

    document.getElementById('budget-month').textContent = this.getMonthLabel();

    const { data: budgets } = await supabaseClient
      .from('budget_plans')
      .select('id, amount, is_completed, category_id, categories(name)')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const { data: realExpenses } = await supabaseClient
      .from('transactions')
      .select('amount, category_id')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate);

    const listEl = document.getElementById('list-budget');
    if (!budgets || budgets.length === 0) {
      listEl.innerHTML = '<p class="empty-state py-4">📭 Belum ada rencana budget</p>';
      this.loadCategories();
      return;
    }

    listEl.innerHTML = budgets.map(b => {
      const catName = b.categories?.name || 'Tanpa Kategori';
      const realAmount = realExpenses
        ?.filter(e => e.category_id === b.category_id)
        .reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const pct = b.amount > 0 ? Math.round((realAmount / b.amount) * 100) : 0;

      return `
        <div class="budget-item">
          <div class="flex items-center gap-3">
            <input type="checkbox" class="budget-check" ${b.is_completed ? 'checked' : ''}
              onchange="Budget.toggleCompleted('${b.id}', this.checked)">
            <div>
              <p class="font-semibold ${b.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}">${catName}</p>
              <p class="text-xs text-gray-500 mt-0.5">Rencana: <span class="font-medium">${Format.currency(b.amount)}</span> | Real: <span class="font-medium">${Format.currency(realAmount)}</span> (${pct}%)</p>
            </div>
          </div>
          <button onclick="Budget.deleteBudget('${b.id}')" class="btn-danger">🗑️ Hapus</button>
        </div>
      `;
    }).join('');

    this.loadCategories();
  },

  async loadCategories() {
    const user = await Auth.getUser();
    if (!user) return;

    const { data } = await supabaseClient
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .order('name');

    const select = document.getElementById('budget-category');
    select.innerHTML = '<option value="">Pilih kategori</option>';
    (data || []).forEach(c => {
      select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
  },

  async addBudget(e) {
    e.preventDefault();
    const user = await Auth.getUser();
    if (!user) return;

    const category_id = document.getElementById('budget-category').value;
    const amount = document.getElementById('budget-amount').value;
    const month = this.currentDate.getMonth() + 1;
    const year = this.currentDate.getFullYear();

    const { error } = await supabaseClient.from('budget_plans').insert({
      category_id,
      amount: Number(amount),
      month,
      year,
      user_id: user.id
    });

    if (error) {
      alert('Gagal menyimpan rencana: ' + error.message);
      return;
    }

    e.target.reset();
    this.render();
    Dashboard.render();
  },

  async toggleCompleted(id, isCompleted) {
    const { error } = await supabaseClient.from('budget_plans').update({
      is_completed: isCompleted
    }).eq('id', id);

    if (error) {
      alert('Gagal update status: ' + error.message);
      return;
    }

    this.render();
    Dashboard.render();
  },

  async deleteBudget(id) {
    if (!confirm('Yakin hapus rencana ini?')) return;
    const { error } = await supabaseClient.from('budget_plans').delete().eq('id', id);
    if (error) {
      alert('Gagal hapus: ' + error.message);
      return;
    }
    this.render();
    Dashboard.render();
  },

  showCategoryModal() {
    document.getElementById('category-type').value = 'expense';
    document.getElementById('category-name').value = '';
    document.getElementById('modal-category').classList.remove('hidden');
  },

  async showCopyModal() {
    const user = await Auth.getUser();
    if (!user) return;

    const prevDate = new Date(this.currentDate);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonth = prevDate.getMonth() + 1;
    const prevYear = prevDate.getFullYear();

    const { data: budgets } = await supabaseClient
      .from('budget_plans')
      .select('id, amount, category_id, categories(name)')
      .eq('user_id', user.id)
      .eq('month', prevMonth)
      .eq('year', prevYear);

    const sourceLabel = prevDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    document.getElementById('copy-source-month').textContent = `Mengambil dari ${sourceLabel}`;

    const listEl = document.getElementById('copy-budget-list');
    if (!budgets || budgets.length === 0) {
      listEl.innerHTML = '<p class="empty-state py-6">📭 Tidak ada budget di bulan lalu</p>';
      document.getElementById('btn-save-copy').disabled = true;
      document.getElementById('modal-copy-budget').classList.remove('hidden');
      return;
    }

    document.getElementById('btn-save-copy').disabled = false;

    listEl.innerHTML = budgets.map(b => `
      <div class="copy-item" data-id="${b.id}" data-category-id="${b.category_id}">
        <input type="checkbox" class="budget-check copy-check" checked>
        <div class="copy-item-info">
          <span class="copy-item-name">${b.categories?.name || 'Tanpa Kategori'}</span>
        </div>
        <input type="number" class="input-field copy-amount" value="${b.amount}" min="1">
      </div>
    `).join('');

    document.getElementById('modal-copy-budget').classList.remove('hidden');
  },

  hideCopyModal() {
    document.getElementById('modal-copy-budget').classList.add('hidden');
  },

  async saveCopyBudget() {
    const user = await Auth.getUser();
    if (!user) return;

    const month = this.currentDate.getMonth() + 1;
    const year = this.currentDate.getFullYear();

    const items = document.querySelectorAll('.copy-item');
    const toInsert = [];

    items.forEach(item => {
      const checked = item.querySelector('.copy-check').checked;
      const amount = Number(item.querySelector('.copy-amount').value);
      const categoryId = item.dataset.categoryId;

      if (checked && amount > 0) {
        toInsert.push({
          category_id: categoryId,
          amount,
          month,
          year,
          user_id: user.id
        });
      }
    });

    if (toInsert.length === 0) {
      this.hideCopyModal();
      return;
    }

    const { error } = await supabaseClient.from('budget_plans').insert(toInsert);

    if (error) {
      alert('Gagal salin budget: ' + error.message);
      return;
    }

    this.hideCopyModal();
    this.render();
    Dashboard.render();
  }
};
