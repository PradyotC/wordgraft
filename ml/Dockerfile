FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the spaCy medium model
RUN python -m spacy download en_core_web_md

COPY app.py .

EXPOSE 5000

CMD ["python", "app.py"]
