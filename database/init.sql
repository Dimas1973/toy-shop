-- ТАБЛИЦЫ

-- Пользователи системы
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    role VARCHAR(20) DEFAULT 'user', -- 'admin' или 'user'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Категории игрушек
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id)
);

-- Производители
CREATE TABLE manufacturers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100),
    website VARCHAR(200)
);

-- Покупатели
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Игрушки
CREATE TABLE toys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    age_from INTEGER,
    stock_qty INTEGER DEFAULT 0,
    category_id INTEGER REFERENCES categories(id),
    manufacturer_id INTEGER REFERENCES manufacturers(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Заказы
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    toy_id INTEGER REFERENCES toys(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) DEFAULT 'new',
    total_price NUMERIC(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Логи действий
CREATE TABLE action_logs (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ПРЕДСТАВЛЕНИЯ

CREATE VIEW v_toys_full AS
SELECT
    t.id, t.name, t.price, t.age_from, t.stock_qty, t.description,
    c.name AS category_name,
    m.name AS manufacturer_name,
    m.country AS manufacturer_country
FROM toys t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN manufacturers m ON t.manufacturer_id = m.id;

CREATE VIEW v_order_stats AS
SELECT status, COUNT(*) AS total_orders, SUM(total_price) AS total_revenue
FROM orders GROUP BY status;

CREATE VIEW v_popular_toys AS
SELECT t.id, t.name, t.price, COUNT(o.id) AS order_count
FROM toys t
LEFT JOIN orders o ON t.id = o.toy_id
GROUP BY t.id, t.name, t.price
ORDER BY order_count DESC;

-- ФУНКЦИИ

CREATE OR REPLACE FUNCTION fn_toys_by_category(cat_id INTEGER)
RETURNS TABLE(id INT, name VARCHAR, price NUMERIC, stock_qty INT) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.price, t.stock_qty FROM toys t WHERE t.category_id = cat_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_search_toys(query TEXT)
RETURNS TABLE(id INT, name VARCHAR, price NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.price FROM toys t
    WHERE t.name ILIKE '%' || query || '%' OR t.description ILIKE '%' || query || '%';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_customer_order_count(cust_id INTEGER)
RETURNS INTEGER AS $$
DECLARE cnt INTEGER;
BEGIN
    SELECT COUNT(*) INTO cnt FROM orders WHERE customer_id = cust_id;
    RETURN cnt;
END;
$$ LANGUAGE plpgsql;

-- ПРОЦЕДУРЫ

CREATE OR REPLACE PROCEDURE sp_change_order_status(order_id INTEGER, new_status VARCHAR)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE orders SET status = new_status, updated_at = NOW() WHERE id = order_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_restock_toys(toy_id INTEGER, add_qty INTEGER)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE toys SET stock_qty = stock_qty + add_qty WHERE id = toy_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_cancel_old_orders(days_old INTEGER)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE orders SET status = 'cancelled', updated_at = NOW()
    WHERE status = 'new' AND created_at < NOW() - (days_old || ' days')::INTERVAL;
END;
$$;

-- ТЕСТОВЫЕ ДАННЫЕ

-- Пользователи: admin (пароль: admin123), user1 (пароль: user123)
INSERT INTO users (username, password_hash, role) VALUES
('admin', '$2b$12$rl9fcVL4U9o.t8mkY7ojje8GMxBVqs17D06mbRDbtFBz8nyiM4mAe', 'admin'),
('user1', '$2b$12$gDwVTG9MHFJMr8/19SvRz.l56RXVODASlZMqTzMk1gJrMzMQi6g8q', 'user');

INSERT INTO categories (name, description) VALUES
('Конструкторы', 'Наборы для сборки'),
('Куклы', 'Куклы и аксессуары'),
('Машинки', 'Радиоуправляемые и обычные'),
('Настольные игры', 'Игры для всей семьи'),
('Мягкие игрушки', 'Плюшевые и тканевые');

INSERT INTO manufacturers (name, country, website) VALUES
('LEGO', 'Дания', 'https://lego.com'),
('Mattel', 'США', 'https://mattel.com'),
('Hasbro', 'США', 'https://hasbro.com'),
('Clever', 'Россия', 'https://clever-toys.ru');

INSERT INTO customers (full_name, email, phone, address) VALUES
('Иванов Иван', 'ivan@mail.ru', '+79001112233', 'Москва, ул. Ленина 1'),
('Петрова Анна', 'anna@mail.ru', '+79004445566', 'СПб, Невский 5'),
('Сидоров Пётр', 'petr@mail.ru', '+79007778899', 'Казань, ул. Мира 10'),
('Козлова Мария', 'maria@mail.ru', '+79009998877', 'Екатеринбург, пр. Мира 3'),
('Новиков Алексей', 'alex@mail.ru', '+79003334455', 'Новосибирск, ул. Советская 7');

INSERT INTO toys (name, description, price, age_from, stock_qty, category_id, manufacturer_id) VALUES
('LEGO City Полицейский участок', 'Большой набор 668 деталей', 4999.00, 6, 15, 1, 1),
('Барби Модница', 'Кукла с набором одежды', 1499.00, 3, 30, 2, 2),
('Машинка Ferrari радиоуправляемая', 'Масштаб 1:16, скорость до 20 км/ч', 2999.00, 8, 10, 3, 3),
('Монополия классическая', 'Классическая настольная игра', 1999.00, 8, 25, 4, 3),
('Медведь плюшевый 60см', 'Мягкая игрушка, гипоаллергенный материал', 899.00, 0, 40, 5, 4),
('LEGO Technic Экскаватор', 'Технический набор 1129 деталей', 7999.00, 10, 8, 1, 1),
('Кукла Эльза Холодное сердце', 'Говорящая кукла с аксессуарами', 2499.00, 4, 20, 2, 2),
('Машинка Hot Wheels набор', 'Трек + 2 машинки', 1299.00, 5, 35, 3, 2),
('Шахматы деревянные', 'Классические шахматы', 799.00, 6, 15, 4, 4),
('Единорог мягкий', 'Мягкая игрушка, разные цвета', 699.00, 0, 50, 5, 4);

INSERT INTO orders (customer_id, toy_id, quantity, status, total_price) VALUES
(1, 1, 1, 'delivered', 4999.00),
(1, 4, 1, 'delivered', 1999.00),
(2, 2, 2, 'shipped', 2998.00),
(3, 6, 1, 'confirmed', 7999.00),
(3, 9, 1, 'new', 799.00),
(4, 5, 3, 'delivered', 2697.00),
(4, 10, 2, 'cancelled', 1398.00),
(5, 3, 1, 'shipped', 2999.00);