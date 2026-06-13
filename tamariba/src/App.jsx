import { useState } from 'react'
import React from 'react'
import { BrowserRouter as Router, useRoutes, Link } from 'react-router-dom'
import './App.css'

// 💡 プラグインを使わず、Vite標準機能で pages フォルダ内のファイルを自動で読み込む
const pages = import.meta.glob('./pages/*.jsx', { eager: true })
const routes = Object.keys(pages).map((path) => {
  const name = path.match(/\.\/pages\/(.*)\.jsx$/)[1]
  return {
    path: name === 'index' ? '/' : `/${name.toLowerCase()}`,
    element: React.createElement(pages[path].default),
  }
})

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