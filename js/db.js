const DB = {
  _user: null,

  init(user) {
    this._user = user;
  },

  user() {
    return this._user;
  },

  from(table, opts = {}) {
    return new DBQuery(this._user, table, opts);
  }
};

class DBQuery {
  constructor(user, table, opts = {}) {
    this.user = user;
    this.table = table;
    this.opts = opts;
    this.skipUser = opts.skipUser === true;

    this.operation = null;
    this.fields = '*';
    this.payload = null;
    this.filters = [];
    this.orders = [];
    this.isSingle = false;
    this.returning = false;

    this.tables = [];
  }

  get hasUserColumn() {
    return this.table !== 'profiles';
  }

  select(fields = '*') {
    if (this.operation === null || this.operation === 'select') {
      this.operation = 'select';
      this.fields = fields;
    } else {
      this.returning = true;
      this.fields = fields;
    }
    return this;
  }

  insert(data) {
    this.operation = 'insert';
    this.payload = Array.isArray(data) ? [...data] : { ...data };
    return this;
  }

  update(data) {
    this.operation = 'update';
    this.payload = { ...data };
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column, value) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ op: 'neq', column, value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ op: 'gt', column, value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ op: 'gte', column, value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ op: 'lt', column, value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ op: 'lte', column, value });
    return this;
  }

  in(column, value) {
    this.filters.push({ op: 'in', column, value });
    return this;
  }

  order(column, opts) {
    this.orders.push({ column, opts });
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = 'maybe';
    return this;
  }

  _applyUser(q) {
    if (this.hasUserColumn && this.user && !this.skipUser) {
      q = q.eq('user_id', this.user.id);
    }
    return q;
  }

  _applyFilters(q) {
    for (const f of this.filters) {
      switch (f.op) {
        case 'eq': q = q.eq(f.column, f.value); break;
        case 'neq': q = q.neq(f.column, f.value); break;
        case 'gt': q = q.gt(f.column, f.value); break;
        case 'gte': q = q.gte(f.column, f.value); break;
        case 'lt': q = q.lt(f.column, f.value); break;
        case 'lte': q = q.lte(f.column, f.value); break;
        case 'in': q = q.in(f.column, f.value); break;
      }
    }
    return q;
  }

  _injectUser(data) {
    if (this.hasUserColumn && this.user && !this.skipUser) {
      if (Array.isArray(data)) {
        return data.map(row => (row.user_id ? row : { ...row, user_id: this.user.id }));
      }
      if (data && !data.user_id) {
        return { ...data, user_id: this.user.id };
      }
    }
    return data;
  }

  _guardWrites() {
    if ((this.operation === 'update' || this.operation === 'delete') && this.filters.length === 0) {
      throw new Error(`[DB] ${this.operation.toUpperCase()} pada '${this.table}' tanpa WHERE diblokir demi keamanan.`);
    }
  }

  build() {
    this._guardWrites();
    let q = supabaseClient.from(this.table);

    if (this.operation === 'select') {
      q = q.select(this.fields);
      q = this._applyUser(q);
      q = this._applyFilters(q);
      for (const o of this.orders) q = q.order(o.column, o.opts);
      if (this.isSingle === true) q = q.single();
      else if (this.isSingle === 'maybe') q = q.maybeSingle();
      return q;
    }

    if (this.operation === 'insert') {
      q = q.insert(this._injectUser(this.payload));
      if (this.returning) q = q.select(this.fields);
      if (this.isSingle === true) q = q.single();
      else if (this.isSingle === 'maybe') q = q.maybeSingle();
      return q;
    }

    if (this.operation === 'update') {
      q = q.update(this.payload);
      q = this._applyUser(q);
      q = this._applyFilters(q);
      if (this.returning) {
        q = q.select(this.fields);
        if (this.isSingle === true) q = q.single();
      }
      return q;
    }

    if (this.operation === 'delete') {
      q = q.delete();
      q = this._applyUser(q);
      q = this._applyFilters(q);
      return q;
    }

    throw new Error('[DB] Operasi tidak dikenali.');
  }

  async exec() {
    const q = this.build();
    const { data, error } = await q;
    return { data, error };
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}
