import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import DispatcherPage from "./pages/DispatcherPage"; 
import TeamStatusView from "./pages/DispatcherViews/TeamStatusView"; // <-- new view
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dispatcher"
            element={
              <ProtectedRoute allowedRoles={["dispatcher"]}>
                <DispatcherPage />
              </ProtectedRoute>
            }
          />
          {/* New Team Status route */}
          <Route
            path="/dispatcher/team-status"
            element={
              <ProtectedRoute allowedRoles={["dispatcher"]}>
                <TeamStatusView />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
