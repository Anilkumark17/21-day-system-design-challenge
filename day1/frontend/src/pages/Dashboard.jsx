import { useEffect, useState } from "react";
import { getDashboard, getProfile } from "../api/auth.api";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProtectedData = async () => {
      try {
        const [profileResponse, dashboardResponse] = await Promise.all([
          getProfile(),
          getDashboard(),
        ]);

        setProfile(profileResponse.data.user);
        setDashboard(dashboardResponse.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load protected data");
      } finally {
        setLoading(false);
      }
    };

    loadProtectedData();
  }, []);

  if (loading) {
    return (
      <section className="page">
        <p className="muted">Loading protected dashboard...</p>
      </section>
    );
  }

  return (
    <section className="page dashboard-page">
      <h1>Protected Dashboard</h1>
      <p className="muted">
        You reached this page because your JWT was verified on both the frontend
        route guard and backend middleware.
      </p>

      {error ? (
        <p className="error">{error}</p>
      ) : (
        <div className="dashboard-grid">
          <article className="dashboard-card">
            <h2>Profile (`/auth/me`)</h2>
            <p>
              <strong>Name:</strong> {profile?.name || user?.name}
            </p>
            <p>
              <strong>Email:</strong> {profile?.email || user?.email}
            </p>
            <p>
              <strong>User ID:</strong> {profile?.id || user?.id}
            </p>
          </article>

          <article className="dashboard-card">
            <h2>Protected API (`/api/dashboard`)</h2>
            <p>{dashboard?.message}</p>
            <p>
              <strong>Authorized email:</strong> {dashboard?.user?.email}
            </p>
          </article>
        </div>
      )}
    </section>
  );
};

export default Dashboard;
