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

    // Immediately open edit modal for a "paper checklist" flow.
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
  function deleteTask(section, id) {
    /** Delete a task from a section. */
    const setter = section === "top" ? setTopTasks : setOtherTasks;
    setter((prev) => prev.filter((t) => t.id !== id));
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
      <main className="page" aria-label="Priority to-do checklist">
        <div className="paper" role="document" aria-label="Checklist sheet">
          <header className="paperHeader">
            <div className="paperHeaderLeft">
              <p className="paperKicker">Priority To-do Checklist</p>
              <p className="paperSub">
                <span>Date:</span>
                <span aria-hidden="true" style={{ flex: 1, borderBottom: "1px solid #000", height: 0, transform: "translateY(-2px)" }} />
              </p>
            </div>

            <div className="paperHeaderRight" aria-label="Actions">
              <button className="paperBtn" type="button" onClick={() => addTask("top")} disabled={topAtCapacity}>
                + Top
              </button>
              <button className="paperBtn" type="button" onClick={() => addTask("other")} disabled={otherAtCapacity}>
                + Other
              </button>
              <button className="paperBtn paperBtnGhost" type="button" onClick={clearCompleted} disabled={stats.done === 0}>
                Clear done
              </button>
            </div>
          </header>

          <div className="paperBody">
            <TaskBlock
              title="# No. Top priority Status"
              section="top"
              tasks={topTasks}
              limit={LIMITS.top}
              atCapacity={topAtCapacity}
              onAdd={() => addTask("top")}
              onToggle={(id) => toggleTask("top", id)}
              onEdit={(task) => requestEdit("top", task)}
              onDelete={(id) => deleteTask("top", id)}
            />

            <TaskBlock
              title="# No. Other tasks Status"
              section="other"
              tasks={otherTasks}
              limit={LIMITS.other}
              atCapacity={otherAtCapacity}
              onAdd={() => addTask("other")}
              onToggle={(id) => toggleTask("other", id)}
              onEdit={(task) => requestEdit("other", task)}
              onDelete={(id) => deleteTask("other", id)}
            />
          </div>

          <section className="notesBlock" aria-label="Notes">
            <div className="notesHeader">
              <h2 className="blockTitle">NOTES</h2>
              <p className="blockHint">Saved locally</p>
            </div>
            <textarea
              className="notesPaper"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="…"
              rows={6}
            />
          </section>

          <footer className="paperFooter">
            <p className="paperFooterText">Local-only checklist (browser storage).</p>
          </footer>
        </div>
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
              Edit item
            </h3>

            <label className="modalLabel" htmlFor="edit-input">
              Text
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
function TaskBlock({ title, section, tasks, limit, atCapacity, onAdd, onToggle, onEdit, onDelete }) {
  /** Renders one paper-styled task block with a ruled checklist. */
  const rows = useMemo(() => {
    // Render exactly `limit` rows for a paper-like fixed checklist.
    const result = [];
    for (let i = 0; i < limit; i += 1) {
      result.push(tasks[i] || null);
    }
    return result;
  }, [tasks, limit]);

  return (
    <section className="block" aria-label={title}>
      <div className="blockHeader">
        <div>
          <h2 className="blockTitle">{title}</h2>
          <p className="blockHint"> </p>
        </div>
        <button className="paperBtn paperBtnSmall" type="button" onClick={onAdd} disabled={atCapacity} aria-label={`Add to ${title}`}>
          +
        </button>
      </div>

      {atCapacity ? (
        <p className="capacityNote" role="status">
          Full — delete one to add.
        </p>
      ) : null}

      <ol className="ruledList" data-section={section}>
        {rows.map((task, idx) => {
          const isEmpty = !task;
          const label = task?.text?.trim() ? task.text : "Blank item";

          return (
            <li key={task?.id || `empty-${section}-${idx}`} className={`ruledRow ${task?.done ? "isDone" : ""} ${isEmpty ? "isEmpty" : ""}`}>
              <label className="boxLabel">
                <input
                  className="boxInput"
                  type="checkbox"
                  checked={Boolean(task?.done)}
                  onChange={() => (task ? onToggle(task.id) : null)}
                  disabled={!task}
                  aria-label={task ? (task.done ? `Mark "${label}" as not done` : `Mark "${label}" as done`) : "Empty row"}
                />
                <span className="boxVisual" aria-hidden="true" />
              </label>

              {task ? (
                <button type="button" className="ruledTextBtn" onClick={() => onEdit(task)} title="Edit">
                  <span className="ruledText">{task.text}</span>
                </button>
              ) : (
                <span className="ruledPlaceholder" aria-hidden="true">
                  &nbsp;
                </span>
              )}

              <div className="ruledActions">
                {task ? (
                  <>
                    <button className="miniBtn" type="button" onClick={() => onEdit(task)}>
                      Edit
                    </button>
                    <button className="miniBtn miniBtnDanger" type="button" onClick={() => onDelete(task.id)}>
                      X
                    </button>
                  </>
                ) : (
                  <span className="ruledActionsSpacer" aria-hidden="true" />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default App;
