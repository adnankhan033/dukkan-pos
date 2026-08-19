import "./BrowserNotice.css";
import { useTheme } from "../../hooks/useTheme";

export default function BrowserNotice() {
  useTheme();
  return (
    <div className="browser-notice">
      <div className="browser-notice-card">
        <h1>Nexttel POS</h1>
        <p className="browser-notice-lead">
          This is a <strong>desktop application</strong>. It cannot use the local database when opened in a web browser.
        </p>
        <p>
          The URL <code>http://localhost:1420</code> is the Vite dev server used internally by Tauri.
          Open the app through the desktop window instead.
        </p>
        <div className="browser-notice-steps">
          <h2>How to run</h2>
          <ol>
            <li>Open a terminal in the project folder</li>
            <li>Run: <code>bun run tauri dev</code></li>
            <li>Use the <strong>Nexttel POS</strong> desktop window that opens</li>
          </ol>
        </div>
        <p className="browser-notice-hint">
          For production, install the built app — do not use the browser URL.
        </p>
      </div>
    </div>
  );
}
