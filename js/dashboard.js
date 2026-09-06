const Dashboard = {
  currentDate: new Date(),

  init() {
    document.getElementById('btn-prev-month').addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('btn-next-month').addEventListener('click', () => this.changeMonth(1));
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

    document.getElementById('dashboard-month').textContent = this.getMonthLabel();

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(Format.lastDayOfMonth(year, month)).padStart(2, '0')}`;

    const { data: incomes } = await DB
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'income')
      .gte('date', startDate)
      .lte('date', endDate);

    const { data: expenses } = await DB
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate);

    const totalIncome = incomes?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalExpense = expenses?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const balance = totalIncome - totalExpense;

    document.getElementById('total-income').textContent = Format.currency(totalIncome);
    document.getElementById('total-expense').textContent = Format.currency(totalExpense);
    document.getElementById('total-balance').textContent = Format.currency(balance);

    const { data: budgets } = await DB
      .from('budget_plans')
      .select('amount, is_completed, category_id, categories(name)')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year);

    const summaryEl = document.getElementById('budget-summary');
    if (!budgets || budgets.length === 0) {
      summaryEl.innerHTML = '<p class="empty-state py-4">📭 Belum ada data budget</p>';
      return;
    }

    const { data: realExpenses } = await DB
      .from('transactions')
      .select('amount, category_id')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate);

    summaryEl.innerHTML = budgets.map(b => {
      const catName = b.categories?.name || 'Tanpa Kategori';
      const realAmount = realExpenses
        ?.filter(e => e.category_id === b.category_id)
        .reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const pct = b.amount > 0 ? Math.round((realAmount / b.amount) * 100) : 0;
      const barColor = pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-emerald-500';
      const remaining = Number(b.amount) - realAmount;
      const remainingText = remaining >= 0
        ? `<span class="text-emerald-600">Sisa: ${Format.currency(remaining)}</span>`
        : `<span class="text-red-600">Melebihi: ${Format.currency(Math.abs(remaining))}</span>`;

      return `
        <div class="p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div class="flex justify-between text-sm mb-2">
            <span class="font-semibold text-gray-700">${catName}</span>
            <span class="text-gray-500 font-medium">${Format.currency(realAmount)} / ${Format.currency(b.amount)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${barColor}" style="width: ${Math.min(pct, 100)}%"></div>
          </div>
          <p class="text-xs text-gray-400 mt-2 flex justify-between"><span class="font-medium">${pct}%</span><span>${remainingText}</span></p>
        </div>
      `;
    }).join('');
  }
};
