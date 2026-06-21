export async function onRequestDelete(context: any) {
  const { env, request } = context;
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const match = cookieHeader.match(/session_id=([^;]+)/);
    const sessionId = match ? match[1] : null;

    if (!sessionId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const sessionData: any = await env.DB.prepare(`
      SELECT users.is_admin FROM sessions 
      JOIN users ON sessions.user_id = users.id 
      WHERE sessions.id = ? AND sessions.expires_at > ?
    `).bind(sessionId, Date.now()).first();

    if (!sessionData || sessionData.is_admin !== 1) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // 👑 空のデータを保存してボードを更地にする
    await env.DB.prepare("UPDATE board SET snapshot = ?, version = version + 1 WHERE id = 1").bind(JSON.stringify({})).run();

    return new Response(JSON.stringify({ success: true, message: "Clear" }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Server Error" }), { status: 500 });
  }
}