async function hashPassword(password: string) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context: any) {
  const { env, request } = context;
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const match = cookieHeader.match(/session_id=([^;]+)/);
    const sessionId = match ? match[1] : null;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "ログインが必要です。" }), { status: 401 });
    }

    const { oldPassword, newPassword } = await request.json();
    if (!oldPassword || !newPassword) {
      return new Response(JSON.stringify({ error: "値をすべて入力してください。" }), { status: 400 });
    }

    const sessionData: any = await env.DB.prepare(`
      SELECT users.id, users.password_hash FROM sessions 
      JOIN users ON sessions.user_id = users.id 
      WHERE sessions.id = ? AND sessions.expires_at > ?
    `).bind(sessionId, Date.now()).first();

    if (!sessionData) {
      return new Response(JSON.stringify({ error: "有効なセッションが見つかりません。" }), { status: 401 });
    }

    const oldHash = await hashPassword(oldPassword);
    if (oldHash !== sessionData.password_hash) {
      return new Response(JSON.stringify({ error: "現在のパスワードが違います。" }), { status: 403 });
    }

    const newHash = await hashPassword(newPassword);
    await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(newHash, sessionData.id).run();

    return new Response(JSON.stringify({ success: true, message: "パスワードを更新しました。" }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "サーバーエラー" }), { status: 500 });
  }
}