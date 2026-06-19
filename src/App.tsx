import { Tldraw, createTLStore, defaultShapeUtils, getSnapshot, loadSnapshot } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import './App.css'
import { useEffect, useState } from 'react'

function App() {
  const [store] = useState(() => createTLStore({ shapeUtils: defaultShapeUtils }))
  const [loading, setLoading] = useState(true)

  // 1. 初回読み込み（APIからD1のデータを取得）
  useEffect(() => {
    fetch('/api/board')
      .then((res) => res.json())
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          // 最新版では外部関数の loadSnapshot(store, data) を使います
          loadSnapshot(store, data) 
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error("読み込みエラー:", err)
        setLoading(false)
      })
  }, [store])

  // 2. 自動保存（5秒ごとにAPIへD1への保存リクエストを送る）
  useEffect(() => {
    if (loading) return;

    const intervalId = setInterval(() => {
      // 最新版では外部関数の getSnapshot(store) を使います
      const snapshot = getSnapshot(store) 
      fetch('/api/board', {
        method: 'POST',
        body: JSON.stringify(snapshot),
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.error("保存エラー:", err))
    }, 5000); 

    return () => clearInterval(intervalId);
  }, [store, loading])

  // 読み込み中の画面
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>読み込み中...</div>
  }

  return (
    <div className="tldraw-container">
      <Tldraw store={store} licenseKey="non-commercial" />
    </div>
  )
}

export default App