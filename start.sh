docker stop 9router
docker rm 9router
docker build -t 9router .
docker run -d --name 9router -p 20128:20128 --env-file .env -e HOME=/home/node -e DATA_DIR=/app/data \
  -v 9router-data:/app/data \
  -v /root/.hermes:/home/node/.hermes \
  -v /root/.claude:/home/node/.claude \
  -v /root/.codex:/home/node/.codex \
  -v /root/.cline:/home/node/.cline \
  -v /root/.factory:/home/node/.factory \
  -v /root/.gemini:/home/node/.gemini \
  -v /root/.jcode:/home/node/.jcode \
  -v /root/.deepseek:/home/node/.deepseek \
  -v /root/.openclaw:/home/node/.openclaw \
  -v /root/.config:/home/node/.config \
  -v /root/.local:/home/node/.local \
  9router