// functions/api/auth/login.ts

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

    // 1. ユーザーを検索
    const user: any = await env.DB.prepare(
      "SELECT id, password_hash FROM users WHERE username = ?"
    ).bind(username).first();

    if (!user) {
      return new Response(JSON.stringify({ error: "ユーザー名かパスワードが間違っています。" }), { status: 401 });
    }

    // 2. パスワードの答え合わせ
    const hashedPassword = await hashPassword(password);
    if (user.password_hash !== hashedPassword) {
      return new Response(JSON.stringify({ error: "ユーザー名かパスワードが間違っています。" }), { status: 401 });
    }

    // 3. ログイン成功！セッション（通行証）を発行
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 有効期限は7日間

    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(sessionId, user.id, expiresAt).run();

    // 4. ブラウザにCookieとして通行証を渡す
    const cookie = `session_id=${sessionId}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
    
    return new Response(JSON.stringify({ success: true, message: "ログインしました！" }), {
      headers: { 
        'Content-Type': 'application/json',
        'Set-Cookie': cookie 
      }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: "ログイン処理でエラーが発生しました。" }), { status: 500 });
  }
}