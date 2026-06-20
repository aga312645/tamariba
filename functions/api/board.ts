// functions/api/board.ts

// 保存 (POST)
export async function onRequestPost(context: any) {
  const { env, request } = context;
  try {
    if (!env.DB) throw new Error("D1データベース(env.DB)が見つかりません。");

    const data = await request.json();
    
    // バージョンをカウントアップしながら上書きし、新しいバージョン番号を返す(RETURNING)
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
    // 500エラーが起きても原因がブラウザの検証ツールで読めるように詳細を返す
    return new Response(JSON.stringify({ error: error.message, detail: "保存処理（POST）でエラーが発生しました。" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 取得 (GET)
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

    // snapshot(文字列)をオブジェクトに戻し、versionと一緒に綺麗なJSONで返す
    return new Response(JSON.stringify({
      snapshot: JSON.parse(result.snapshot),
      version: result.version
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, detail: "読み込み処理（GET）でエラーが発生しました。" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}