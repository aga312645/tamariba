// functions/api/auth/register.ts

// 🔒 パスワードを暗号化（ハッシュ化）する安全な関数
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

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "ユーザー名とパスワードを入力してください。" }), { status: 400 });
    }

    // 1. パスワードをハッシュ化
    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();
    const now = Date.now();

    // 2. データベースに保存
    await env.DB.prepare(
      "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)"
    ).bind(userId, username, hashedPassword, now).run();

    return new Response(JSON.stringify({ success: true, message: "登録が完了しました！" }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    // ユーザー名が既に使われている場合（UNIQUE制約エラー）
    if (error.message.includes("UNIQUE")) {
      return new Response(JSON.stringify({ error: "そのユーザー名はすでに使われています。" }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: "登録処理でエラーが発生しました。" }), { status: 500 });
  }
}