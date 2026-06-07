import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:8000/api";

// ЭКРАН ВХОДА

function AuthScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!username.trim() || !password.trim()) return setError("Введите логин и пароль");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { username, password });
      onLogin(res.data.token, res.data.username, res.data.role);
    } catch (e) {
      setError(e.response?.data?.detail || "Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 8, padding: 32, width: 360 }}>
        <h2 style={{ margin: "0 0 24px", textAlign: "center", fontSize: 22 }}>🧸 Toy Shop — Вход</h2>

        <label style={S.label}>Логин</label>
        <input style={S.input} placeholder="Введите логин" value={username}
          onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} autoFocus />

        <label style={S.label}>Пароль</label>
        <input style={S.input} type="password" placeholder="Введите пароль" value={password}
          onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />

        {error && <div style={S.error}>{error}</div>}

        <button style={{ ...S.btn, width: "100%", padding: 10 }} onClick={submit} disabled={loading}>
          {loading ? "Вход..." : "Войти"}
        </button>

        <div style={{ marginTop: 16, padding: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, color: "#6b7280" }}>
          <div>Администратор: <b>admin</b> / <b>admin123</b></div>
          <div style={{ marginTop: 4 }}>Пользователь: <b>user1</b> / <b>user123</b></div>
        </div>
      </div>
    </div>
  );
}


// КАРТОЧКА ИГРУШКИ

function ToyCard({ toy, onOrder, isAdmin, onDelete, onEdit }) {
  return (
    <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: 16, background: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, background: "#e0e7ff", color: "#3730a3", padding: "2px 8px", borderRadius: 4 }}>
          {toy.category_name}
        </span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>от {toy.age_from ?? 0} лет</span>
      </div>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{toy.name}</h3>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "#6b7280" }}>{toy.manufacturer_name}, {toy.manufacturer_country}</p>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#374151", lineHeight: 1.4 }}>{toy.description}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{Number(toy.price).toLocaleString("ru-RU")} ₽</div>
          <div style={{ fontSize: 12, color: toy.stock_qty > 0 ? "#16a34a" : "#dc2626" }}>
            {toy.stock_qty > 0 ? `В наличии: ${toy.stock_qty} шт.` : "Нет в наличии"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {!isAdmin && (
            <button style={{ ...S.btn, ...(toy.stock_qty === 0 ? { background: "#9ca3af", cursor: "not-allowed" } : {}) }}
              onClick={() => toy.stock_qty > 0 && onOrder(toy)} disabled={toy.stock_qty === 0}>
              Заказать
            </button>
          )}
          {isAdmin && (
            <>
              <button style={{ ...S.btn, background: "#2563eb" }} onClick={() => onEdit(toy)}>Изменить</button>
              <button style={{ ...S.btn, background: "#dc2626" }} onClick={() => onDelete(toy.id)}>Удалить</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// СТРОКА ЗАКАЗА

const STATUS_LABELS = { new:"Новый", confirmed:"Подтверждён", shipped:"Отправлен", delivered:"Доставлен", cancelled:"Отменён" };
const STATUS_COLORS = { new:"#2563eb", confirmed:"#d97706", shipped:"#7c3aed", delivered:"#16a34a", cancelled:"#dc2626" };

function OrderRow({ order, onStatusChange }) {
  return (
    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
      <td style={S.td}>#{order.id}</td>
      <td style={S.td}>
        <div>{order.customer_name}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{order.customer_email}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{order.customer_phone}</div>
      </td>
      <td style={S.td}>{order.toy_name}</td>
      <td style={S.td}>{order.quantity} шт.</td>
      <td style={S.td}><b>{Number(order.total_price).toLocaleString("ru-RU")} ₽</b></td>
      <td style={S.td}>
        <span style={{ color: STATUS_COLORS[order.status], fontWeight: 600, fontSize: 13 }}>
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </td>
      <td style={S.td}>
        <select value={order.status} onChange={e => onStatusChange(order.id, e.target.value)}
          style={{ padding: "4px 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13 }}>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </td>
    </tr>
  );
}

// МОДАЛКА: ДОБАВИТЬ / ИЗМЕНИТЬ ИГРУШКУ

function ToyModal({ toy, categories, manufacturers, onSave, onClose }) {
  const [form, setForm] = useState(toy || { name:"", description:"", price:"", age_from:"", stock_qty:"", category_id:"", manufacturer_id:"" });
  const [error, setError] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.name.trim()) return setError("Введите название");
    if (!form.price) return setError("Введите цену");
    onSave({
      name: form.name, description: form.description || "",
      price: parseFloat(form.price), age_from: parseInt(form.age_from) || 0,
      stock_qty: parseInt(form.stock_qty) || 0,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      manufacturer_id: form.manufacturer_id ? parseInt(form.manufacturer_id) : null,
    });
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 8, padding: 24, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{toy ? "Изменить игрушку" : "Добавить игрушку"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>
        <hr style={{ margin: "0 0 16px", borderColor: "#e5e7eb" }} />

        {[
          ["Название *", "name", "text", "Название игрушки"],
          ["Описание", "description", "text", "Краткое описание"],
          ["Цена (₽) *", "price", "number", "0"],
          ["Возраст от (лет)", "age_from", "number", "0"],
          ["Остаток на складе", "stock_qty", "number", "0"],
        ].map(([label, key, type, ph]) => (
          <div key={key}>
            <label style={S.label}>{label}</label>
            <input style={S.input} type={type} placeholder={ph}
              value={form[key]} onChange={e => set(key, e.target.value)} />
          </div>
        ))}

        <label style={S.label}>Категория</label>
        <select style={S.input} value={form.category_id || ""} onChange={e => set("category_id", e.target.value)}>
          <option value="">— не выбрано —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <label style={S.label}>Производитель</label>
        <select style={S.input} value={form.manufacturer_id || ""} onChange={e => set("manufacturer_id", e.target.value)}>
          <option value="">— не выбрано —</option>
          {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {error && <div style={S.error}>{error}</div>}
        <button style={{ ...S.btn, width: "100%", padding: 10, marginTop: 4 }} onClick={save}>
          {toy ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </div>
  );
}

// ГЛАВНЫЙ КОМПОНЕНТ

export default function App() {
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [tab, setTab] = useState("home");

  const [toys, setToys] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState([]);
  const [popular, setPopular] = useState([]);
  const [logs, setLogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [orderModal, setOrderModal] = useState(null);
  const [orderForm, setOrderForm] = useState({ full_name:"", email:"", phone:"", quantity:1 });
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [toyModal, setToyModal] = useState(null);

  const api = token ? axios.create({ headers: { Authorization: `Bearer ${token}` } }) : axios;

  const handleLogin = (t, u, r) => { setToken(t); setCurrentUser(u); setRole(r); setTab("home"); };
  const handleLogout = () => { setToken(null); setCurrentUser(null); setRole(null); setTab("home"); setToys([]); setOrders([]); };
  const loadToys = async () => { const r = await api.get(`${API}/toys`); setToys(r.data); };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const load = async () => {
      try {
        if (tab === "catalog") {
          await loadToys();
          if (role === "admin") {
            const [c, m] = await Promise.all([api.get(`${API}/categories`), api.get(`${API}/manufacturers`)]);
            setCategories(c.data); setManufacturers(m.data);
          }
        }
        if (tab === "orders" && role === "admin") { const r = await api.get(`${API}/orders`); setOrders(r.data); }
        if (tab === "stats" && role === "admin") {
          const [s, p] = await Promise.all([api.get(`${API}/stats/orders`), api.get(`${API}/stats/popular`)]);
          setStats(s.data); setPopular(p.data);
        }
        if (tab === "logs" && role === "admin") { const r = await api.get(`${API}/logs`); setLogs(r.data); }
      } finally { setLoading(false); }
    };
    load();
  }, [tab, token]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const r = search.trim()
        ? await api.get(`${API}/toys/search/${encodeURIComponent(search)}`)
        : await api.get(`${API}/toys`);
      setToys(r.data);
    } finally { setLoading(false); }
  };

  const openOrder = (toy) => {
    setOrderModal(toy);
    setOrderForm({ full_name:"", email:"", phone:"", quantity:1 });
    setOrderError(""); setOrderSuccess(false);
  };
  const setOF = (k, v) => setOrderForm(f => ({ ...f, [k]: v }));
  const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const submitOrder = async () => {
    setOrderError("");
    if (!orderForm.full_name.trim()) return setOrderError("Введите ФИО");
    if (!validEmail(orderForm.email)) return setOrderError("Введите корректный email");
    if (!orderForm.phone.trim()) return setOrderError("Введите телефон");
    try {
      const cr = await api.post(`${API}/customers`, { full_name: orderForm.full_name, email: orderForm.email, phone: orderForm.phone });
      await api.post(`${API}/orders`, { customer_id: cr.data.id, toy_id: orderModal.id, quantity: orderForm.quantity });
      await loadToys();
      setOrderSuccess(true);
    } catch (e) { setOrderError(e.response?.data?.detail || "Ошибка при оформлении"); }
  };

  const deleteToy = async (id) => {
    if (!window.confirm("Удалить игрушку?")) return;
    await api.delete(`${API}/toys/${id}`);
    await loadToys();
  };

  const saveToy = async (data) => {
    try {
      if (toyModal === "new") { await api.post(`${API}/toys`, data); }
      else { await api.put(`${API}/toys/${toyModal.id}`, data); }
      setToyModal(null);
      await loadToys();
    } catch (e) { alert(e.response?.data?.detail || "Ошибка"); }
  };

  const changeStatus = async (id, status) => {
    await api.post(`${API}/orders/${id}/status`, { status });
    const r = await api.get(`${API}/orders`);
    setOrders(r.data);
  };

  const clearLogs = async () => {
    if (!window.confirm("Очистить все логи?")) return;
    await api.delete(`${API}/logs`);
    const r = await api.get(`${API}/logs`);
    setLogs(r.data);
  };

  const totalRev = stats.reduce((s, r) => s + Number(r.total_revenue || 0), 0);
  const totalOrd = stats.reduce((s, r) => s + Number(r.total_orders || 0), 0);

  const adminTabs = [
    { key: "home", label: "Главная" },
    { key: "catalog", label: "Каталог" },
    { key: "orders", label: "Заказы" },
    { key: "stats", label: "Статистика" },
    { key: "logs", label: "Логи" },
  ];
  const userTabs = [
    { key: "home", label: "Главная" },
    { key: "catalog", label: "Каталог" },
  ];
  const tabs = role === "admin" ? adminTabs : userTabs;

  if (!token) return <AuthScreen onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: "Arial, sans-serif", fontSize: 14, color: "#111827" }}>

      {/* ШАПКА */}
      <header style={{ background: "white", borderBottom: "1px solid #d1d5db", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", height: 52 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>🧸 Toy Shop</div>
        <nav style={{ display: "flex", gap: 4 }}>
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "6px 14px", border: "1px solid",
              borderColor: tab === key ? "#2563eb" : "#d1d5db",
              background: tab === key ? "#2563eb" : "white",
              color: tab === key ? "white" : "#374151",
              borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: tab === key ? 600 : 400
            }}>{label}</button>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
          <span style={{ color: "#6b7280" }}>
            {role === "admin" ? "Администратор" : "Пользователь"}: <b>{currentUser}</b>
          </span>
          <button onClick={handleLogout} style={{ padding: "5px 12px", border: "1px solid #d1d5db", background: "white", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
            Выйти
          </button>
        </div>
      </header>

      <main style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ГЛАВНАЯ */}
        {tab === "home" && (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 8, padding: 32, textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧸</div>
              <h1 style={{ margin: "0 0 12px", fontSize: 26 }}>Добро пожаловать в Toy Shop</h1>
              <p style={{ margin: "0 0 20px", color: "#6b7280", lineHeight: 1.6 }}>
                Система управления каталогом детских игрушек.<br />
                Выбирайте товары и оформляйте заказы быстро и удобно.
              </p>
              <button style={{ ...S.btn, padding: "10px 24px" }} onClick={() => setTab("catalog")}>
                Перейти в каталог
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { icon: "🎯", title: "Большой выбор", text: "Конструкторы, куклы, машинки, настольные игры и многое другое" },
                { icon: "🚚", title: "Отслеживание заказов", text: "Следите за статусом своего заказа в любое время" },
                { icon: "✅", title: "Проверенные бренды", text: "LEGO, Mattel, Hasbro и другие известные производители" },
                { icon: "📦", title: "Простой заказ", text: "Оформите заказ без лишних шагов — только ФИО и контакты" },
              ].map(({ icon, title, text }) => (
                <div key={title} style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 6, padding: 16 }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
                  <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>{title}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>{text}</p>
                </div>
              ))}
            </div>

            {role === "admin" && (
              <div style={{ marginTop: 16, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: 16 }}>
                <h3 style={{ margin: "0 0 6px", color: "#1d4ed8" }}>Панель администратора</h3>
                <p style={{ margin: 0, color: "#374151", fontSize: 13 }}>
                  Вам доступно управление товарами (добавление, изменение, удаление),
                  просмотр и управление заказами, статистика продаж и журнал действий.
                </p>
              </div>
            )}
          </div>
        )}

        {/* КАТАЛОГ */}
        {tab === "catalog" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <input style={{ ...S.input, flex: 1, minWidth: 200, marginBottom: 0 }}
                placeholder="Поиск по названию или описанию..."
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()} />
              <button style={S.btn} onClick={handleSearch}>Найти</button>
              <button style={{ ...S.btn, background: "#6b7280" }} onClick={() => { setSearch(""); loadToys(); }}>Сбросить</button>
              {role === "admin" && (
                <button style={{ ...S.btn, background: "#16a34a" }} onClick={() => setToyModal("new")}>+ Добавить товар</button>
              )}
            </div>
            {loading
              ? <p style={{ textAlign: "center", color: "#6b7280" }}>Загрузка...</p>
              : toys.length === 0
                ? <p style={{ textAlign: "center", color: "#6b7280" }}>Ничего не найдено</p>
                : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                    {toys.map(toy => (
                      <ToyCard key={toy.id} toy={toy} isAdmin={role === "admin"}
                        onOrder={openOrder} onDelete={deleteToy} onEdit={t => setToyModal(t)} />
                    ))}
                  </div>
            }
          </>
        )}

        {/* ЗАКАЗЫ */}
        {tab === "orders" && role === "admin" && (
          loading ? <p style={{ textAlign: "center", color: "#6b7280" }}>Загрузка...</p>
          : orders.length === 0 ? <p style={{ textAlign: "center", color: "#6b7280" }}>Заказов пока нет</p>
          : <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "white", border: "1px solid #d1d5db", borderRadius: 6 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["№", "Покупатель", "Игрушка", "Кол-во", "Сумма", "Статус", "Изменить"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #d1d5db", fontWeight: 600, fontSize: 13 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => <OrderRow key={o.id} order={o} onStatusChange={changeStatus} />)}
                </tbody>
              </table>
            </div>
        )}

        {/* СТАТИСТИКА */}
        {tab === "stats" && role === "admin" && (
          loading ? <p style={{ textAlign: "center", color: "#6b7280" }}>Загрузка...</p>
          : <>
              <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
                {[
                  { label: "Всего заказов", val: totalOrd },
                  { label: "Общая выручка", val: totalRev.toLocaleString("ru-RU") + " ₽" },
                ].map(({ label, val }) => (
                  <div key={label} style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 6, padding: "16px 24px", minWidth: 160 }}>
                    <div style={{ fontSize: 26, fontWeight: 700 }}>{val}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <h3 style={{ marginBottom: 10 }}>По статусам</h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", background: "white", border: "1px solid #d1d5db", borderRadius: 6 }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        {["Статус", "Заказов", "Выручка"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map(s => (
                        <tr key={s.status} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={S.td}><span style={{ color: STATUS_COLORS[s.status], fontWeight: 600 }}>{STATUS_LABELS[s.status] || s.status}</span></td>
                          <td style={S.td}>{s.total_orders}</td>
                          <td style={S.td}>{Number(s.total_revenue || 0).toLocaleString("ru-RU")} ₽</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <h3 style={{ marginBottom: 10 }}>Топ-5 популярных игрушек</h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", background: "white", border: "1px solid #d1d5db", borderRadius: 6 }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        {["#", "Название", "Заказов", "Цена"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {popular.map((t, i) => (
                        <tr key={t.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={S.td}>{i + 1}</td>
                          <td style={S.td}>{t.name}</td>
                          <td style={S.td}>{t.order_count}</td>
                          <td style={S.td}>{Number(t.price).toLocaleString("ru-RU")} ₽</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
        )}

        {/* ЛОГИ */}
        {tab === "logs" && role === "admin" && (
          loading ? <p style={{ textAlign: "center", color: "#6b7280" }}>Загрузка...</p>
          : <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ margin: 0 }}>Журнал действий</h2>
                <button style={{ ...S.btn, background: "#dc2626" }} onClick={clearLogs}>Очистить логи</button>
              </div>
              {logs.length === 0
                ? <p style={{ color: "#6b7280" }}>Логов нет</p>
                : <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", background: "white", border: "1px solid #d1d5db", borderRadius: 6 }}>
                      <thead>
                        <tr style={{ background: "#f9fafb" }}>
                          {["Время", "Пользователь", "Действие", "Детали"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #d1d5db", fontSize: 13, fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map(l => (
                          <tr key={l.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={S.td}>{new Date(l.created_at).toLocaleString("ru-RU")}</td>
                            <td style={S.td}><b>{l.username}</b></td>
                            <td style={S.td}><code style={{ fontSize: 13 }}>{l.action}</code></td>
                            <td style={S.td}>{l.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </>
        )}
      </main>

      {/* МОДАЛКА ЗАКАЗА */}
      {orderModal && (
        <div style={S.overlay} onClick={() => setOrderModal(null)}>
          <div style={{ background: "white", borderRadius: 8, padding: 24, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            {orderSuccess ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <h2 style={{ margin: "0 0 8px" }}>Заказ оформлен!</h2>
                <p style={{ color: "#6b7280", margin: "0 0 20px" }}>
                  Спасибо, {orderForm.full_name.split(" ")[0]}! Мы свяжемся с вами.
                </p>
                <button style={{ ...S.btn, padding: "10px 24px" }} onClick={() => setOrderModal(null)}>Закрыть</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>{orderModal.name}</h2>
                    <span style={{ color: "#2563eb", fontWeight: 700 }}>{Number(orderModal.price).toLocaleString("ru-RU")} ₽ за шт.</span>
                  </div>
                  <button onClick={() => setOrderModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
                </div>
                <hr style={{ margin: "0 0 14px", borderColor: "#e5e7eb" }} />

                <label style={S.label}>ФИО *</label>
                <input style={S.input} placeholder="Иванов Иван Иванович" value={orderForm.full_name}
                  onChange={e => setOF("full_name", e.target.value)} />
                <label style={S.label}>Email *</label>
                <input style={S.input} type="email" placeholder="example@mail.ru" value={orderForm.email}
                  onChange={e => setOF("email", e.target.value)} />
                <label style={S.label}>Телефон *</label>
                <input style={S.input} type="tel" placeholder="+7 900 000 00 00" value={orderForm.phone}
                  onChange={e => setOF("phone", e.target.value)} />

                <label style={S.label}>Количество</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <button style={{ width: 32, height: 32, border: "1px solid #d1d5db", background: "white", borderRadius: 4, cursor: "pointer", fontSize: 18 }}
                    onClick={() => setOF("quantity", Math.max(1, orderForm.quantity - 1))}>−</button>
                  <span style={{ fontSize: 16, fontWeight: 600, minWidth: 24, textAlign: "center" }}>{orderForm.quantity}</span>
                  <button style={{ width: 32, height: 32, border: "1px solid #d1d5db", background: "white", borderRadius: 4, cursor: "pointer", fontSize: 18 }}
                    onClick={() => setOF("quantity", Math.min(orderModal.stock_qty, orderForm.quantity + 1))}>+</button>
                  <span style={{ color: "#6b7280", fontSize: 13 }}>макс. {orderModal.stock_qty} шт.</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #e5e7eb", marginBottom: 10 }}>
                  <span style={{ color: "#6b7280" }}>Итого:</span>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{(Number(orderModal.price) * orderForm.quantity).toLocaleString("ru-RU")} ₽</span>
                </div>

                {orderError && <div style={S.error}>{orderError}</div>}
                <button style={{ ...S.btn, width: "100%", padding: 10 }} onClick={submitOrder}>Оформить заказ</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* МОДАЛКА ТОВАРА */}
      {toyModal && (
        <ToyModal
          toy={toyModal === "new" ? null : toyModal}
          categories={categories}
          manufacturers={manufacturers}
          onSave={saveToy}
          onClose={() => setToyModal(null)}
        />
      )}
    </div>
  );
}

// СТИЛИ

const S = {
  label: { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#374151" },
  input: { display: "block", width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 14, marginBottom: 12, boxSizing: "border-box", outline: "none" },
  btn: { background: "#2563eb", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 14 },
  td: { padding: "10px 12px", fontSize: 14 },
  error: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: 4, fontSize: 13, marginBottom: 10 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
};