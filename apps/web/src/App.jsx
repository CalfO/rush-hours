import { useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function App() {
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const callBackend = async () => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/`);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      setMessage(await response.text());
    } catch (err) {
      setMessage(null);
      setError(err.message);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <img src="Octocat.png" className="App-logo" alt="logo" />
        <p>
          GitHub Codespaces <span className="heart">♥️</span> React
        </p>
        <p className="small">
          Edit <code>src/App.jsx</code> and save to reload.
        </p>
        <p>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
        </p>
        <button onClick={callBackend}>Call backend</button>
        {message && <p>{message}</p>}
        {error && <p className="error">{error}</p>}
      </header>
    </div>
  );
}

export default App;
