# Troubleshooting

Ports busy
- Free ports: `lsof -ti:3000 | xargs kill -9` and `lsof -ti:3002 | xargs kill -9`.

Backend won't start
- Check `custom-widget/backend/.env`. Required: `PORT`, AI provider vars.
- Run from backend dir: `npm install`, then `npm start`.

Widget not loading
- Open `http://localhost:3002/embed-widget.html` directly.
- Check browser console for CORS or network errors.

AI suggestions missing
- Verify Flowise/OpenRouter env vars.
- Hit `/health` and `/api/config` to confirm backend status.

WebSocket issues
- Confirm the page is loaded from `localhost:3002` or allowed origin.
- Network tab → WS frames for errors.
