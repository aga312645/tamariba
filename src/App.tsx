// src/App.tsx
import { Tldraw, createTLStore, defaultShapeUtils, getSnapshot, loadSnapshot } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import './App.css'
import { useEffect, useState, useRef } from 'react'

function App() {
  const [store] = useState(() => createTLStore({ shapeUtils: defaultShapeUtils }))
  const [loading, setLoading] = useState(true)
  
  // サーバー上の最新バージョンを追跡する（お互いの上書き衝突を防ぐ命綱）
  const versionRef = useRef<number>(0)

  // 🔄 サーバーから最新のホワイトボードを取得する共通関数
  const fetchLatestBoard = async () => {
    try {
      const res = await fetch('/api/board')
      if (!res.ok) return
      
      const data = await res.json() // { snapshot: {...}, version: X }
      
      // サーバーのデータが、自分の持っている手元のバージョンより新しい場合のみ画面を更新
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

  // 2. 【読み込みリアルタイム化】3秒ごとにサーバーの最新版をチェックしにいく
  useEffect(() => {
    if (loading) return

    const pollInterval = setInterval(() => {
      fetchLatestBoard()
    }, 3000) // 3秒間隔で他人の更新を自動検知

    return () => clearInterval(pollInterval)
  }, [store, loading])

  // 3. 定期自動保存（5秒ごとに現在のスナップショットを送信）
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
        // 保存成功時、サーバー側で新しくなった最新バージョンを手元に反映
        // これにより、直後の自動読み込みで自分の絵が一瞬消える現象（レースコンディション）を防ぎます
        if (data && data.version) {
          versionRef.current = data.version
        }
      })
      .catch(err => console.error("保存エラー:", err))
    }, 5000) 

    return () => clearInterval(saveInterval)
  }, [store, loading])

  // 読み込み中の画面
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>読み込み中...</div>
  }

  return (
    <div className="tldraw-container" style={{ position: 'fixed', inset: 0 }}>
      <Tldraw store={store} />
    </div>
  )
}

export default App