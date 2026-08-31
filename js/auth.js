const Auth = {
  async getUser() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return null;
    }
    return session.user;
  },

  async signOut() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  }
};
