import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        Day1 Auth
      </Link>

      <div className="nav-links">
        {isAuthenticated ? (
          <>
            <span className="nav-user">Hi, {user?.name}</span>
            <NotificationBell />
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/contacts">Contacts</Link>
            <button type="button" className="btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register" className="btn-primary">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
