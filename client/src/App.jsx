import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { RefreshProvider } from './refresh.jsx';
import { pageview } from './analytics.js';
import Login from './components/Login.jsx';
import Landing from './pages/Landing.jsx';
import Shell from './components/Shell.jsx';
import Drive from './pages/Drive.jsx';
import Browse from './pages/Browse.jsx';
import Magazines from './pages/Magazines.jsx';
import MagazineEditor from './pages/MagazineEditor.jsx';
import Billing from './pages/Billing.jsx';
import Legal from './pages/Legal.jsx';
import Contact from './pages/Contact.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import GoogleCallback from './pages/GoogleCallback.jsx';
import CookieConsent from './components/CookieConsent.jsx';

// Fires a consented pageview on every route change.
function RouteAnalytics() {
  const loc = useLocation();
  useEffect(() => { pageview(loc.pathname); }, [loc.pathname]);
  return null;
}

// Authenticated app surface (sidebar + nav).
function AppShell() {
  return (
    <RefreshProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Drive />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/magazines" element={<Magazines />} />
          <Route path="/magazines/:id" element={<MagazineEditor />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </RefreshProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="auth-wrap"><span className="spinner" /></div>;
  }

  return (
    <>
      <RouteAnalytics />
      <Routes>
        {/* Public routes — reachable whether or not signed in. */}
        <Route path="/privacy" element={<Legal kind="privacy" />} />
        <Route path="/terms" element={<Legal kind="terms" />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<GoogleCallback />} />

        {/* Everything else: the app when authed; a landing page + login wall otherwise. */}
        {user ? (
          <Route path="/*" element={<AppShell />} />
        ) : (
          <>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
      <CookieConsent />
    </>
  );
}
