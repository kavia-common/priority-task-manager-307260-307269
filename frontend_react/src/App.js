import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/**
 * LocalStorage keys are namespaced to avoid collisions with other apps/pages.
 */
const STORAGE_KEYS = {
  top: "ptm.tasks.top",
  other: "ptm.tasks.other",
  notes: "ptm.notes",
};

const LIMITS = {
  top: 3,
  other: 10,
};

function safeJsonParse(value, fallback) {
  try {
    if (value == null) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function makeId() {
  // Simple, stable-enough IDs for local-only use.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTask(maybeTask) {
  if (!maybeTask || typeof maybeTask !== "object") return null;
  const id = typeof maybeTask.id === "string" ? maybeTask.id : makeId();
  const text = typeof maybeTask.text === "string" ? maybeTask.text : "";
  const done = Boolean(maybeTask.done);
  return { id, text, done };
}

function loadTasks(key) {
  const raw = safeJsonParse(window.localStorage.getItem(key), []);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeTask).filter((t) => t && t.text.trim().length > 0);
}

function loadNotes() {
  const raw = window.localStorage.getItem(STORAGE_KEYS.notes);
  return typeof raw === "string" ? raw : "";
}

// PUBLIC_INTERFACE
function App() {
  /** This is the main entry component for the checklist to-do app. */
  const [topTasks, setTopTasks] = useState([]);
  const [otherTasks, setOtherTasks] = useState([]);
  const [notes, setNotes] = useState("");

  // Edit state (shared modal for both lists)
  const [editing, setEditing] = useState(null); // { section: 'top'|'other', id, text }
  const editInputRef = useRef(null);

  // Load persisted state on first mount.
  useEffect(() => {
    setTopTasks(loadTasks(STORAGE_KEYS.top).slice(0, LIMITS.top));
    setOtherTasks(loadTasks(STORAGE_KEYS.other).slice(0, LIMITS.other));
    setNotes(loadNotes());
  }, []);

  // Persist on changes.
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.top, JSON.stringify(topTasks));
  }, [topTasks]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.other, JSON.stringify(otherTasks));
  }, [otherTasks]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.notes, notes);
  }, [notes]);

  const topAtCapacity = topTasks.length >= LIMITS.top;
  const otherAtCapacity = otherTasks.length >= LIMITS.other;

  const stats = useMemo(() => {
    const all = [...topTasks, ...otherTasks];
    const done = all.filter((t) => t.done).length;
    return { total: all.length, done };
  }, [topTasks, otherTasks]);

  // PUBLIC_INTERFACE
  function addTask(section) {
    /** Add a new task to the specified section (top|other). */
    const isTop = section === "top";
    const atCapacity = isTop ? topAtCapacity : otherAtCapacity;
    if (atCapacity) return;

    const newTask = { id: makeId(), text: "", done: false };
    if (isTop) setTopTasks((prev) => [...prev, newTask]);
    else setOtherTasks((prev) => [...prev, newTask]);

    // Immediately open edit modal for a good "checklist" flow.
    setEditing({ section, id: newTask.id, text: "" });
  }

  // PUBLIC_INTERFACE
  function toggleTask(section, id) {
    /** Toggle completion status of a task. */
    const setter = section === "top" ? setTopTasks : setOtherTasks;
    setter((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  // PUBLIC_INTERFACE
  function requestEdit(section, task) {
    /** Open the edit modal with the task prefilled. */
    setEditing({ section, id: task.id, text: task.text });
  }

  // PUBLIC_INTERFACE
  function saveEdit() {
    /** Save the active edit modal changes back into the correct list. */
    if (!editing) return;

    const trimmed = (editing.text || "").trim();
    const section = editing.section;

    // If user clears text, interpret as delete (keeps UI tidy and avoids empty tasks).
    if (!trimmed) {
      deleteTask(section, editing.id);
      setEditing(null);
      return;
    }

    const setter = section === "top" ? setTopTasks : setOtherTasks;
    setter((prev) => prev.map((t) => (t.id === editing.id ? { ...t, text: trimmed } : t)));

    setEditing(null);
  }

  // PUBLIC_INTERFACE
  function deleteTask(section, id) {
    /** Delete a task from a section. */
    const setter = section === "top" ? setTopTasks : setOtherTasks;
    setter((prev) => prev.filter((t) => t.id !== id));
  }

  // PUBLIC_INTERFACE
  function clearCompleted() {
    /** Remove all completed tasks from both sections. */
    setTopTasks((prev) => prev.filter((t) => !t.done));
    setOtherTasks((prev) => prev.filter((t) => !t.done));
  }

  // Focus edit input when modal opens.
  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editing]);

  function onEditKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setEditing(null);
    }
  }

  return (
    <div className="App">
      <main className="page">
        <header className="header">
          <div className="headerText">
            <h1 className="title">Checklist</h1>
            <p className="subtitle">
              {stats.done}/{stats.total} done
              <span className="dot" aria-hidden="true">
                •
              </span>
              Top priority: {topTasks.length}/{LIMITS.top}
              <span className="dot" aria-hidden="true">
                •
              </span>
              Other tasks: {otherTasks.length}/{LIMITS.other}
            </p>
          </div>

          <div className="headerActions">
            <button className="btn" type="button" onClick={() => addTask("top")} disabled={topAtCapacity}>
              Add top priority
            </button>
            <button className="btn" type="button" onClick={() => addTask("other")} disabled={otherAtCapacity}>
              Add other task
            </button>
            <button className="btn btn-ghost" type="button" onClick={clearCompleted} disabled={stats.done === 0}>
              Clear completed
            </button>
          </div>
        </header>

        <section className="sheet" aria-label="Task lists">
          <TaskSection
            title="Top priority"
            hint={`Max ${LIMITS.top} tasks`}
            section="top"
            tasks={topTasks}
            atCapacity={topAtCapacity}
            onAdd={() => addTask("top")}
            onToggle={(id) => toggleTask("top", id)}
            onEdit={(task) => requestEdit("top", task)}
            onDelete={(id) => deleteTask("top", id)}
          />

          <TaskSection
            title="Other tasks"
            hint={`Max ${LIMITS.other} tasks`}
            section="other"
            tasks={otherTasks}
            atCapacity={otherAtCapacity}
            onAdd={() => addTask("other")}
            onToggle={(id) => toggleTask("other", id)}
            onEdit={(task) => requestEdit("other", task)}
            onDelete={(id) => deleteTask("other", id)}
          />
        </section>

        <section className="notes" aria-label="Notes">
          <div className="notesHeader">
            <h2 className="sectionTitle">Notes</h2>
            <p className="sectionHint">Freeform notes saved locally</p>
          </div>

          <textarea
            className="notesArea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write anything you want to remember…"
            rows={8}
          />
        </section>

        <footer className="footer">
          <p className="footerText">
            Stored locally in your browser (localStorage). No account, no backend.
          </p>
        </footer>
      </main>

      {editing ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-title"
          onMouseDown={(e) => {
            // Click outside to close
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <div className="modal">
            <h3 id="edit-title" className="modalTitle">
              Edit task
            </h3>

            <label className="modalLabel" htmlFor="edit-input">
              Task text
            </label>
            <input
              id="edit-input"
              ref={editInputRef}
              className="modalInput"
              value={editing.text}
              onChange={(e) => setEditing((prev) => ({ ...prev, text: e.target.value }))}
              onKeyDown={onEditKeyDown}
              placeholder="e.g., Call dentist"
            />

            <div className="modalHelp">
              <span>Enter to save</span>
              <span className="dot" aria-hidden="true">
                •
              </span>
              <span>Esc to cancel</span>
              <span className="dot" aria-hidden="true">
                •
              </span>
              <span>Clear text to delete</span>
            </div>

            <div className="modalActions">
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" type="button" onClick={() => deleteTask(editing.section, editing.id)}>
                Delete
              </button>
              <button className="btn" type="button" onClick={saveEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// PUBLIC_INTERFACE
function TaskSection({ title, hint, section, tasks, atCapacity, onAdd, onToggle, onEdit, onDelete }) {
  /** Renders one task section with bounded list and capacity message. */
  const empty = tasks.length === 0;

  return (
    <div className="section" data-section={section}>
      <div className="sectionHeader">
        <div>
          <h2 className="sectionTitle">{title}</h2>
          <p className="sectionHint">{hint}</p>
        </div>

        <div className="sectionActions">
          <button className="btn btn-small" type="button" onClick={onAdd} disabled={atCapacity}>
            Add
          </button>
        </div>
      </div>

      {atCapacity ? (
        <div className="capacityBanner" role="status">
          This section is full. Delete a task to add another.
        </div>
      ) : null}

      <ul className="taskList" aria-label={`${title} list`}>
        {empty ? (
          <li className="emptyRow">
            <span className="emptyText">No tasks yet.</span>
          </li>
        ) : null}

        {tasks.map((task) => (
          <li key={task.id} className={`taskRow ${task.done ? "isDone" : ""}`}>
            <label className="checkWrap">
              <input
                className="checkbox"
                type="checkbox"
                checked={task.done}
                onChange={() => onToggle(task.id)}
                aria-label={task.done ? `Mark "${task.text}" as not done` : `Mark "${task.text}" as done`}
              />
              <span className="checkVisual" aria-hidden="true" />
            </label>

            <button
              type="button"
              className="taskTextBtn"
              onClick={() => onEdit(task)}
              aria-label={`Edit task: ${task.text || "Untitled task"}`}
              title="Edit"
            >
              <span className="taskText">{task.text || <em className="untitled">Untitled task</em>}</span>
            </button>

            <div className="rowActions">
              <button className="iconBtn" type="button" onClick={() => onEdit(task)} aria-label="Edit task" title="Edit">
                Edit
              </button>
              <button
                className="iconBtn iconBtnDanger"
                type="button"
                onClick={() => onDelete(task.id)}
                aria-label="Delete task"
                title="Delete"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
