async function checkAdmin(request: any, env: any): Promise<boolean> {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session_id=([^;]+)/);
  const sessionId = match ? match[1] : null;
  if (!sessionId) return false;

  const sessionData: any = await env.DB.prepare(`
    SELECT users.is_admin FROM sessions 
    JOIN users ON sessions.user_id = users.id 
    WHERE sessions.id = ? AND sessions.expires_at > ?
  `).bind(sessionId, Date.now()).first();

  return sessionData && sessionData.is_admin === 1;
}

export async function onRequestGet(context: any) {
  const { env, request } = context;
  
  // 👑 管理者以外はアクセス拒否
  if (!(await checkAdmin(request, env))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    // 直近100件の描画オブジェクトのIPログを取得
    const shapes = await env.DB.prepare(
      "SELECT shape_id, username, ip_address, created_at FROM shape_logs ORDER BY created_at DESC LIMIT 100"
    ).all();

    // 直近100件のファイル（メディア）のIPログを取得
    const assets = await env.DB.prepare(
      "SELECT asset_id, username, ip_address, src_url, created_at FROM asset_logs ORDER BY created_at DESC LIMIT 100"
    ).all();

    return new Response(JSON.stringify({
      recentShapes: shapes.results,
      recentAssets: assets.results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Failed to fetch logs", details: error.message }), { status: 500 });
  }
}