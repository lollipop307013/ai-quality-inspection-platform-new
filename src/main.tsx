import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import 'tdesign-react/es/style/index.css';
import './design-tokens/tdesign-theme.css';
import App from './App';
import './global.less';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <App />
    </HashRouter>
  </React.StrictMode>,
);
