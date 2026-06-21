// functions/api/board.ts

// 保存 (POST) - 🔒 ログイン必須
export async function onRequestPost(context: any) {
  const { env, request } = context;
  try {
    if (!env.DB) throw new Error("D1データベース(env.DB)が見つかりません。");

    // 1. ブラウザから送られてきたCookieからセッションIDを取り出す
    const cookieHeader = request.headers.get("Cookie") || "";
    const match = cookieHeader.match(/session_id=([^;]+)/);
    const sessionId = match ? match[1] : null;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "ログインが必要です。" }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. D1データベースでセッションIDが有効か（有効期限内か）チェックする
    const now = Date.now();
    const session: any = await env.DB.prepare(
      "SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?"
    ).bind(sessionId, now).first();

    if (!session) {
      return new Response(JSON.stringify({ error: "セッションが切れました。再度ログインしてください。" }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. 認証成功！ 今まで通りホワイトボードのデータを保存する
    const data = await request.json();
    
    const result: any = await env.DB.prepare(`
      INSERT INTO board (id, snapshot, version) 
      VALUES (1, ?, 1) 
      ON CONFLICT(id) 
      DO UPDATE SET snapshot = ?, version = version + 1
      RETURNING version
    `).bind(JSON.stringify(data), JSON.stringify(data)).first();

    return new Response(JSON.stringify({ success: true, version: result ? result.version : 1 }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, detail: "保存処理（POST）でエラーが発生しました。" }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 取得 (GET) - 👁️ 誰でも閲覧可能
export async function onRequestGet(context: any) {
  const { env } = context;
  try {
    if (!env.DB) throw new Error("D1データベース(env.DB)が見つかりません。");

    const result: any = await env.DB.prepare("SELECT snapshot, version FROM board WHERE id = 1").first();
    
    if (!result) {
      return new Response(JSON.stringify({ snapshot: {}, version: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      snapshot: JSON.parse(result.snapshot),
      version: result.version
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, detail: "読み込み処理（GET）でエラーが発生しました。" }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}