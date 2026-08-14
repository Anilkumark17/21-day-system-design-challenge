import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <section className="page">
      <h1>Authentication Demo</h1>
      <p className="muted">
        Register, log in with JWT, and access protected routes backed by Express +
        Neon + Drizzle.
      </p>

      {isAuthenticated ? (
        <Link to="/contacts" className="btn-primary">
          Manage Contacts
        </Link>
      ) : (
        <div className="actions">
          <Link to="/login" className="btn-secondary">
            Login
          </Link>
          <Link to="/register" className="btn-primary">
            Create Account
          </Link>
        </div>
      )}
    </section>
  );
};

export default Home;
