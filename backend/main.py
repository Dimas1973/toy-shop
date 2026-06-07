from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import create_engine, text
from pydantic import BaseModel
from typing import Optional
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/toyshop")
SECRET_KEY = "toy_shop_secret_key_2025"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

engine = create_engine(DATABASE_URL)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

app = FastAPI(title="Toy Shop API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# СХЕМЫ

class ToyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    age_from: Optional[int] = None
    stock_qty: int = 0
    category_id: Optional[int] = None
    manufacturer_id: Optional[int] = None

class CustomerCreate(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = ""

class OrderCreate(BaseModel):
    customer_id: int
    toy_id: int
    quantity: int = 1

class StatusUpdate(BaseModel):
    status: str

class UserLogin(BaseModel):
    username: str
    password: str

# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

def query(sql: str, params: dict = {}):
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        rows = result.mappings().all()
        return [dict(row) for row in rows]

def execute(sql: str, params: dict = {}):
    with engine.connect() as conn:
        conn.execute(text(sql), params)
        conn.commit()

def create_token(username: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "role": role, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        role = payload.get("role")
        if not username:
            raise HTTPException(status_code=401, detail="Недействительный токен")
        return {"username": username, "role": role}
    except JWTError:
        raise HTTPException(status_code=401, detail="Недействительный токен")

def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Доступ только для администратора")
    return user

def log_action(username: str, action: str, details: str = ""):
    execute(
        "INSERT INTO action_logs (username, action, details) VALUES (:u, :a, :d)",
        {"u": username, "a": action, "d": details}
    )

# АВТОРИЗАЦИЯ

@app.post("/api/auth/login")
def login(data: UserLogin):
    rows = query("SELECT username, password_hash, role FROM users WHERE username = :u", {"u": data.username})
    if not rows:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    user = rows[0]
    if not pwd_context.verify(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    log_action(data.username, "login", "Вход в систему")
    token = create_token(user["username"], user["role"])
    return {"token": token, "username": user["username"], "role": user["role"]}

@app.get("/api/auth/me")
def get_me(current_user=Depends(get_current_user)):
    return current_user

# ИГРУШКИ

@app.get("/api/toys")
def get_toys(current_user=Depends(get_current_user)):
    return query("SELECT * FROM v_toys_full")

@app.get("/api/toys/search/{query_text}")
def search_toys(query_text: str, current_user=Depends(get_current_user)):
    return query(
        """SELECT t.id, t.name, t.price, t.age_from, t.stock_qty, t.description,
               c.name AS category_name, m.name AS manufacturer_name, m.country AS manufacturer_country
           FROM toys t
           LEFT JOIN categories c ON t.category_id = c.id
           LEFT JOIN manufacturers m ON t.manufacturer_id = m.id
           WHERE t.name ILIKE :q OR t.description ILIKE :q""",
        {"q": f"%{query_text}%"}
    )

@app.get("/api/toys/category/{cat_id}")
def toys_by_category(cat_id: int, current_user=Depends(get_current_user)):
    return query(
        """SELECT t.id, t.name, t.price, t.age_from, t.stock_qty, t.description,
               c.name AS category_name, m.name AS manufacturer_name, m.country AS manufacturer_country
           FROM toys t
           LEFT JOIN categories c ON t.category_id = c.id
           LEFT JOIN manufacturers m ON t.manufacturer_id = m.id
           WHERE t.category_id = :id""",
        {"id": cat_id}
    )

@app.get("/api/toys/{toy_id}")
def get_toy(toy_id: int, current_user=Depends(get_current_user)):
    rows = query("SELECT * FROM v_toys_full WHERE id = :id", {"id": toy_id})
    if not rows:
        raise HTTPException(status_code=404, detail="Игрушка не найдена")
    return rows[0]

@app.post("/api/toys", status_code=201)
def create_toy(toy: ToyCreate, admin=Depends(require_admin)):
    execute("""INSERT INTO toys (name, description, price, age_from, stock_qty, category_id, manufacturer_id)
               VALUES (:name, :description, :price, :age_from, :stock_qty, :category_id, :manufacturer_id)""",
            toy.model_dump())
    log_action(admin["username"], "create_toy", f"Добавлена игрушка: {toy.name}")
    return {"message": "Игрушка создана"}

@app.put("/api/toys/{toy_id}")
def update_toy(toy_id: int, toy: ToyCreate, admin=Depends(require_admin)):
    execute("""UPDATE toys SET name=:name, description=:description, price=:price,
               age_from=:age_from, stock_qty=:stock_qty, category_id=:category_id,
               manufacturer_id=:manufacturer_id WHERE id=:id""",
            {**toy.model_dump(), "id": toy_id})
    log_action(admin["username"], "update_toy", f"Обновлена игрушка id={toy_id}: {toy.name}")
    return {"message": "Игрушка обновлена"}

@app.delete("/api/toys/{toy_id}")
def delete_toy(toy_id: int, admin=Depends(require_admin)):
    rows = query("SELECT name FROM toys WHERE id = :id", {"id": toy_id})
    name = rows[0]["name"] if rows else str(toy_id)
    execute("DELETE FROM toys WHERE id = :id", {"id": toy_id})
    log_action(admin["username"], "delete_toy", f"Удалена игрушка: {name}")
    return {"message": "Игрушка удалена"}

# ПОКУПАТЕЛИ

@app.get("/api/customers")
def get_customers(current_user=Depends(get_current_user)):
    return query("SELECT id, full_name, email, phone FROM customers ORDER BY created_at DESC")

@app.post("/api/customers", status_code=201)
def create_customer(c: CustomerCreate, current_user=Depends(get_current_user)):
    with engine.connect() as conn:
        result = conn.execute(text("""
            INSERT INTO customers (full_name, email, phone)
            VALUES (:full_name, :email, :phone)
            ON CONFLICT (email) DO NOTHING RETURNING id
        """), c.model_dump())
        row = result.fetchone()
        if row is not None:
            conn.commit()
            return {"id": row[0], "message": "Покупатель создан"}
        existing = conn.execute(text("SELECT id FROM customers WHERE email = :email"), {"email": c.email}).fetchone()
        if existing is None:
            raise HTTPException(status_code=500, detail="Не удалось получить id покупателя")
        return {"id": existing[0], "message": "Покупатель уже существует"}

# ЗАКАЗЫ

@app.get("/api/orders")
def get_orders(admin=Depends(require_admin)):
    return query("""
        SELECT o.*, c.full_name as customer_name, c.email as customer_email,
               c.phone as customer_phone, t.name as toy_name
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN toys t ON o.toy_id = t.id
        ORDER BY o.created_at DESC
    """)

@app.post("/api/orders", status_code=201)
def create_order(order: OrderCreate, current_user=Depends(get_current_user)):
    toy_rows = query("SELECT price, stock_qty, name FROM toys WHERE id = :id", {"id": order.toy_id})
    if not toy_rows:
        raise HTTPException(status_code=404, detail="Игрушка не найдена")
    toy = toy_rows[0]
    if order.quantity > toy["stock_qty"]:
        raise HTTPException(status_code=400, detail="Недостаточно товара на складе")
    total = toy["price"] * order.quantity
    execute("""INSERT INTO orders (customer_id, toy_id, quantity, total_price)
               VALUES (:customer_id, :toy_id, :quantity, :total_price)""",
            {**order.model_dump(), "total_price": total})
    execute("UPDATE toys SET stock_qty = stock_qty - :qty WHERE id = :id",
            {"qty": order.quantity, "id": order.toy_id})
    log_action(current_user["username"], "create_order", f"Заказ: {toy['name']} x{order.quantity}")
    return {"message": "Заказ создан"}

@app.post("/api/orders/{order_id}/status")
def change_order_status(order_id: int, body: StatusUpdate, admin=Depends(require_admin)):
    execute("CALL sp_change_order_status(:order_id, :status)",
            {"order_id": order_id, "status": body.status})
    log_action(admin["username"], "change_status", f"Заказ #{order_id} → {body.status}")
    return {"message": "Статус обновлён"}

# СПРАВОЧНИКИ И СТАТИСТИКА

@app.get("/api/categories")
def get_categories(current_user=Depends(get_current_user)):
    return query("SELECT * FROM categories")

@app.get("/api/manufacturers")
def get_manufacturers(current_user=Depends(get_current_user)):
    return query("SELECT * FROM manufacturers")

@app.get("/api/stats/orders")
def get_order_stats(admin=Depends(require_admin)):
    return query("SELECT * FROM v_order_stats")

@app.get("/api/stats/popular")
def get_popular_toys(admin=Depends(require_admin)):
    return query("SELECT * FROM v_popular_toys LIMIT 5")

@app.get("/api/stats/customer/{cust_id}/orders")
def customer_order_count(cust_id: int, admin=Depends(require_admin)):
    rows = query("SELECT fn_customer_order_count(:id) as count", {"id": cust_id})
    return rows[0]

# ЛОГИ (только для админа)

@app.get("/api/logs")
def get_logs(admin=Depends(require_admin)):
    return query("SELECT * FROM action_logs ORDER BY created_at DESC LIMIT 200")

@app.delete("/api/logs")
def clear_logs(admin=Depends(require_admin)):
    execute("DELETE FROM action_logs")
    log_action(admin["username"], "clear_logs", "Логи очищены")
    return {"message": "Логи очищены"}