# RunningHub AI Studio

Web application for generating AI images using RunningHub ComfyUI workflows.

## Features

- 📋 Import ComfyUI Workflow JSON
- 🎨 Dynamic UI controls based on workflow nodes
- 📤 Image upload support for LoadImage nodes
- 🎲 Random seed generation
- 📊 Real-time generation progress
- 🖼️ Results gallery with download

## Deploy to Coolify

### Method 1: Docker (Recommended)

1. In Coolify, create new **Application** from GitHub
2. Select repository: `https://github.com/sonicleez/RunningHub`
3. Build Pack: **Dockerfile**
4. Port: `80`
5. Click **Deploy**

### Method 2: Static Site

1. In Coolify, create new **Static Site**
2. Select repository
3. Publish Directory: `/` (root)
4. Click **Deploy**

## Environment Variables

None required - API key is entered in the app settings.

## Local Development

```bash
# Start local server
python -m http.server 3000
# or
npx serve -l 3000
```

Open http://localhost:3000

## API Configuration

The app uses RunningHub API:
- Base URL: `https://www.runninghub.cn`
- Enter your API key in Settings (⚙️)

## License

MIT
