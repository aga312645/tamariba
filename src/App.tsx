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

// 👇 ここにCloudinaryの設定を入れます
const CLOUD_NAME = "degwriafh" // 例: "dxxxxxxxx"
const UPLOAD_PRESET = "tamariba" // 例: "tamariba_preset"

function App() {
  const [store] = useState(() => createTLStore({ shapeUtils: defaultShapeUtils }))
  const [loading, setLoading] = useState(true)
  const versionRef = useRef<number>(0)

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
    if (loading) return
    const saveInterval = setInterval(() => {
      const snapshot = getSnapshot(store) 
      
      fetch('/api/board', {
        method: 'POST',
        body: JSON.stringify(snapshot),
        headers: { 'Content-Type': 'application/json' }
      })
      .then((res) => { if (res.ok) return res.json() })
      .then((data) => { if (data && data.version) versionRef.current = data.version })
      .catch(err => console.error("保存エラー:", err))
    }, 5000) 
    return () => clearInterval(saveInterval)
  }, [store, loading])

  // 🎨 4. 【厳密な型修正版】画像・動画アップロード処理
  const handleMount = (editor: Editor) => {
    // 'file' ソースのハンドラーとして登録
    editor.registerExternalAssetHandler('file', async ({ file }) => {
      // 画像か動画のファイル以外はスキップ
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', UPLOAD_PRESET)

      try {
        // Cloudinaryへ送信
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error?.message || 'Upload failed')

        // 画像のサイズ（幅・高さ）を仮決定または取得
        let width = 400
        let height = 300

        if (file.type.startsWith('image/')) {
          const img = new Image()
          img.src = URL.createObjectURL(file)
          await new Promise((resolve) => { img.onload = resolve })
          width = img.width
          height = img.height
        }

        // tldrawに返すアセットオブジェクトの構築
        return {
          id: AssetRecordType.createId(),
          type: 'image',
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
        }
      } catch (error) {
        console.error('メディアのアップロードに失敗しました:', error)
        throw error
      }
    })
  }

  // 読み込み中の画面
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>読み込み中...</div>
  }

  return (
    <div className="tldraw-container" style={{ position: 'fixed', inset: 0 }}>
      <Tldraw store={store} onMount={handleMount} />
    </div>
  )
}

export default App