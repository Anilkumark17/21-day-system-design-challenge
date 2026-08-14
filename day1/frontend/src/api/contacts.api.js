import api from "./axios";

export const getContacts = () => api.get("/api/contacts");

export const getContactById = (id) => api.get(`/api/contacts/${id}`);

export const createContact = (data) => api.post("/api/contacts", data);

export const updateContact = (id, data) => api.put(`/api/contacts/${id}`, data);

export const deleteContact = (id) => api.delete(`/api/contacts/${id}`);
