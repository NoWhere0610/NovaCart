import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section>
        <div>
          <p>test push code</p>
        </div>
        <button
          type="button"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>
    </>
  )
}

export default App
