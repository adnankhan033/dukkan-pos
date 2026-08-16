import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { userService } from "../services/UserService";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { ITEMS_PER_PAGE } from "../utils/constants";
import { ROLES, ROLE_LABELS } from "../utils/roles";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SearchBar from "../components/common/SearchBar";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import { Input, Select } from "../components/common/Input";
import Badge from "../components/common/Badge";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { required, runFormValidation } from "../utils/validation";
import FormValidationAlert from "../components/common/FormValidationAlert";

const emptyForm = {
  username: "",
  full_name: "",
  phone: "",
  email: "",
  designation: "",
  notes: "",
  password: "",
  role: ROLES.CASHIER,
  is_active: true,
};

const FORM_ID = "user-form";

export default function Users() {
  const { submitting, guard } = useSubmitGuard();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await userService.getAll({ page, limit: ITEMS_PER_PAGE, search });
      setUsers(result.items);
      setTotal(result.total);
    } catch (err) {
      setUsers([]);
      setTotal(0);
      setLoadError(err.message || "Could not load users");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(user) {
    setEditing(user);
    setForm({
      username: user.username,
      full_name: user.full_name || "",
      designation: user.designation || "",
      phone: user.phone || "",
      email: user.email || "",
      notes: user.notes || "",
      password: "",
      role: user.role || ROLES.CASHIER,
      is_active: Number(user.is_active ?? 1) !== 0,
    });
    setErrors({});
    setModalOpen(true);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this user?")) return;
    try {
      await userService.delete(id);
      setAlert("User deleted");
      load();
    } catch (err) {
      setAlert(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const rules = {
      username: required(form.username, "Username"),
      full_name: required(form.full_name, "Full name"),
    };
    if (!editing) {
      rules.password = required(form.password, "Password");
    }
    const validation = runFormValidation(rules);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await guard(async () => {
        if (editing) {
          await userService.update(editing.id, {
            username: form.username,
            full_name: form.full_name,
            designation: form.designation,
            phone: form.phone,
            email: form.email,
            notes: form.notes,
            role: form.role,
            is_active: form.is_active,
            password: form.password || undefined,
          });
        } else {
          await userService.create(form);
        }
        setModalOpen(false);
        setErrors({});
        setAlert(editing ? "User updated" : "User created");
        load();
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  const columns = [
    { key: "username", label: "Username" },
    { key: "full_name", label: "Full Name" },
    { key: "designation", label: "Designation" },
    { key: "phone", label: "Phone" },
    {
      key: "role",
      label: "Role",
      render: (r) => (
        <Badge variant={r.role === ROLES.ADMIN ? "info" : "neutral"}>
          {ROLE_LABELS[r.role] || r.role}
        </Badge>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge variant={Number(r.is_active ?? 1) === 0 ? "danger" : "success"}>
          {Number(r.is_active ?? 1) === 0 ? "Disabled" : "Active"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" className="btn-icon" onClick={() => openEdit(row)}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="btn-icon" onClick={() => handleDelete(row.id)}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage administrators and cashier accounts."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add User
          </Button>
        }
      />

      {alert && <Alert type="success">{alert}</Alert>}
      {loadError && <Alert>{loadError}</Alert>}

      <div style={{ marginBottom: "1rem" }}>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search users..."
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <Table columns={columns} data={users} emptyMessage="No users found" />
          <Pagination
            page={page}
            totalPages={Math.ceil(total / ITEMS_PER_PAGE)}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        closeOnOverlay={!submitting}
        title={editing ? "Edit User" : "Add User"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
          <FormValidationAlert errors={errors} />
          <div className="form-row">
            <Input
              label="Username *"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              error={errors.username}
            />
            <Input
              label="Full Name *"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              error={errors.full_name}
            />
          </div>
          <div className="form-row" style={{ marginTop: "1rem" }}>
            <Input
              label="Designation"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="form-row" style={{ marginTop: "1rem" }}>
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Input
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="form-row" style={{ marginTop: "1rem" }}>
            <Select
              label="Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option>
              <option value={ROLES.CASHIER}>{ROLE_LABELS[ROLES.CASHIER]}</option>
            </Select>
            <Select
              label="Status"
              value={form.is_active ? "1" : "0"}
              onChange={(e) => setForm({ ...form, is_active: e.target.value === "1" })}
            >
              <option value="1">Active</option>
              <option value="0">Disabled</option>
            </Select>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Input
              label={editing ? "New Password (leave blank to keep)" : "Password *"}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={errors.password}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
