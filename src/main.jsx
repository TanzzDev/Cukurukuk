import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/unbounded/index.css';
import '@fontsource-variable/figtree/index.css';
import './index.css';
import './styles/drowify.css';
import App from './App.jsx';
import { NavProvider } from './context/NavContext.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { PlayerProvider } from './context/PlayerContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NavProvider>
      <AppProvider>
        <PlayerProvider>
          <App />
        </PlayerProvider>
      </AppProvider>
    </NavProvider>
  </React.StrictMode>,
);
