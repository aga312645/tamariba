import { 
  Tldraw, 
  createTLStore, 
  defaultShapeUtils, 
  getSnapshot, 
  loadSnapshot,
  Editor,
  AssetRecordType
} from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import './App.css'
import { useEffect, useState, useRef } from 'react'

const CLOUD_NAME = "degwriafh"
const UPLOAD_PRESET = "tamariba"

// 管理者用ユーザー型の定義
interface AdminUser {
  id: string;
  username: string;
  is_admin: number;
  created_at: number;
}

// 🛡️ ログデータの型定義（新規）
interface ShapeLog {
  shape_id: string;
  username: string;
  ip_address: string;
  created_at: number;
}

interface AssetLog {
  asset_id: string;
  username: string;
  ip_address: string;
  src_url: string;
  created_at: number;
}

function App() {
  const [store] = useState(() => createTLStore({ shapeUtils: defaultShapeUtils }))
  const [loading, setLoading] = useState(true)
  const versionRef = useRef<number>(0)

  // 🔑 認証用の状態管理
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  // 🛡️ パスワード変更用の状態管理
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')

  // 👑 管理者用（ユーザー管理）の状態管理
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [adminMessage, setAdminMessage] = useState('')

  // 🛡️ IPログ用の状態管理（新規）
  const [shapeLogs, setShapeLogs] = useState<ShapeLog[]>([])
  const [assetLogs, setAssetLogs] = useState<AssetLog[]>([])
  const [showMiniLogs, setShowMiniLogs] = useState(false)
  const [showFullLogs, setShowFullLogs] = useState(false)
  const [logsMessage, setLogsMessage] = useState('')

  // 🎨 UI開閉用の状態管理
  const [showAuthPanel, setShowAuthPanel] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  // 🔄 サーバーから最新のホワイトボードを取得
  const fetchLatestBoard = async () => {
    try {
      const res = await fetch('/api/board')
      if (!res.ok) return
      
      const data = await res.json()
      if (data.version > versionRef.current) {
        versionRef.current = data.version
        if (data.snapshot && Object.keys(data.snapshot).length > 0) {
          loadSnapshot(store, data.snapshot)
        }
      }
    } catch (err) {
      console.error("データ取得エラー:", err)
    }
  }

  useEffect(() => {
    fetchLatestBoard().then(() => setLoading(false))
  }, [store])

  useEffect(() => {
    if (loading) return
    const pollInterval = setInterval(() => { fetchLatestBoard() }, 3000) 
    return () => clearInterval(pollInterval)
  }, [store, loading])

  // 定期自動保存（5秒ごと）
  useEffect(() => {
    if (loading || !isLoggedIn) return
    const saveInterval = setInterval(() => {
      const snapshot = getSnapshot(store) 
      fetch('/api/board', {
        method: 'POST',
        body: JSON.stringify(snapshot),
        headers: { 'Content-Type': 'application/json' }
      })
      .then(async (res) => { 
        if (res.status === 401) {
          setIsLoggedIn(false)
          setIsAdmin(false)
          return null
        }
        if (res.ok) return res.json() 
      })
      .then((data) => { if (data && data.version) versionRef.current = data.version })
      .catch(err => console.error("保存エラー:", err))
    }, 5000) 
    return () => clearInterval(saveInterval)
  }, [store, loading, isLoggedIn])

  // 画像・動画アップロード処理
  const handleMount = (editor: Editor) => {
    editor.registerExternalAssetHandler('file', async ({ file }) => {
      if (!isLoggedIn) {
        alert("画像や動画をアップロードするにはログインが必要です！")
        throw new Error('未ログイン状態でのアップロード')
      }
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        throw new Error('サポートされていないファイル形式です')
      }
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', UPLOAD_PRESET)

      try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
          method: 'POST',
          body: formData,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error?.message || 'Upload failed')

        let width = 400
        let height = 300
        if (file.type.startsWith('image/')) {
          const img = new Image()
          img.src = URL.createObjectURL(file)
          await new Promise((resolve) => { img.onload = resolve })
          width = img.width
          height = img.height
        }
        const isVideo = file.type.startsWith('video/')
        return {
          id: AssetRecordType.createId(),
          type: isVideo ? 'video' : 'image',
          typeName: 'asset',
          props: {
            name: file.name,
            src: data.secure_url,
            w: width,
            h: height,
            mimeType: file.type,
            isAnimated: file.type === 'image/gif',
          },
          meta: {}
        } as any 
      } catch (error) {
        console.error('メディアのアップロードに失敗しました:', error)
        throw error
      }
    })
  }

  // 🔑 登録・ログイン処理
  const handleAuth = async (action: 'login' | 'register') => {
    setAuthMessage("通信中...")
    try {
      const res = await fetch(`/api/auth/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      })
      const data = await res.json()
      if (res.ok) {
        setAuthMessage(data.message)
        setIsLoggedIn(true)
        if (data.isAdmin) {
          setIsAdmin(true)
        }
      } else {
        setAuthMessage(data.error)
      }
    } catch (err) {
      setAuthMessage("エラーが発生しました")
    }
  }

  // 🛡️ パスワード変更処理
  const handleChangePassword = async () => {
    setPasswordMsg("通信中...")
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
      })
      const data = await res.json()
      if (res.ok) {
        setPasswordMsg("✅ パスワードを変更しました")
        setOldPassword('')
        setNewPassword('')
        setTimeout(() => {
          setShowPasswordChange(false)
          setPasswordMsg('')
        }, 2000)
      } else {
        setPasswordMsg(`❌ ${data.error}`)
      }
    } catch (err) {
      setPasswordMsg("❌ エラーが発生しました")
    }
  }

  // 👑 管理者用：ユーザー一覧の取得
  const fetchUsersForAdmin = async () => {
    setAdminMessage("ユーザー取得中...")
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setAdminUsers(data.users || [])
        setAdminMessage('')
      } else {
        setAdminMessage("ユーザー一覧の取得に失敗しました。")
      }
    } catch (err) {
      setAdminMessage("エラーが発生しました。")
    }
  }

  // 👑 管理者用：IPログの取得（新規）
  const fetchLogsForAdmin = async () => {
    setLogsMessage("ログ取得中...")
    try {
      const res = await fetch('/api/admin/logs')
      if (res.ok) {
        const data = await res.json()
        setShapeLogs(data.recentShapes || [])
        setAssetLogs(data.recentAssets || [])
        setLogsMessage('')
      } else {
        setLogsMessage("ログの取得に失敗しました。")
      }
    } catch (err) {
      setLogsMessage("エラーが発生しました。")
    }
  }

  // 👑 管理者用：ユーザーの削除
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`本当にユーザー「${username}」を削除しますか？`)) return
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        alert("ユーザーを削除しました。")
        fetchUsersForAdmin() 
      } else {
        alert(`削除失敗: ${data.error}`)
      }
    } catch (err) {
      alert("エラーが発生しました。")
    }
  }

  // 👑 管理者用：ボードの初期化
  const handleClearBoard = async () => {
    if (!window.confirm("本当にホワイトボードのデータをすべて消去しますか？")) return
    try {
      const res = await fetch('/api/admin/board', { method: 'DELETE' })
      if (res.ok) {
        alert("ホワイトボードを初期化しました。画面をリロードします。")
        window.location.reload()
      } else {
        alert("権限がないか、エラーが発生しました。")
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (showAdminPanel && isAdmin) {
      fetchUsersForAdmin()
    }
  }, [showAdminPanel, isAdmin])

  // ミニログや全画面ログを開くときのフック
  useEffect(() => {
    if ((showMiniLogs || showFullLogs) && isAdmin) {
      fetchLogsForAdmin()
    }
  }, [showMiniLogs, showFullLogs, isAdmin])

  // ユーティリティ：日付フォーマット
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ja-JP', { 
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' 
    })
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>読み込み中...</div>
  }

  return (
    <div className="tldraw-container" style={{ position: 'fixed', inset: 0 }}>
      <Tldraw store={store} onMount={handleMount} />
      
      {/* 📄 👑 全画面ログビュー (モーダル) */}
      {showFullLogs && isAdmin && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 100000, background: 'rgba(255,255,255,0.95)', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: 10, marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>🛡️ 詳細IPログ (全画面)</h2>
              <div>
                <button onClick={() => fetchLogsForAdmin()} style={{ padding: '8px 16px', marginRight: 10, cursor: 'pointer' }}>更新</button>
                <button onClick={() => setShowFullLogs(false)} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>閉じる</button>
              </div>
            </div>
            {logsMessage && <p>{logsMessage}</p>}
            
            <div style={{ display: 'flex', gap: 20 }}>
              {/* メディアログ (左) */}
              <div style={{ flex: 1 }}>
                <h3>🖼️ メディア (アップロード)</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'left' }}>日時</th>
                      <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'left' }}>ユーザー (IP)</th>
                      <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'left' }}>ファイルURL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetLogs.map((log, i) => (
                      <tr key={i}>
                        <td style={{ padding: 8, border: '1px solid #ddd' }}>{formatDate(log.created_at)}</td>
                        <td style={{ padding: 8, border: '1px solid #ddd' }}><b>{log.username}</b><br/><span style={{ color: 'gray', fontSize: 11 }}>{log.ip_address}</span></td>
                        <td style={{ padding: 8, border: '1px solid #ddd', wordBreak: 'break-all' }}>
                          <a href={log.src_url} target="_blank" rel="noreferrer" style={{ color: '#007bff' }}>確認する</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 描画オブジェクトログ (右) */}
              <div style={{ flex: 1 }}>
                <h3>🎨 描画オブジェクト</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'left' }}>日時</th>
                      <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'left' }}>ユーザー (IP)</th>
                      <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'left' }}>Shape ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shapeLogs.map((log, i) => (
                      <tr key={i}>
                        <td style={{ padding: 8, border: '1px solid #ddd' }}>{formatDate(log.created_at)}</td>
                        <td style={{ padding: 8, border: '1px solid #ddd' }}><b>{log.username}</b><br/><span style={{ color: 'gray', fontSize: 11 }}>{log.ip_address}</span></td>
                        <td style={{ padding: 8, border: '1px solid #ddd', wordBreak: 'break-all', fontSize: 11, fontFamily: 'monospace' }}>{log.shape_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 右下のフローティングエリア */}
      <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 9999, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        
        {/* 👑 ミニログパネル (横に展開) */}
        {showMiniLogs && isAdmin && !showFullLogs && (
          <div style={{ background: '#e2e3e5', padding: 15, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', width: 320, maxHeight: 400, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: '#383d41' }}>🔍 IPログ (直近)</h3>
              <button onClick={() => setShowMiniLogs(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
            {logsMessage && <div style={{ fontSize: 12 }}>{logsMessage}</div>}
            
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>🖼️ メディア (直近5件)</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {assetLogs.slice(0, 5).map((log, i) => (
                <li key={i} style={{ background: '#fff', padding: '4px 6px', borderRadius: 4, fontSize: 11, border: '1px solid #ccc' }}>
                  <div style={{ color: 'gray' }}>{formatDate(log.created_at)}</div>
                  <div><b>{log.username}</b> ({log.ip_address})</div>
                  <a href={log.src_url} target="_blank" rel="noreferrer" style={{ color: '#007bff' }}>ファイルを開く</a>
                </li>
              ))}
            </ul>

            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>🎨 描画 (直近5件)</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {shapeLogs.slice(0, 5).map((log, i) => (
                <li key={i} style={{ background: '#fff', padding: '4px 6px', borderRadius: 4, fontSize: 11, border: '1px solid #ccc' }}>
                  <div style={{ color: 'gray' }}>{formatDate(log.created_at)}</div>
                  <div><b>{log.username}</b> ({log.ip_address})</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          
          {/* 👑 管理者設定パネル */}
          {showAdminPanel && isAdmin && (
            <div style={{ background: '#fff3cd', padding: 15, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', width: 320, maxHeight: 400, overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#856404' }}>👑 管理者管理画面</h3>
              
              <div style={{ display: 'flex', gap: 5, marginBottom: 15 }}>
                <button onClick={() => setShowMiniLogs(!showMiniLogs)} style={{ flex: 1, padding: 8, background: '#17a2b8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                  🔍 ログ(小)
                </button>
                <button onClick={() => { setShowFullLogs(true); setShowAdminPanel(false); }} style={{ flex: 1, padding: 8, background: '#007bff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                  📄 ログ(全画面)
                </button>
              </div>

              <button onClick={handleClearBoard} style={{ width: '100%', padding: 8, background: '#dc3545', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', marginBottom: 15, fontWeight: 'bold' }}>
                ボードデータを全消去する
              </button>

              <div style={{ borderTop: '1px solid #ecc', paddingTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 5, color: '#665' }}>アカウント管理</div>
                {adminMessage && <div style={{ fontSize: 12, color: 'gray' }}>{adminMessage}</div>}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {adminUsers.map(u => (
                    <li key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 8px', borderRadius: 4, fontSize: 12, border: '1px solid #edd' }}>
                      <span>
                        {u.username} {u.is_admin === 1 && <b style={{ color: 'orange' }}>[Admin]</b>}
                      </span>
                      {u.is_admin !== 1 && (
                        <button onClick={() => handleDeleteUser(u.id, u.username)} style={{ background: '#ffc107', border: 'none', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 11 }}>
                          削除
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 🔑 ログイン・一般設定パネル */}
          {showAuthPanel && (
            <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', width: 250 }}>
              {isLoggedIn ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ color: 'green', fontWeight: 'bold', textAlign: 'center' }}>✅ ログイン済み</div>
                  
                  {isAdmin && (
                    <button onClick={() => setShowAdminPanel(!showAdminPanel)} style={{ padding: 8, background: '#ffc107', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
                      {showAdminPanel ? '👑 管理画面を閉じる' : '👑 管理画面を開く'}
                    </button>
                  )}

                  {!showPasswordChange ? (
                    <button onClick={() => setShowPasswordChange(true)} style={{ padding: 8, background: '#17a2b8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                      🔒 パスワードを変更する
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: '#f8f9fa', borderRadius: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold' }}>パスワード変更</div>
                      <input type="password" placeholder="現在のパスワード" value={oldPassword} onChange={e => setOldPassword(e.target.value)} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
                      <input type="password" placeholder="新しいパスワード" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
                      <button onClick={handleChangePassword} style={{ padding: 6, background: '#28a745', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>変更を確定</button>
                      <button onClick={() => {setShowPasswordChange(false); setPasswordMsg('');}} style={{ padding: 6, background: '#6c757d', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>キャンセル</button>
                      {passwordMsg && <div style={{ fontSize: 12, textAlign: 'center', marginTop: 4 }}>{passwordMsg}</div>}
                    </div>
                  )}

                  <button onClick={() => { setIsLoggedIn(false); setIsAdmin(false); setShowAuthPanel(false); setShowAdminPanel(false); setShowPasswordChange(false); setShowMiniLogs(false); setShowFullLogs(false); }} style={{ padding: 8, background: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    ログアウト / 閉じる
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'gray', textAlign: 'center' }}>書き込むにはログインが必要です</div>
                  <input type="text" placeholder="ユーザー名" value={authUsername} onChange={e => setAuthUsername(e.target.value)} style={{ padding: 8, border: '1px solid #ccc', borderRadius: 4 }} />
                  <input type="password" placeholder="パスワード" value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ padding: 8, border: '1px solid #ccc', borderRadius: 4 }} />
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => handleAuth('login')} style={{ flex: 1, padding: 8, background: '#007bff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>ログイン</button>
                    <button onClick={() => handleAuth('register')} style={{ flex: 1, padding: 8, background: '#28a745', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>新規登録</button>
                  </div>
                  {authMessage && <div style={{ fontSize: 12, color: 'red', textAlign: 'center' }}>{authMessage}</div>}
                </div>
              )}
            </div>
          )}

          <button 
            onClick={() => setShowAuthPanel(!showAuthPanel)}
            style={{ width: 60, height: 60, borderRadius: '50%', background: isLoggedIn ? '#28a745' : '#007bff', color: 'white', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', cursor: 'pointer', fontSize: 24, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            {isLoggedIn ? '👤' : '🔒'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App