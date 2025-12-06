# Рекомендации по использованию Vision Agent Analyst

## Для кого этот документ

Этот документ содержит практические рекомендации по внедрению и использованию Vision Agent Analyst для максимальной пользы.

---

## Быстрый старт (30 минут)

### Шаг 1: Установка (10 минут)
```bash
# Клонировать репозиторий
git clone https://github.com/KazKozDev/vision-agent-analyst.git
cd vision-agent-analyst

# Установить зависимости
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd frontend
npm install
cd ..
```

### Шаг 2: Настройка (5 минут)
```bash
# Скопировать конфиг
cp .env.example .env

# Для начала использовать Ollama (бесплатно)
# В .env установить:
LLM_PROVIDER=ollama
LLM_MODEL=qwen3-vl:8b
LLM_BASE_URL=http://localhost:11434
```

### Шаг 3: Запуск (5 минут)
```bash
# Запустить приложение
./start.command

# Или вручную:
# Terminal 1: uvicorn api.main:app --reload --port 8000
# Terminal 2: cd frontend && npm run dev
```

### Шаг 4: Первый анализ (10 минут)
1. Открыть http://localhost:5173
2. Загрузить тестовый файл (test_invoice.pdf)
3. Выбрать "Finance" → "Financial Invoice"
4. Нажать "Analyze File"
5. Экспортировать результат в CSV

**Готово!** Вы провели первый анализ.

---

## Сценарии использования по ролям

### Финансовый аналитик

#### Задача 1: Ежедневный анализ графиков
```python
from src import VisionAgent

agent = VisionAgent()

# Batch анализ всех графиков из папки
import glob
charts = glob.glob("daily_charts/*.png")

results = agent.batch_analyze(
    file_paths=charts,
    task="Extract key metrics: price, volume, trend direction"
)

# Экспорт в CSV для Excel
import csv
with open("daily_report.csv", "w") as f:
    writer = csv.writer(f)
    writer.writerow(["File", "Analysis"])
    for r in results:
        writer.writerow([r.file_path.name, r.text])
```

**Экономия:** 2 часа → 10 минут

#### Задача 2: Анализ финансовых отчетов (PDF)
```python
# Используем готовый шаблон для инвойсов
results = agent.analyze_pdf(
    "quarterly_report.pdf",
    task=config.get_template("finance_invoice")
)

# Генерация PDF отчета
agent.generate_report(
    results=results,
    output_path="analysis_report.pdf",
    title="Q4 Financial Analysis"
)
```

**Экономия:** 4 часа → 15 минут

---

### E-commerce менеджер

#### Задача 1: Конкурентный анализ листингов
```python
# Скриншоты конкурентов
competitor_listings = [
    "competitor_a_product.png",
    "competitor_b_product.png",
    "competitor_c_product.png"
]

results = agent.batch_analyze(
    file_paths=competitor_listings,
    task=config.get_template("ecommerce_listing")
)

# Структурированный вывод
for r in results:
    print(f"\n=== {r.file_path.name} ===")
    print(r.text)
```

**Экономия:** 1.5 часа → 5 минут

#### Задача 2: Анализ отзывов (скриншоты)
```python
# Анализ sentiment из скриншотов отзывов
reviews = glob.glob("reviews_screenshots/*.png")

results = agent.batch_analyze(
    file_paths=reviews,
    task=config.get_template("ecommerce_sentiment")
)

# Агрегация sentiment
positive = sum(1 for r in results if "positive" in r.text.lower())
print(f"Positive sentiment: {positive/len(results)*100:.1f}%")
```

**Экономия:** 3 часа → 10 минут

---

### UI/UX дизайнер

#### Задача 1: Accessibility аудит
```python
# Все экраны приложения
screens = glob.glob("app_screens/*.png")

results = agent.batch_analyze(
    file_paths=screens,
    task=config.get_template("ui_accessibility")
)

# Генерация отчета с нарушениями
violations = []
for r in results:
    if "violation" in r.text.lower():
        violations.append({
            "screen": r.file_path.name,
            "issues": r.text
        })

# Экспорт для команды
import json
with open("a11y_audit.json", "w") as f:
    json.dump(violations, f, indent=2)
```

**Экономия:** 4 часа → 20 минут

#### Задача 2: Landing page CRO аудит
```python
# Анализ лендинга
result = agent.analyze_image(
    "landing_page.png",
    task=config.get_template("ui_landing")
)

# Извлечение рекомендаций
print("CRO Recommendations:")
print(result.text)
```

**Экономия:** 1 час → 3 минуты

---

### Бизнес-аналитик

#### Задача 1: Анализ KPI дашборда
```python
# Скриншот дашборда
result = agent.analyze_image(
    "kpi_dashboard.png",
    task=config.get_template("chart_kpi")
)

# Автоматическое извлечение метрик
print("Dashboard Health Check:")
print(result.text)
```

**Экономия:** 30 минут → 2 минуты

#### Задача 2: SWOT анализ (визуализация)
```python
result = agent.analyze_image(
    "swot_diagram.png",
    task=config.get_template("chart_swot")
)

# Экспорт для презентации
agent.generate_report(
    results=[result],
    output_path="swot_analysis.pdf",
    title="Strategic Position Analysis"
)
```

**Экономия:** 1 час → 5 минут

---

## Продвинутые техники

### 1. Кастомные шаблоны

Создайте свой шаблон в `config/prompts.yaml`:

```yaml
industry_templates:
  my_custom_analysis:
    name: "Custom Product Analysis"
    description: "Analyze product photos for quality control"
    prompt: |
      **Role**: Quality Control Inspector
      **Task**: Analyze product photo for defects.
      
      **Checklist**:
      1. Surface defects (scratches, dents)
      2. Color consistency
      3. Assembly quality
      4. Packaging condition
      
      **Output**:
      - **Pass/Fail**: Overall verdict
      - **Defects Found**: List with severity
      - **Recommendations**: Actions to take
```

Использование:
```python
result = agent.analyze_image(
    "product_photo.jpg",
    task=config.get_template("my_custom_analysis")
)
```

### 2. Интеграция с существующими системами

#### Webhook для отправки результатов
```python
import requests

def analyze_and_send(file_path, webhook_url):
    result = agent.analyze_image(file_path)
    
    # Отправка в Slack/Teams/etc
    requests.post(webhook_url, json={
        "text": f"Analysis complete: {result.file_path.name}",
        "analysis": result.text
    })
```

#### Интеграция с Google Sheets
```python
from google.oauth2 import service_account
from googleapiclient.discovery import build

def export_to_sheets(results, spreadsheet_id):
    creds = service_account.Credentials.from_service_account_file(
        'credentials.json'
    )
    service = build('sheets', 'v4', credentials=creds)
    
    values = [[r.file_path.name, r.text] for r in results]
    
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='A1',
        valueInputOption='RAW',
        body={'values': values}
    ).execute()
```

### 3. Автоматизация с cron/scheduler

```bash
# crontab -e
# Ежедневный анализ в 9:00
0 9 * * * cd /path/to/vision-agent-analyst && python scripts/daily_analysis.py
```

`scripts/daily_analysis.py`:
```python
#!/usr/bin/env python3
from src import VisionAgent
import glob
from datetime import datetime

agent = VisionAgent()

# Анализ новых файлов
new_files = glob.glob("inbox/*.png")

if new_files:
    results = agent.batch_analyze(new_files)
    
    # Генерация отчета
    agent.generate_report(
        results=results,
        output_path=f"reports/daily_{datetime.now():%Y%m%d}.pdf",
        title=f"Daily Analysis {datetime.now():%Y-%m-%d}"
    )
    
    # Перемещение обработанных файлов
    for f in new_files:
        os.rename(f, f"processed/{os.path.basename(f)}")
```

---

## Оптимизация затрат

### Стратегия 1: Гибридный подход
```python
# Простые задачи → Ollama (бесплатно)
# Сложные задачи → GPT-4 (платно)

from src.llm.factory import ProviderFactory

# Для простых задач
ollama_agent = VisionAgent(Config(provider="ollama"))

# Для сложных задач
gpt_agent = VisionAgent(Config(provider="openai", model="gpt-4o"))

# Роутинг по сложности
def smart_analyze(file_path, complexity="simple"):
    if complexity == "simple":
        return ollama_agent.analyze_image(file_path)
    else:
        return gpt_agent.analyze_image(file_path)
```

**Экономия:** До 80% на API costs

### Стратегия 2: Кэширование результатов
```python
import hashlib
import json
from pathlib import Path

CACHE_DIR = Path("data/cache")

def get_file_hash(file_path):
    with open(file_path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

def cached_analyze(file_path, task):
    file_hash = get_file_hash(file_path)
    cache_key = f"{file_hash}_{hashlib.md5(task.encode()).hexdigest()}"
    cache_file = CACHE_DIR / f"{cache_key}.json"
    
    # Проверка кэша
    if cache_file.exists():
        with open(cache_file) as f:
            return json.load(f)
    
    # Анализ
    result = agent.analyze_image(file_path, task)
    
    # Сохранение в кэш
    with open(cache_file, "w") as f:
        json.dump(result.to_dict(), f)
    
    return result
```

**Экономия:** До 50% на повторных анализах

---

## Метрики для отслеживания

### Создайте дашборд эффективности:

```python
import json
from datetime import datetime
from collections import defaultdict

class AnalyticsTracker:
    def __init__(self):
        self.stats = defaultdict(list)
    
    def track(self, result):
        self.stats['analyses'].append({
            'timestamp': datetime.now().isoformat(),
            'file': str(result.file_path),
            'tokens': result.metadata.get('usage', {}).get('total_tokens', 0),
            'provider': result.metadata.get('provider'),
            'model': result.metadata.get('model')
        })
    
    def get_summary(self):
        total = len(self.stats['analyses'])
        total_tokens = sum(a['tokens'] for a in self.stats['analyses'])
        
        return {
            'total_analyses': total,
            'total_tokens': total_tokens,
            'avg_tokens_per_analysis': total_tokens / total if total else 0,
            'providers_used': list(set(a['provider'] for a in self.stats['analyses']))
        }
    
    def save(self, path='analytics.json'):
        with open(path, 'w') as f:
            json.dump(self.stats, f, indent=2)

# Использование
tracker = AnalyticsTracker()

results = agent.batch_analyze(files)
for r in results:
    tracker.track(r)

print(tracker.get_summary())
tracker.save()
```

---

## Чек-лист внедрения

### Неделя 1: Пилот
- [ ] Установить систему
- [ ] Настроить Ollama
- [ ] Протестировать на 10 файлах
- [ ] Сравнить качество с ручным анализом
- [ ] Измерить экономию времени

### Неделя 2: Масштабирование
- [ ] Создать кастомные шаблоны для своих задач
- [ ] Настроить batch processing
- [ ] Интегрировать с существующими системами
- [ ] Обучить команду

### Неделя 3: Оптимизация
- [ ] Внедрить кэширование
- [ ] Настроить автоматизацию (cron)
- [ ] Создать дашборд метрик
- [ ] Оценить ROI

### Неделя 4: Production
- [ ] Переключиться на cloud провайдера для критичных задач
- [ ] Настроить мониторинг
- [ ] Документировать процессы
- [ ] Масштабировать на всю команду

---

## Поддержка и развитие

### Сообщество
- GitHub: https://github.com/KazKozDev/vision-agent-analyst
- Issues: Сообщайте о багах и предлагайте улучшения

### Расширение функционала
Приоритетные улучшения:
1. Кэширование (добавить в `src/utils/cache.py`)
2. Rate limiting (добавить в `src/utils/rate_limiter.py`)
3. Batch UI (улучшить frontend)
4. BI интеграция (webhooks, API)

### Вклад в проект
Pull requests приветствуются:
- Новые отраслевые шаблоны
- Интеграции с другими системами
- Улучшения производительности
- Документация

---

## Заключение

Vision Agent Analyst — это мощный инструмент, который может сэкономить вашей команде сотни часов работы. Следуйте этим рекомендациям для максимальной пользы:

1. **Начните с малого** — пилот на 1-2 задачах
2. **Измеряйте результаты** — отслеживайте экономию времени
3. **Масштабируйте** — расширяйте на всю команду
4. **Оптимизируйте** — настраивайте под свои процессы

**Ожидаемый результат:** 85% экономия времени на рутинных задачах анализа визуальных данных.

---

**Успешного внедрения!**
