import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteContact,
  getContactById,
  updateContact,
} from "../api/contacts.api";

import Message from "../components/Message";
const ContactDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

 
  useEffect(() => {
    const loadContact = async () => {
      try {
        setError("");
        const { data } = await getContactById(id);
        setContact(data.contact);
        setForm({
          name: data.contact.name,
          email: data.contact.email,
          phone: data.contact.phone || "",
        });
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load contact");
      } finally {
        setLoading(false);
      }
    };

    loadContact();
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const { data } = await updateContact(id, form);
      setContact(data.contact);
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update contact");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this contact?")) {
      return;
    }

    try {
      await deleteContact(id);
      navigate("/contacts");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete contact");
    }
  };

  if (loading) {
    return (
      <section className="page">
        <p className="muted">Loading contact...</p>
      </section>
    );
  }

  if (!contact && error) {
    return (
      <section className="page">
        <p className="error">{error}</p>
        <Link to="/contacts" className="btn-secondary">
          Back to Contacts
        </Link>
      </section>
    );
  }

  return (
    <section className="page contact-detail-page">
      <Link to="/contacts" className="back-link">
        ← Back to Contacts
      </Link>

      <div className="contact-detail-card">
        {!isEditing ? (
          <>
            <h1>{contact.name}</h1>
            <p>
              <strong>Email:</strong> {contact.email}
            </p>
            {contact.phone && (
              <p>
                <strong>Phone:</strong> {contact.phone}
              </p>
            )}
            <p className="muted">
              Created: {new Date(contact.createdAt).toLocaleString()}
            </p>

            <div className="form-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </>
        ) : (
          <>
            <h1>Edit Contact</h1>
            <form className="auth-form" onSubmit={handleUpdate}>
              <label>
                Name
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Phone
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Optional"
                />
              </label>

              {error && <p className="error">{error}</p>}

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setForm({
                      name: contact.name,
                      email: contact.email,
                      phone: contact.phone || "",
                    });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <Message
        receiverEmail={contact.email}
        contactId={contact.id}
        contactName={contact.name}
      />
    </section>
  );
};

export default ContactDetail;
