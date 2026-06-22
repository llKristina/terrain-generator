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
Твоя задача — проанализировать текст пользователя и вернуть строго один валидный JSON-объект, соответствующий инструкции.

==================================================
ГЛАВНОЕ ПРАВИЛО БИОМОВ
==================================================
Поля "type" и "biome" ОБЯЗАНЫ строго совпадать и соответствовать запросу пользователя. 
Если пользователь просит пустыню — type и biome должны быть "desert".
Если пользователь просит равнину — type и biome должны быть "plains".
Категорически запрещено возвращать "mountains", если в запросе пользователя доминирует другой биом (пустыня, долина, джунгли и т.д.).

==================================================
ДОСТУПНЫЕ ТИПЫ ЛАНДШАФТА И ПРАВИЛА ОПРЕДЕЛЕНИЯ
==================================================
- mountains = высокие горы, скалы, альпы
- hills     = холмы, возвышенности
- desert    = пустыня, дюны, песок
- canyon    = каньон, ущелье
- volcano   = вулкан, лава
- tundra    = снег, лед, арктика, тундра
- jungle    = джунгли, тропики
- forest    = лес, тайга
- plains    = равнина, поле, луг
- swamp     = болото
- water     = озеро, море, океан, водный ландшафт
- island    = остров
- beach     = пляж, берег
- garden    = сад, цветы, парк

==================================================
ПРАВИЛА ВОДЫ ("hasWater" и "water_type")
==================================================
Если в тексте есть (озеро, море, океан, пляж, остров, водопад) -> "hasWater": true, "water_type": "lake"
Если в тексте есть (река, ручей) -> "hasWater": true, "water_type": "river"
Если воды нет -> "hasWater": false, "water_type": "none"

==================================================
ПРАВИЛА ДЕРЕВЬЕВ ("hasTrees" и "tree_density")
==================================================
Если есть (лес, джунгли, тайга, деревья, сад) -> "hasTrees": true
- Для forest, jungle -> "tree_density": 0.7 - 1.0
- Для hills, plains, garden -> "tree_density": 0.2 - 0.5
- Для desert, volcano, water, beach -> "hasTrees": false, "tree_density": 0.0

==================================================
ПРАВИЛА ДЛЯ layoutHints
==================================================
Если в запросе одновременно есть возвышенности (горы, холмы, вулкан) И вода (река, озеро), ты обязан добавить объект "layoutHints", разведя их в разные стороны (запрещено указывать одинаковые координаты для воды и гор).
Допустимые x: "left", "right", ""
Допустимые z: "back", "front", ""

==================================================
СТРОГИЙ ШАБЛОН ОТВЕТА (JSON SCHEMA)
==================================================
Ты должен вернуть ТОЛЬКО JSON-объект, строго по этому шаблону. Никакого текста вокруг, никаких символов ```json. Не используй null.

{{
  "type": "строка (один из доступных типов)",
  "biome": "строка (должна совпадать с type)",
  "height_scale": число от 0.3 до 1.5,
  "roughness": число от 0.2 до 1.3,
  "octaves": целое число от 2 до 7,
  "persistence": число от 0.2 до 0.8,
  "frequency": число от 0.01 до 0.09,
  "hasWater": логическое значение (true/false),
  "water_type": "строка (river, lake или none)",
  "water_level": число от 0.0 до 1.0,
  "hasTrees": логическое значение (true/false),
  "tree_density": число от 0.0 до 1.0,
  "layoutHints": {{
    "mountain": {{ "x": "left/right/"" ", "z": "back/front/"" " }},
    "river": {{ "x": "left/right/"" ", "z": "back/front/"" " }}
  }}
}}

Добавь к числовым параметрам небольшую случайность ±10% для уникальности.
Если просят воду, делай roughness и frequency меньше (рельеф должен быть плавным).

==================================================
ТЕКУЩИЙ ЗАПРОС ПОЛЬЗОВАТЕЛЯ
==================================================
Текст пользователя: "{user_text}"
Ответ (СТРОГО ОДИН JSON ОБЪЕКТ):
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