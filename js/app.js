const Format = {
  currency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  },

  date(dateStr) {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  },

  lastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }
};

const App = {
  currentPage: 'dashboard',

  async init() {
    const user = await Auth.getUser();
    if (!user) return;

    document.getElementById('user-email').textContent = user.email;
    document.getElementById('btn-logout').addEventListener('click', () => Auth.signOut());

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => this.navigateTo(tab.dataset.page));
    });

    Transactions.init();
    Budget.init();

    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigateTo(hash);

    window.addEventListener('hashchange', () => {
      const page = window.location.hash.replace('#', '') || 'dashboard';
      this.navigateTo(page);
    });
  },

  navigateTo(page) {
    this.currentPage = page;
    window.location.hash = page;

    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    const tabEl = document.querySelector(`[data-page="${page}"]`);

    if (pageEl) pageEl.classList.remove('hidden');
    if (tabEl) tabEl.classList.add('active');

    switch (page) {
      case 'dashboard':
        Dashboard.render();
        break;
      case 'pemasukan':
        Transactions.render('income');
        break;
      case 'pengeluaran':
        Transactions.render('expense');
        break;
      case 'budget':
        Budget.render();
        break;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
