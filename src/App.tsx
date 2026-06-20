import { Tldraw, createTLStore, defaultShapeUtils, getSnapshot, loadSnapshot } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import './App.css'
import { useEffect, useState, useRef } from 'react'

// 👇 Cloudinaryの設定（取得したものに書き換えてください）
const CLOUD_NAME = "degwriafh" // 例: "dxxxxxxxx"
const UPLOAD_PRESET = "tamariba" // 例: "tamariba_preset"

function App() {
  const [store] = useState(() => createTLStore({ shapeUtils: defaultShapeUtils }))
  const [loading, setLoading] = useState(true)
  
  // サーバー上の最新バージョンを追跡する命綱
  const versionRef = useRef<number>(0)

  // 🔄 サーバーから最新のホワイトボードを取得する共通関数
  const fetchLatestBoard = async () => {
    try {
      const res = await fetch('/api/board')
      if (!res.ok) return
      
      const data = await res.json()
      
      // サーバーのデータが手元より新しい場合のみ画面を更新
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

  // 2. 【リアルタイム自動読み込み】3秒ごとに他人の更新をチェック
  useEffect(() => {
    if (loading) return

    const pollInterval = setInterval(() => {
      fetchLatestBoard()
    }, 3000) 

    return () => clearInterval(pollInterval)
  }, [store, loading])

  // 3. 定期自動保存（5秒ごとに自分の更新を送信）
  useEffect(() => {
    if (loading) return

    const saveInterval = setInterval(() => {
      const snapshot = getSnapshot(store) 
      
      fetch('/api/board', {
        method: 'POST',
        body: JSON.stringify(snapshot),
        headers: { 'Content-Type': 'application/json' }
      })
      .then((res) => {
        if (res.ok) return res.json()
      })
      .then((data) => {
        if (data && data.version) {
          versionRef.current = data.version
        }
      })
      .catch(err => console.error("保存エラー:", err))
    }, 5000) 

    return () => clearInterval(saveInterval)
  }, [store, loading])

  // 🎨 4. 【新規追加】画像・動画がドロップされたときのCloudinaryアップロード処理
  const handleAssetUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', UPLOAD_PRESET)

    try {
      // CloudinaryのAPIへ直接送信
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'Upload failed')

      // Cloudinaryから返ってきた公開URLをtldrawに渡す
      return data.secure_url
    } catch (error) {
      console.error('メディアのアップロードに失敗しました:', error)
      throw error
    }
  }

  // 読み込み中の画面
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>読み込み中...</div>
  }

  return (
    <div className="tldraw-container" style={{ position: 'fixed', inset: 0 }}>
      {/* 👇 onAssetUpload を追加して画像・動画の貼り付けを有効化！ */}
      <Tldraw store={store} onAssetUpload={handleAssetUpload} />
    </div>
  )
}

export default App