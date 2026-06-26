async function hashPassword(password: string) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context: any) {
  const { env, request } = context;
  try {
    const { username, password } = await request.json();
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    const user: any = await env.DB.prepare("SELECT id, password_hash, is_admin FROM users WHERE username = ?").bind(username).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "ユーザー名かパスワードが間違っています。" }), { status: 401 });
    }

    const hashedPassword = await hashPassword(password);
    if (user.password_hash !== hashedPassword) {
      return new Response(JSON.stringify({ error: "ユーザー名かパスワードが間違っています。" }), { status: 401 });
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30日間

    // セッションの保存と同時に、ユーザーの最終ログインIPを更新
    await env.DB.batch([
      env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(sessionId, user.id, expiresAt),
      env.DB.prepare("UPDATE users SET last_login_ip = ? WHERE id = ?").bind(clientIP, user.id)
    ]);

    const cookie = `session_id=${sessionId}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; Secure; SameSite=Strict`;
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "ログインしました！",
      isAdmin: user.is_admin === 1
    }), {
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "サーバーエラーが発生しました。" }), { status: 500 });
  }
}