/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
*/
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Tailwind, the self-hosted fonts and the app's base styles. This used to be
// three <script>/<link> tags pointing at third-party CDNs in index.html; it is
// now compiled into the bundle so the UI and the OBS overlay render with no
// network access beyond this server.
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
