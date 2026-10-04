FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/cache/huggingface \
    OMP_NUM_THREADS=2 \
    MKL_NUM_THREADS=2

RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir pocket-tts==3.3.0

WORKDIR /output
ENTRYPOINT ["pocket-tts"]
CMD ["serve", "--host", "0.0.0.0", "--port", "8000"]
