import { useState } from 'react'
import { BrowserRouter as Router, useRoutes, Link } from 'react-router-dom'
import routes from '~pages' // プラグインが自動生成するルート情報
import './App.css'

// ルーティングの処理を行うコンポーネント
function AppRoutes() {
  return useRoutes(routes)
}

function App() {
  return (
    <Router>
      {/* 1. 共通ヘッダー（画面上部のリンクの集まり） */}
      <header className="global-header">
        <div className="header-logo">マイサイト</div>
        <nav className="header-nav">
          <Link to="/" className="nav-item">ホーム</Link>
          <Link to="/about" className="nav-item">アバウト</Link>
          {/* 今後ページを増やしたら、ここに <Link> を追加していけばOKです */}
        </nav>
      </header>

      {/* 2. メインコンテンツエリア（ここが各ページに切り替わる） */}
      <main className="main-content">
        <AppRoutes />
      </main>
    </Router>
  )
}

export default App