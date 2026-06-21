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

function App() {
  const [store] = useState(() => createTLStore({ shapeUtils: defaultShapeUtils }))
  const [loading, setLoading] = useState(true)
  const versionRef = useRef<number>(0)

  // 🔑 認証用の状態管理
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')

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

  // 1. 初回読み込み
  useEffect(() => {
    fetchLatestBoard().then(() => setLoading(false))
  }, [store])

  // 2. リアルタイム自動同期（3秒ごと）
  useEffect(() => {
    if (loading) return
    const pollInterval = setInterval(() => { fetchLatestBoard() }, 3000) 
    return () => clearInterval(pollInterval)
  }, [store, loading])

  // 3. 定期自動保存（5秒ごと）
  useEffect(() => {
    // ⚠️ ログインしていない時はサーバーへの保存をスキップする
    if (loading || !isLoggedIn) return
    
    const saveInterval = setInterval(() => {
      const snapshot = getSnapshot(store) 
      
      fetch('/api/board', {
        method: 'POST',
        body: JSON.stringify(snapshot),
        headers: { 'Content-Type': 'application/json' }
      })
      .then(async (res) => { 
        // サーバーからセッション切れ（401）を宣告されたら未ログイン状態に戻す
        if (res.status === 401) {
          setIsLoggedIn(false)
          return null
        }
        if (res.ok) return res.json() 
      })
      .then((data) => { if (data && data.version) versionRef.current = data.version })
      .catch(err => console.error("保存エラー:", err))
    }, 5000) 
    return () => clearInterval(saveInterval)
  }, [store, loading, isLoggedIn])

  // 🎨 4. 画像・動画アップロード処理
  const handleMount = (editor: Editor) => {
    editor.registerExternalAssetHandler('file', async ({ file }) => {
      // ⚠️ 未ログインでのアップロードをブロック
      if (!isLoggedIn) {
        alert("画像や動画をアップロードするにはログインが必要です！")
        throw new Error('未ログイン状態でのアップロード')
      }

      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        throw new Error('サポートされていないファイル形式です（画像・動画のみ対応）')
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
      } else {
        setAuthMessage(data.error)
      }
    } catch (err) {
      setAuthMessage("エラーが発生しました")
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>読み込み中...</div>
  }

  return (
    <div className="tldraw-container" style={{ position: 'fixed', inset: 0 }}>
      <Tldraw store={store} onMount={handleMount} />
      
      {/* 🔑 右上のログインパネル */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 9999, background: 'white', padding: 15, borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        {isLoggedIn ? (
          <div style={{ color: 'green', fontWeight: 'bold' }}>✅ ログイン済み（書き込み・画像UP可能）</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'gray' }}>閲覧は自由です。書き込むにはログインしてください。</div>
            <input type="text" placeholder="ユーザー名" value={authUsername} onChange={e => setAuthUsername(e.target.value)} style={{ padding: 5 }} />
            <input type="password" placeholder="パスワード" value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ padding: 5 }} />
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => handleAuth('login')} style={{ flex: 1, padding: 5, cursor: 'pointer' }}>ログイン</button>
              <button onClick={() => handleAuth('register')} style={{ flex: 1, padding: 5, cursor: 'pointer' }}>新規登録</button>
            </div>
            {authMessage && <div style={{ fontSize: 12, color: 'red', marginTop: 5 }}>{authMessage}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

export default App