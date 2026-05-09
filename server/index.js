const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, '..', 'data');
const POSES_PATH = path.join(DATA_DIR, 'poses.json');
const QUOTES_PATH = path.join(DATA_DIR, 'quotes.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const allowedTagKeys = ['type', 'emotion', 'scene', 'clothing', 'props', 'people_count'];

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function validatePose(pose) {
  if (!pose || typeof pose !== 'object') return false;
  if (!pose.id || !pose.title || !pose.tags || !pose.key_points || !pose.guide_details) return false;
  if (!Array.isArray(pose.key_points) || typeof pose.guide_details !== 'string') return false;
  for (const key of allowedTagKeys) {
    const v = pose.tags[key];
    if (!Array.isArray(v) || v.length === 0) return false;
  }
  return true;
}

function validateQuote(quote) {
  return !!(quote && quote.id && quote.content && quote.author);
}

function loadData() {
  const poses = readJson(POSES_PATH);
  const quotes = readJson(QUOTES_PATH);

  if (!Array.isArray(poses) || !poses.every(validatePose)) {
    throw new Error('poses.json 数据结构不合法');
  }
  if (!Array.isArray(quotes) || !quotes.every(validateQuote)) {
    throw new Error('quotes.json 数据结构不合法');
  }

  return { poses, quotes };
}

function toPublicPose(pose) {
  return {
    id: pose.id,
    title: pose.title,
    image_url: pose.image_url,
    icon: pose.icon || '📷',
    tags: pose.tags,
    key_points: pose.key_points,
    guide_details: pose.guide_details
  };
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function filterPoses(poses, query) {
  return poses.filter((pose) => {
    return allowedTagKeys.every((key) => {
      const wanted = query[key];
      if (!wanted) return true;
      return pose.tags[key].includes(wanted);
    });
  });
}

function ok(res, data, message = 'ok') {
  res.json({ success: true, data, message });
}

function fail(res, status, message) {
  res.status(status).json({ success: false, data: null, message });
}

app.get('/api/poses', (req, res) => {
  try {
    const { poses } = loadData();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '9', 10), 1), 50);

    const filtered = filterPoses(poses, req.query);
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize).map(toPublicPose);

    return ok(res, {
      items: pageItems,
      pagination: {
        page,
        pageSize,
        total: filtered.length,
        totalPages: Math.max(Math.ceil(filtered.length / pageSize), 1)
      }
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

app.get('/api/poses/random', (req, res) => {
  try {
    const { poses } = loadData();
    const filtered = filterPoses(poses, req.query);
    if (!filtered.length) {
      return fail(res, 404, '当前筛选条件下没有姿势数据');
    }
    return ok(res, toPublicPose(pickRandom(filtered)));
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

app.get('/api/poses/:id', (req, res) => {
  try {
    const { poses } = loadData();
    const pose = poses.find((p) => p.id === req.params.id);
    if (!pose) {
      return fail(res, 404, '姿势不存在');
    }
    return ok(res, toPublicPose(pose));
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

app.get('/api/quotes/random', (req, res) => {
  try {
    const { quotes } = loadData();
    const excludeId = req.query.excludeId;
    const filtered = excludeId ? quotes.filter((q) => q.id !== excludeId) : quotes;
    const pool = filtered.length ? filtered : quotes;
    return ok(res, pickRandom(pool));
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
