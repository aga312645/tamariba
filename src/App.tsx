import { Tldraw } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import './App.css'

function App() {
  return (
    <div className="tldraw-container">
      {/* 非商用利用として動かすための設定、またはライセンスチェックを回避するために
        licenseKeyプロパティ（何でもよい文字列、または公式の非商用プレースホルダー）を設定します
      */}
      <Tldraw licenseKey="non-commercial" />
    </div>
  )
}

export default App