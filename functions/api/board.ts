export async function onRequestGet(context: any) {
  const { env } = context;
  try {
    const board: any = await env.DB.prepare("SELECT snapshot, version FROM board WHERE id = 1").first();
    if (!board) {
      return new Response(JSON.stringify({ snapshot: {}, version: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({
      snapshot: JSON.parse(board.snapshot),
      version: board.version
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to fetch board" }), { status: 500 });
  }
}

export async function onRequestPost(context: any) {
  const { env, request } = context;
  try {
    // 1. セッション（Cookie）からユーザー特定
    const cookieHeader = request.headers.get("Cookie") || "";
    const match = cookieHeader.match(/session_id=([^;]+)/);
    const sessionId = match ? match[1] : null;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const sessionData: any = await env.DB.prepare(`
      SELECT users.id, users.username FROM sessions 
      JOIN users ON sessions.user_id = users.id 
      WHERE sessions.id = ? AND sessions.expires_at > ?
    `).bind(sessionId, Date.now()).first();

    if (!sessionData) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // 2. 荒らし防止用のIPアドレスをヘッダーから自動取得
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const snapshot = await request.json();
    const now = Date.now();

    // 3. ボードの全体スナップショットを更新
    const result = await env.DB.prepare(
      "UPDATE board SET snapshot = ?, version = version + 1 WHERE id = 1 RETURNING version"
    ).bind(JSON.stringify(snapshot)).first();

    const nextVersion = result ? (result as any).version : 1;

    // 4. 🧠 tldrawのスナップショットを解析して、新規オブジェクト/ファイルをIPと紐づける
    const statements: any[] = [];
    
    // スナップショットがオブジェクト形式であることを確認
    if (snapshot && typeof snapshot === 'object') {
      for (const [key, item] of Object.entries(snapshot) as [string, any]) {
        
        // 🎨 描画オブジェクト（パス、四角、文字など）の解析
        if (key.startsWith('shape:')) {
          statements.push(
            env.DB.prepare(`
              INSERT OR IGNORE INTO shape_logs (shape_id, user_id, username, ip_address, created_at)
              VALUES (?, ?, ?, ?, ?)
            `).bind(item.id, sessionData.id, sessionData.username, clientIP, now)
          );
        }
        
        // 🖼️ アップロードされたファイル（画像、動画アセット）の解析
        if (key.startsWith('asset:')) {
          const srcUrl = item.props?.src || 'unknown';
          statements.push(
            env.DB.prepare(`
              INSERT OR IGNORE INTO asset_logs (asset_id, user_id, username, ip_address, src_url, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(item.id, sessionData.id, sessionData.username, clientIP, srcUrl, now)
          );
        }
      }
    }

    // 新規ログがあれば一括でデータベースに保存
    if (statements.length > 0) {
      await env.DB.batch(statements);
    }

    return new Response(JSON.stringify({ success: true, version: nextVersion }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Failed to save board", details: error.message }), { status: 500 });
  }
}