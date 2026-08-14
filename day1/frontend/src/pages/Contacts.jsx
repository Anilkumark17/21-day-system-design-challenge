import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  createContact,
  deleteContact,
  getContacts,
  updateContact,
} from "../api/contacts.api";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
};

const Contacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadContacts = async () => {
    try {
      setError("");
      const { data } = await getContacts();
      setContacts(data.contacts);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (editingId) {
        await updateContact(editingId, form);
      } else {
        await createContact(form);
      }

      resetForm();
      await loadContacts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save contact");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenContact = (id) => {
    navigate(`/contacts/${id}`);
  };

  const handleEdit = (event, contact) => {
    event.stopPropagation();
    setEditingId(contact.id);
    setForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || "",
    });
  };

  const handleDelete = async (event, id) => {
    event.stopPropagation();
    if (!window.confirm("Delete this contact?")) {
      return;
    }

    try {
      setError("");
      await deleteContact(id);

      if (editingId === id) {
        resetForm();
      }

      await loadContacts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete contact");
    }
  };

  if (loading) {
    return (
      <section className="page">
        <p className="muted">Loading contacts...</p>
      </section>
    );
  }

  return (
    <section className="page contacts-page">
      <h1>Contacts</h1>
      <p className="muted">Create, edit, and delete your contacts.</p>

      <div className="contacts-layout">
        <article className="auth-card contact-form-card">
          <h2>{editingId ? "Edit Contact" : "Add Contact"}</h2>

          <form className="auth-form" onSubmit={handleSubmit}>
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
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : editingId
                    ? "Update Contact"
                    : "Create Contact"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </article>

        <article className="contacts-list-card">
          <h2>Your Contacts ({contacts.length})</h2>

          {contacts.length === 0 ? (
            <p className="muted">No contacts yet. Add your first contact.</p>
          ) : (
            <ul className="contacts-list">
              {contacts.map((contact) => (
                <li
                  key={contact.id}
                  className="contact-item contact-item-clickable"
                  onClick={() => handleOpenContact(contact.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      handleOpenContact(contact.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="contact-summary">
                    <h3>{contact.name}</h3>
                    <p>{contact.email}</p>
                    {contact.phone && <p>{contact.phone}</p>}
                  </div>

                  <div className="contact-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={(event) => handleEdit(event, contact)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={(event) => handleDelete(event, contact.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
};

export default Contacts;
