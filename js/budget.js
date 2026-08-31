const Budget = {
  currentDate: new Date(),

  init() {
    document.getElementById('btn-prev-month-budget').addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('btn-next-month-budget').addEventListener('click', () => this.changeMonth(1));
    document.getElementById('form-budget').addEventListener('submit', (e) => this.addBudget(e));
    document.getElementById('btn-add-budget-category').addEventListener('click', () => this.showCategoryModal());
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
      listEl.innerHTML = '<p class="text-center text-gray-400 py-8">Belum ada rencana budget</p>';
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
              <p class="font-medium ${b.is_completed ? 'line-through text-gray-400' : ''}">${catName}</p>
              <p class="text-xs text-gray-500">Rencana: ${Format.currency(b.amount)} | Real: ${Format.currency(realAmount)} (${pct}%)</p>
            </div>
          </div>
          <button onclick="Budget.deleteBudget('${b.id}')" class="btn-danger">Hapus</button>
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
  }
};
