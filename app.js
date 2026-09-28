document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();

  const STORAGE_KEY = "rider_inventario_v1";
  const body = document.getElementById("inventoryBody");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const toast = document.getElementById("toast");
  const modal = document.getElementById("modalBackdrop");

  let equipos = load();

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    const initial = Array.isArray(window.EQUIPOS_INICIALES) ? window.EQUIPOS_INICIALES : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(equipos));
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[ch]));
  }

  function statusClass(status) {
    return String(status || "").toLowerCase().replace(/\s+/g, "-");
  }

  function render() {
    const q = searchInput.value.trim().toLowerCase();
    const cat = categoryFilter.value;
    const status = statusFilter.value;

    const filtered = equipos.filter(e => {
      const text = [e.clave,e.nombre,e.marca,e.modelo,e.numero_serie].join(" ").toLowerCase();
      return (!q || text.includes(q))
        && (!cat || e.categoria === cat)
        && (!status || e.estado === status);
    });

    body.innerHTML = filtered.map(e => `
      <tr>
        <td class="key">${esc(e.clave)}</td>
        <td title="${esc(e.nombre)}">${esc(e.nombre)}</td>
        <td class="muted">${esc(e.categoria)}</td>
        <td class="muted">${esc(e.marca)}</td>
        <td class="muted">${esc(e.modelo)}</td>
        <td class="serial">${esc(e.numero_serie)}</td>
        <td>${esc(e.condicion)}</td>
        <td><span class="status ${statusClass(e.estado)}"><span class="status-dot"></span>${esc(e.estado)}</span></td>
        <td>
          <div class="actions">
            <button class="action-btn edit" data-action="edit" data-key="${esc(e.clave)}" title="Editar" aria-label="Editar"><i data-lucide="pencil"></i></button>
            <button class="action-btn view" data-action="view" data-key="${esc(e.clave)}" title="Ver ficha" aria-label="Ver ficha"><i data-lucide="eye"></i></button>
            <button class="action-btn delete" data-action="delete" data-key="${esc(e.clave)}" title="Borrar" aria-label="Borrar"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `).join("");

    emptyState.style.display = filtered.length ? "none" : "flex";
    lucide.createIcons();
  }

  function notify(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function openDetails(e) {
    document.getElementById("modalTitle").textContent = e.nombre;
    document.getElementById("modalDetails").innerHTML = [
      ["Clave", e.clave], ["Categoría", e.categoria], ["Marca", e.marca],
      ["Modelo", e.modelo], ["Número de serie", e.numero_serie],
      ["Condición", e.condicion], ["Estado", e.estado],
      ["Registro", e.activo === false ? "Inactivo" : "Activo"]
    ].map(([label,value]) => `<div class="detail-item"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join("");

    const status = document.getElementById("modalStatus");
    status.className = `status ${statusClass(e.estado)}`;
    status.innerHTML = `<span class="status-dot"></span>${esc(e.estado)}`;

    document.getElementById("modalEdit").href = `alta.html?edit=${encodeURIComponent(e.clave)}`;
    modal.classList.add("open");
    lucide.createIcons();
  }

  body.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const key = button.dataset.key;
    const item = equipos.find(e => e.clave === key);
    if (!item) return;

    if (button.dataset.action === "edit") {
      location.href = `alta.html?edit=${encodeURIComponent(key)}`;
    } else if (button.dataset.action === "view") {
      openDetails(item);
    } else if (button.dataset.action === "delete") {
      if (confirm(`¿Borrar el equipo ${item.clave} - ${item.nombre}?`)) {
        equipos = equipos.filter(e => e.clave !== key);
        save();
        render();
        notify("Equipo borrado correctamente.");
      }
    }
  });

  document.getElementById("modalClose").addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") modal.classList.remove("open"); });

  [searchInput, categoryFilter, statusFilter].forEach(el => el.addEventListener("input", render));
  [categoryFilter, statusFilter].forEach(el => el.addEventListener("change", render));

  window.CATEGORIAS.forEach(c => {
    const option = document.createElement("option");
    option.value = c;
    option.textContent = c;
    categoryFilter.appendChild(option);
  });

  document.getElementById("availabilityCard").addEventListener("click", () => {
    statusFilter.value = "Disponible";
    render();
    document.querySelector(".table-card").scrollIntoView({behavior:"smooth", block:"start"});
  });

  document.getElementById("reportCard").addEventListener("click", () => {
    notify("Reporte de utilización: función preparada para la siguiente etapa.");
  });

  document.getElementById("btn-salir").addEventListener("click", () => {
    notify("Sesión cerrada.");
  });

  render();
});