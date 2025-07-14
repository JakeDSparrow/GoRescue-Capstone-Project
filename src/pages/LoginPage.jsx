import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import '../pages/style/LoginPage.css';
import '../index.css'
import Logo from "../assets/GoRescueLogo.webp";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      if (!email || !password) throw new Error("Please enter both email and password.");

      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const userDocRef = doc(db, "mdrrmo-users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error("Account not authorized. Contact admin.");
      }

      const role = userDoc.data()?.role?.toLowerCase();

      if (role === "admin") {
        navigate("/admin");
      } else if (role === "dispatcher") {
        navigate("/dispatcher");
      } else {
        await signOut(auth);
        throw new Error("Your account does not have access to this portal.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-main">
        <div className="login-logo-section">
          <img src={Logo} alt="GoRescue Logo" className="login-logo" />
        </div>
        <div className="login-form-section">
          <h1 className="login-title">GoRescue Login</h1>
          <div className="login-form">
            <div className="login-input-group">
              <input
                type="email"
                className="login-input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="login-input-group">
              <input
                type="password"
                className="login-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="login-remember">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor="remember">Remember me</label>
            </div>
            <button className="login-button" onClick={handleLogin} disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
            {error && <div className="login-error">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
