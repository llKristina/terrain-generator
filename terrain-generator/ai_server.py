from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import re
import random
import sqlite3
import jwt
import datetime
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

SECRET_KEY = "secret_key"

def init_db():
    conn = sqlite3.connect("users.db")
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


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()

    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()

    if not username or not email or not password:
        return jsonify({'success': False, 'message': 'Заполните все поля'}), 400

    if len(password) < 6:
        return jsonify({'success': False, 'message': 'Пароль должен быть не меньше 6 символов'}), 400

    password_hash = generate_password_hash(password)
    created_at = datetime.datetime.now().isoformat()

    try:
        conn = sqlite3.connect("users.db")
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (username, email, password_hash, created_at)
        )

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Пользователь успешно зарегистрирован'})

    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Пользователь с таким именем или email уже существует'}), 409


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()

    login_value = data.get('login', '').strip()
    password = data.get('password', '').strip()

    if not login_value or not password:
        return jsonify({'success': False, 'message': 'Введите логин и пароль'}), 400

    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?",
        (login_value, login_value)
    )

    user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404

    user_id, username, email, password_hash = user

    if not check_password_hash(password_hash, password):
        return jsonify({'success': False, 'message': 'Неверный пароль'}), 401

    token = jwt.encode(
        {
            'user_id': user_id,
            'username': username,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12)
        },
        SECRET_KEY,
        algorithm='HS256'
    )

    return jsonify({
        'success': True,
        'message': 'Вход выполнен успешно',
        'token': token,
        'user': {
            'id': user_id,
            'username': username,
            'email': email
        }
    })

@app.route('/api/profile', methods=['GET'])
def profile():
    auth_header = request.headers.get('Authorization')

    if not auth_header:
        return jsonify({'success': False, 'message': 'Токен не передан'}), 401

    try:
        token = auth_header.replace('Bearer ', '')
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])

        return jsonify({
            'success': True,
            'user_id': payload['user_id'],
            'username': payload['username']
        })

    except jwt.ExpiredSignatureError:
        return jsonify({'success': False, 'message': 'Срок действия токена истёк'}), 401

    except jwt.InvalidTokenError:
        return jsonify({'success': False, 'message': 'Недействительный токен'}), 401

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3"
SYSTEM_PROMPT = """
Ты — интеллектуальный AI-генератор параметров процедурных 3D-ландшафтов.

Твоя задача:
- понять смысл текстового запроса пользователя;
- определить подходящий тип ландшафта;
- подобрать реалистичные параметры генерации;
- вернуть ТОЛЬКО корректный JSON;
- НЕ писать пояснения, markdown, комментарии или текст вне JSON.

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

Ответ:
{
  "type":"mountains",
  "height_scale":1.35,
  "roughness":1.1,
  "octaves":6,
  "persistence":0.7,
  "frequency":0.02,
  "hasWater":false,
  "water_type":"none",
  "water_level":0.0,
  "hasTrees":false,
  "tree_density":0.0,
  "biome":"alpine"
}

Запрос:
"пляж с пальмами"

Ответ:
{
  "type":"beach",
  "height_scale":0.4,
  "roughness":0.3,
  "octaves":3,
  "persistence":0.35,
  "frequency":0.05,
  "hasWater":true,
  "water_type":"lake",
  "water_level":0.8,
  "hasTrees":true,
  "tree_density":0.35,
  "biome":"tropical_beach"
}

Запрос:
"густой лес"

Ответ:
{
  "type":"forest",
  "height_scale":0.7,
  "roughness":0.45,
  "octaves":5,
  "persistence":0.5,
  "frequency":0.04,
  "hasWater":false,
  "water_type":"none",
  "water_level":0.0,
  "hasTrees":true,
  "tree_density":0.9,
  "biome":"forest"
}

Запрос:
"остров"

Ответ:
{
  "type":"island",
  "height_scale":0.8,
  "roughness":0.5,
  "octaves":4,
  "persistence":0.45,
  "frequency":0.03,
  "hasWater":true,
  "water_type":"lake",
  "water_level":1.0,
  "hasTrees":true,
  "tree_density":0.4,
  "biome":"island"
}

==================================================
ПРАВИЛО СЛУЧАЙНОЙ ГЕНЕРАЦИИ
==================================================

Каждый новый ответ должен быть немного разным.

НЕ возвращай одинаковые числа для одинаковых запросов.

Всегда генерируй небольшие случайные отклонения параметров:
- height_scale ±15%
- roughness ±15%
- persistence ±10%
- frequency ±10%
- tree_density ±15%
- water_level ±10%

НО:
случайность должна оставаться ВНУТРИ логичных диапазонов.

Пример:
- "высокие горы" всегда должны иметь ВЫСОКИЙ height_scale
- "холмы" всегда должны иметь СРЕДНИЙ или НИЗКИЙ height_scale
- "равнина" всегда должна быть почти плоской
- "пустыня" не должна становиться горной
- "вулкан" всегда должен быть высоким и rough

==================================================
ПРИМЕРЫ ДИАПАЗОНОВ
==================================================

mountains:
height_scale = 1.0 - 1.5
roughness = 0.7 - 1.3

hills:
height_scale = 0.4 - 0.8
roughness = 0.3 - 0.6

plains:
height_scale = 0.2 - 0.4
roughness = 0.2 - 0.35

desert:
height_scale = 0.3 - 0.7
roughness = 0.3 - 0.6

volcano:
height_scale = 1.1 - 1.5
roughness = 0.8 - 1.3

forest:
height_scale = 0.5 - 0.9
roughness = 0.3 - 0.6

jungle:
height_scale = 0.6 - 1.0
roughness = 0.4 - 0.7

swamp:
height_scale = 0.2 - 0.5
roughness = 0.2 - 0.4

tundra:
height_scale = 0.5 - 0.9
roughness = 0.4 - 0.7

water:
height_scale = 0.2 - 0.5
roughness = 0.2 - 0.4

beach:
height_scale = 0.2 - 0.5
roughness = 0.2 - 0.4

island:
height_scale = 0.5 - 1.0
roughness = 0.3 - 0.7

==================================================
ВАЖНО
==================================================

Одинаковые запросы НЕ должны возвращать одинаковый JSON.

Но:
- тип ландшафта должен оставаться правильным;
- параметры должны оставаться логичными;
- нельзя генерировать экстремальные значения вне диапазонов.
"""

def addVariation(value, defaultValue, minVal, maxVal, variationFactor=0.1):
    if value is None:
        value = defaultValue
    variation = 1 + (random.random() - 0.5) * variationFactor * 2
    result = value * variation
    return max(minVal, min(maxVal, result))

def createSmartFallbackParams(text_lower):
    params = {
        "type": "hills",
        "height_scale": 0.7,
        "roughness": 0.5,
        "octaves": 4,
        "persistence": 0.5,
        "frequency": 0.04,
        "hasWater": False,
        "water_level": 0,
        "hasTrees": False,
        "tree_density": 0,
        "biome": "plains"
    }
    
    if any(k in text_lower for k in ['вулкан', 'volcano']):
        params["type"] = "volcano"
        params["height_scale"] = 1.3
        params["roughness"] = 0.8
    elif any(k in text_lower for k in ['пустын', 'desert']):
        params["type"] = "desert"
        params["height_scale"] = 0.4
        params["roughness"] = 0.5
    elif any(k in text_lower for k in ['каньон', 'canyon']):
        params["type"] = "canyon"
        params["height_scale"] = 0.7
        params["roughness"] = 0.8
    elif any(k in text_lower for k in ['джунгл', 'jungle']):
        params["type"] = "jungle"
        params["hasTrees"] = True
        params["tree_density"] = 0.8
    elif any(k in text_lower for k in ['гор', 'mountain']):
        if 'высок' in text_lower or 'ост' in text_lower:
            params["height_scale"] = 1.3
            params["roughness"] = 0.9
        else:
            params["height_scale"] = 0.9
            params["roughness"] = 0.6
        params["type"] = "mountains"
    elif any(k in text_lower for k in ['холм', 'hill']):
        params["type"] = "hills"
        params["height_scale"] = 0.55
        params["roughness"] = 0.35
    elif any(k in text_lower for k in ['равнин', 'plain']):
        params["type"] = "plains"
        params["height_scale"] = 0.35
    
    if any(k in text_lower for k in ['озер', 'lake']):
        params["hasWater"] = True
        params["water_level"] = 0.6
    if any(k in text_lower for k in ['река', 'river']):
        params["hasWater"] = True
        params["water_level"] = 0.5
    
    if any(k in text_lower for k in ['лес', 'forest', 'дерев']):
        params["hasTrees"] = True
        params["tree_density"] = 0.5
    
    params['height_scale'] = addVariation(params['height_scale'], 0.7, 0.3, 1.5, 0.12)
    params['roughness'] = addVariation(params['roughness'], 0.5, 0.2, 1.3, 0.12)
    params['tree_density'] = addVariation(params['tree_density'], 0, 0, 1, 0.1)
    params['water_level'] = addVariation(params['water_level'], 0, 0, 1, 0.1)
    
    return params

@app.route('/api/parse', methods=['POST'])
def parse_text():
    user_text = request.json.get('text', '')
    print(f"Текст: {user_text}")
    text_lower = user_text.lower()

    prompt = f"{SYSTEM_PROMPT}\n\nЗапрос пользователя: {user_text}\n\nВерни только JSON с параметрами."

    body = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.4, 
            "num_predict": 500
        }
    }

    try:
        print(" Отправка запроса в Ollama...")
        response = requests.post(OLLAMA_URL, json=body, timeout=90)

        print(f"Статус: {response.status_code}")

        if response.status_code != 200:
            print(f" Ошибка Ollama: {response.text}")
            return jsonify(createSmartFallbackParams(text_lower))

        result = response.json()
        answer = result.get("response", "")

        print(f" Ответ Ollama: {answer[:800]}...")

        # Извлечение JSON
        json_match = re.search(r'(\{[\s\S]*?\})', answer, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
            json_str = re.sub(r'^```json\s*|\s*```$', '', json_str.strip())
            params = json.loads(json_str)
            print(" JSON успешно распаршен")
        else:
            print("JSON не найден, использую fallback")
            return jsonify(createSmartFallbackParams(text_lower))
                if 'гор' in text_lower or 'mountain' in text_lower:
            params['type'] = 'mountains'
            if 'высок' in text_lower or 'ост' in text_lower:
                params['height_scale'] = max(params.get('height_scale', 0.9), 1.2)
                params['roughness'] = max(params.get('roughness', 0.6), 0.8)
            elif 'низк' in text_lower or 'пологи' in text_lower:
                params['height_scale'] = min(params.get('height_scale', 0.9), 0.7)
                params['roughness'] = min(params.get('roughness', 0.6), 0.5)
        
        if 'холм' in text_lower or 'hill' in text_lower:
            params['type'] = 'hills'
            params['height_scale'] = min(params.get('height_scale', 0.7), 0.7)
            params['roughness'] = min(params.get('roughness', 0.6), 0.5)
        
        if 'равнин' in text_lower or 'plain' in text_lower:
            params['type'] = 'plains'
            params['height_scale'] = min(params.get('height_scale', 0.7), 0.5)
        
        if 'озер' in text_lower or 'lake' in text_lower:
            params['hasWater'] = True
            params['water_level'] = max(params.get('water_level', 0.5), 0.5)
        if 'река' in text_lower or 'river' in text_lower:
            params['hasWater'] = True
            params['water_level'] = params.get('water_level', 0.5)
        
        if 'лес' in text_lower or 'forest' in text_lower or 'дерев' in text_lower:
            params['hasTrees'] = True
            if 'густ' in text_lower:
                params['tree_density'] = max(params.get('tree_density', 0.5), 0.7)
            else:
                params['tree_density'] = max(params.get('tree_density', 0.5), 0.4)
        elif 'пуст' in text_lower and 'лес' not in text_lower:
            params['hasTrees'] = False
            params['tree_density'] = 0
        params['height_scale'] = addVariation(params.get('height_scale', 0.7), 0.7, 0.3, 1.5, 0.1)
        params['roughness'] = addVariation(params.get('roughness', 0.5), 0.5, 0.2, 1.3, 0.1)
        params['octaves'] = int(addVariation(params.get('octaves', 4), 4, 2, 7, 0.12))
        params['persistence'] = addVariation(params.get('persistence', 0.5), 0.5, 0.2, 0.8, 0.1)
        params['frequency'] = addVariation(params.get('frequency', 0.04), 0.04, 0.01, 0.09, 0.1)
        params['water_level'] = addVariation(params.get('water_level', 0), 0, 0, 1, 0.08)
        params['tree_density'] = addVariation(params.get('tree_density', 0), 0, 0, 1, 0.1)

        print(f" Финальные параметры: {params}")
        return jsonify(params)

    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify(createSmartFallbackParams(text_lower))

if __name__ == '__main__':
    print(" AI сервер (Ollama) запущен")
    print(" Режим: УМНЫЙ ПАРСИНГ + ЛЁГКАЯ ВАРИАТИВНОСТЬ")
    print(f" Модель: {OLLAMA_MODEL}")
    print("http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)