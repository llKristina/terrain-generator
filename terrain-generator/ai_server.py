from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import re
import random
import sqlite3
import jwt
import datetime
import os
from openai import OpenAI
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = os.getenv("DB_PATH", "users.db")
SECRET_KEY = os.getenv("SECRET_KEY", "secret_key")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

app = Flask(__name__)
CORS(app)

if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY не задан")

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=GROQ_API_KEY
)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()

init_db()

def call_groq(prompt):
    try:
        print(">>> CALL GROQ START")

        if not GROQ_API_KEY:
            print("GROQ_API_KEY is EMPTY")
            return ""

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,  
            response_format={"type": "json_object"}
        )

        print("GROQ RAW RESPONSE:", response)

        if not response.choices or not response.choices[0].message:
            print(" EMPTY RESPONSE FROM GROQ")
            return ""

        content = response.choices[0].message.content

        print("GROQ CONTENT:", content)

        if not content:
            print(" EMPTY CONTENT")
            return ""

        try:
            json.loads(content)
        except Exception as e:
            print(" INVALID JSON FROM GROQ:", e)
            print("RAW:", content)
            return ""

        return content

    except Exception as e:
        print(" GROQ ERROR:", repr(e))
        return ""

def fallback_params(text_lower):
    return {
        "type": "hills",
        "height_scale": 0.7,
        "roughness": 0.5,
        "octaves": 4,
        "persistence": 0.5,
        "frequency": 0.04,
        "hasWater": False,
        "water_type": "none",
        "water_level": 0.0,
        "hasTrees": False,
        "tree_density": 0.0,
        "biome": "plains"
    }


def vary(value, min_v, max_v, factor=0.1):
    value = value * (1 + (random.random() - 0.5) * factor * 2)
    return max(min_v, min(max_v, value))


@app.route('/api/parse', methods=['POST'])
def parse_text():
    user_text = request.json.get('text', '')
    text_lower = user_text.lower()

    print("Запрос:", user_text)

    prompt = f"""
Ты — интеллектуальный AI-генератор параметров процедурных 3D-ландшафтов.

Твоя задача:
- понять смысл текстового запроса пользователя;
- определить подходящий тип ландшафта;
- подобрать реалистичные параметры генерации;
- вернуть ТОЛЬКО один корректный JSON. не оборачивай его в массив;
- НЕ писать пояснения, markdown, комментарии или текст вне JSON.

Если в запросе пользователя одновременно присутствуют возвышенности (горы, холмы, вулкан) и вода (река, озеро), ты ОБЯЗАН добавить в JSON-ответ поле "layoutHints". В этом поле ты должен развести их в разные стороны карты, чтобы они не пересекались.

Пример структуры "layoutHints":
"layoutHints": {{
    "mountain": {{ "x": "left", "z": "back" }},
    "river": {{ "x": "right", "z": "front" }}
}}

Допустимые значения для "x": "left", "right", ""
Допустимые значения для "z": "back", "front", ""

Никогда не помещай реку ("river") и гору ("mountain") в одни и те же координаты (например, "left" и "back" одновременно для обоих объектов ЗАПРЕЩЕНЫ).

==================================================
ДОСТУПНЫЕ ТИПЫ ЛАНДШАФТА
==================================================

mountains  = высокие горы
hills      = холмы
desert     = пустыня
canyon     = каньон
volcano    = вулкан
tundra     = тундра
jungle     = джунгли
forest     = лес
plains     = равнина
swamp      = болото
water      = озеро / море / водный ландшафт
island     = остров
beach      = пляж
garden     = сад

==================================================
ПРАВИЛА ОПРЕДЕЛЕНИЯ ТИПА
==================================================

Если пользователь пишет:
- "горы", "скалы", "альпы" → mountains
- "холмы" → hills
- "пустыня", "дюны" → desert
- "каньон" → canyon
- "вулкан", "лава" → volcano
- "снег", "лед", "арктика" → tundra
- "джунгли", "тропики" → jungle
- "лес", "тайга" → forest
- "болото" → swamp
- "равнина", "поле" → plains
- "озеро", "море", "океан" → water
- "остров" → island
- "пляж", "берег" → beach
- "сад", "цветы", "парк" → garden

==================================================
ПРАВИЛА ВОДЫ
==================================================

Если в запросе есть:
- озеро
- река
- море
- океан
- водопад
- пляж
- остров

ТО:
"hasWater": true

Если есть:
- "река"
→ "water_type": "river"

Если есть:
- "озеро"
- "море"
- "океан"
- "пляж"
- "остров"

→ "water_type": "lake"

Если воды нет:
"hasWater": false
"water_type": "none"

==================================================
ПРАВИЛА ДЕРЕВЬЕВ
==================================================

Если есть:
- лес
- джунгли
- тайга
- деревья
- сад

ТО:
"hasTrees": true

Для:
- desert
- volcano
- water
- beach

деревья почти отсутствуют:
"tree_density": 0.0-0.1

Для:
- forest
- jungle

густые деревья:
"tree_density": 0.7-1.0

Для:
- hills
- plains

умеренно:
"tree_density": 0.2-0.5

==================================================
ПАРАМЕТРЫ
==================================================

height_scale:
0.3 - 1.5

roughness:
0.2 - 1.3

octaves:
2 - 7

persistence:
0.2 - 0.8

frequency:
0.01 - 0.09

water_level:
0.0 - 1.0

tree_density:
0.0 - 1.0

==================================================
СМЫСЛ ПАРАМЕТРОВ
==================================================

height_scale:
низкий = плоско
высокий = большие горы

roughness:
низкий = гладко
высокий = остро и скалисто

frequency:
низкий = крупные формы
высокий = мелкий шум

octaves:
больше = больше детализации

==================================================
ПРАВИЛА ИНТЕРПРЕТАЦИИ
==================================================

"высокие горы"
→ большой height_scale

"острые скалы"
→ высокий roughness

"пологие"
→ низкий roughness

"огромные"
→ низкий frequency

"мелкие холмы"
→ высокий frequency

"густой лес"
→ высокий tree_density

==================================================
ВАЖНО
==================================================

1. Всегда возвращай ВСЕ поля.

2. Никогда не пропускай:
- type
- height_scale
- roughness
- octaves
- persistence
- frequency
- hasWater
- water_type
- water_level
- hasTrees
- tree_density
- biome

3. Возвращай ТОЛЬКО JSON.

4. НЕ добавляй markdown.

5. НЕ объясняй ответ.

6. НЕ используй null.

7. НЕ используй комментарии.

8. Добавляй небольшую случайность ±10%.

9.Если пользователь просит озеро или реку:

- уменьши roughness
- уменьши frequency
- избегай экстремально острых гор

Озёра и реки требуют более плавного рельефа.


==================================================
ПРИМЕРЫ
==================================================

Запрос:
"высокие острые горы"
{user_text}
"""

    answer = call_groq(prompt)

    print("AI ответ:", answer)

    if not answer:
        print("Using fallback (empty Groq response)")
        return jsonify(fallback_params(text_lower))

    try:
        result = json.loads(answer)
        return jsonify(result)

    except Exception as e:
        print("JSON parse error:", e)
        print("Raw answer:", answer)
        return jsonify(fallback_params(text_lower))

    if 'гор' in text_lower or 'mountain' in text_lower:
        params["type"] = "mountains"

    if 'вулкан' in text_lower:
        params["type"] = "volcano"

    if 'каньон' in text_lower:
        params["type"] = "canyon"

    if 'пустын' in text_lower:
        params["type"] = "desert"

    if 'лес' in text_lower:
        params["hasTrees"] = True

    if 'озер' in text_lower or 'река' in text_lower:
        params["hasWater"] = True

    params["height_scale"] = vary(params.get("height_scale", 0.7), 0.3, 1.5, 0.12)
    params["roughness"] = vary(params.get("roughness", 0.5), 0.2, 1.3, 0.12)
    params["frequency"] = vary(params.get("frequency", 0.04), 0.01, 0.09, 0.1)
    params["persistence"] = vary(params.get("persistence", 0.5), 0.2, 0.8, 0.1)
    params["tree_density"] = vary(params.get("tree_density", 0.0), 0.0, 1.0, 0.1)

    print("FINAL:", params)

    return jsonify(params)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()

    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()

    if not username or not email or not password:
        return jsonify({'success': False, 'message': 'Заполните все поля'}), 400

    password_hash = generate_password_hash(password)
    created_at = datetime.datetime.now().isoformat()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (username, email, password_hash, created_at)
        )

        conn.commit()

        return jsonify({'success': True, 'message': 'Пользователь зарегистрирован'})

    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Пользователь с таким именем или email уже существует'}), 409

    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()

    login_value = data.get('login', '').strip()
    password = data.get('password', '').strip()

    if not login_value or not password:
        return jsonify({'success': False, 'message': 'Введите логин и пароль'}), 400

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, username, email, password_hash FROM users WHERE username=? OR email=?",
        (login_value, login_value)
    )

    user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({
            "success": False,
            "message": "Пользователь не найден"
        }), 401

    user_id, username, email, password_hash = user

    if not check_password_hash(password_hash, password):
        return jsonify({
            "success": False,
            "message": "Неверный пароль"
        }), 401

    token = jwt.encode(
        {
            "user_id": user_id,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12)
        },
        SECRET_KEY,
        algorithm="HS256"
    )

    return jsonify({
        "success": True,
        "token": token,
        "user": {
            "id": user_id,
            "username": username,
            "email": email
        }
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)