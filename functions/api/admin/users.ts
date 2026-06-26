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
  if (!(await checkAdmin(request, env))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    // 🛡️ last_login_ip も一緒に抽出するようにクエリを拡張
    const { results } = await env.DB.prepare("SELECT id, username, is_admin, last_login_ip, created_at FROM users ORDER BY created_at DESC").all();
    return new Response(JSON.stringify({ users: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to fetch users" }), { status: 500 });
  }
}

export async function onRequestDelete(context: any) {
  const { env, request } = context;
  if (!(await checkAdmin(request, env))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "ユーザーIDが指定されていません。" }), { status: 400 });
    }

    const targetUser: any = await env.DB.prepare("SELECT is_admin FROM users WHERE id = ?").bind(userId).first();
    if (targetUser && targetUser.is_admin === 1) {
      return new Response(JSON.stringify({ error: "管理者を削除することはできません。" }), { status: 400 });
    }

    await env.DB.batch([
      env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId)
    ]);

    return new Response(JSON.stringify({ success: true, message: "User deleted" }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to delete user" }), { status: 500 });
  }
}