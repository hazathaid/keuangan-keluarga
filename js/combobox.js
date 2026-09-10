class SearchableSelect {
  constructor(root, onChange) {
    this.root = root;
    this.onChange = typeof onChange === 'function' ? onChange : () => {};
    this.input = root.querySelector('.combo-input');
    this.clearBtn = root.querySelector('.combo-clear');
    this.menu = root.querySelector('.combo-menu');

    this.options = [];
    this.filtered = [];
    this.selected = null;
    this.activeIndex = -1;
    this.query = '';

    this.input.addEventListener('focus', () => {
      this.query = '';
      this.input.select();
      this.open();
    });
    this.input.addEventListener('input', () => {
      this.query = this.input.value;
      this.activeIndex = -1;
      this.open();
    });
    this.input.addEventListener('keydown', (e) => this._handleKey(e));
    this.input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!this.root.contains(document.activeElement)) this._commitOrRevert();
      }, 0);
    });

    this.clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setSelected(null);
      this.close();
      this.onChange();
    });

    this.menu.addEventListener('mousedown', (e) => e.preventDefault());
    this.menu.addEventListener('click', (e) => {
      const li = e.target.closest('.combo-option');
      if (!li) return;
      const opt = this.filtered[Number(li.dataset.index)];
      if (!opt) return;
      this.setSelected(opt);
      this.close();
      this.onChange();
    });

    document.addEventListener('click', (e) => {
      if (!this.root.contains(e.target)) this.close();
    });
  }

  setOptions(options, selected) {
    this.options = options || [];
    let match = null;
    if (selected) {
      match = this.options.find(o =>
        o.kind === selected.kind && String(o.value) === String(selected.value)) || null;
    }
    this.setSelected(match, true);
  }

  setSelected(selected, silent) {
    this.selected = selected || null;
    this.query = this.selected ? this.selected.name : '';
    this.input.value = this.selected ? this.selected.name : '';
    this.clearBtn.classList.toggle('hidden', !this.selected);
    if (!silent) this._renderMenu();
  }

  getSelected() {
    return this.selected;
  }

  open() {
    this._renderMenu();
    this.menu.classList.remove('hidden');
    this.root.classList.add('is-open');
  }

  close() {
    this.menu.classList.add('hidden');
    this.root.classList.remove('is-open');
    this.activeIndex = -1;
  }

  _commitOrRevert() {
    this.close();
    this.query = this.selected ? this.selected.name : '';
    this.input.value = this.selected ? this.selected.name : '';
  }

  _handleKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.menu.classList.contains('hidden')) this.open();
      if (!this.filtered.length) return;
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex = (this.activeIndex + dir + this.filtered.length) % this.filtered.length;
      this._renderMenu();
      const active = this.menu.querySelector('.combo-option.is-active');
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (this.activeIndex >= 0 && this.filtered[this.activeIndex]) {
        e.preventDefault();
        this.setSelected(this.filtered[this.activeIndex]);
        this.close();
        this.onChange();
      }
    } else if (e.key === 'Escape') {
      this.close();
      this._commitOrRevert();
      this.input.blur();
    }
  }

  _renderMenu() {
    const q = this.query.trim().toLowerCase();
    this.filtered = this.options.filter(o => !q || o.name.toLowerCase().includes(q));

    if (!this.filtered.length) {
      this.menu.innerHTML = '<li class="combo-empty">Tidak ditemukan</li>';
      return;
    }

    let html = '';
    let lastGroup = null;
    this.filtered.forEach((o, i) => {
      if (o.group && o.group !== lastGroup) {
        html += `<li class="combo-group">${o.group}</li>`;
        lastGroup = o.group;
      }
      const active = i === this.activeIndex ? ' is-active' : '';
      const selected = this.selected && this.selected.kind === o.kind &&
        String(this.selected.value) === String(o.value) ? ' is-selected' : '';
      html += `<li class="combo-option${active}${selected}" data-index="${i}">${o.name}</li>`;
    });
    this.menu.innerHTML = html;
  }
}
