import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <h1>たまりばへようこそ</h1>
        <h6>現在作成中です</h6>
        <a href="https://github.com/aga312645/tamariba/tree/React">Githubページ</a>
      </div>
    </>
  )
}

export default App
