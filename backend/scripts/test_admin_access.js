(async () => {
  try {
    // 1. Login via server auth endpoint
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@example.com', password: 'StrongP@ssw0rd' })
    });
    const loginBody = await loginRes.json();
    console.log('Login status', loginRes.status, loginBody);
    const token = loginBody.token;
    if (!token) {
      console.error('No token returned from login');
      process.exit(1);
    }

    // 2. Call admin users endpoint
    const usersRes = await fetch('http://localhost:5000/api/admin/users', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    const usersBody = await usersRes.text();
    console.log('/api/admin/users', usersRes.status, usersBody);

  } catch (err) {
    console.error('Test error', err);
  }
})();