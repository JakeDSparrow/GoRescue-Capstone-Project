import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import DispatcherPage from "./pages/DispatcherPage"; 


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/dispatcher" element={<DispatcherPage />} />
      </Routes>
    </Router>
  );
}

export default App;
