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

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "ユーザー名とパスワードを入力してください。" }), { status: 400 });
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // 🛡️ IPベースの連続作成制限チェック
    const recentRegs: any = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM registration_logs WHERE ip_address = ? AND created_at > ?"
    ).bind(clientIP, oneDayAgo).first();

    if (recentRegs && recentRegs.count >= 3) {
      return new Response(JSON.stringify({ error: "Bot対策のため、この端末からの新規アカウント作成を本日分は制限しています。" }), { status: 429 });
    }

    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();

    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id, username, password_hash, created_at, is_admin) VALUES (?, ?, ?, ?, 0)").bind(userId, username, hashedPassword, now),
      env.DB.prepare("INSERT INTO registration_logs (ip_address, created_at) VALUES (?, ?)").bind(clientIP, now)
    ]);

    return new Response(JSON.stringify({ success: true, message: "登録が完了しました！" }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    if (error.message.includes("UNIQUE")) {
      return new Response(JSON.stringify({ error: "そのユーザー名はすでに使われています。" }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: "サーバー側でエラーが発生しました。" }), { status: 500 });
  }
}