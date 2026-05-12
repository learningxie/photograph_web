const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const POSES_PATH = path.join(DATA_DIR, 'poses.json');
const QUOTES_PATH = path.join(DATA_DIR, 'quotes.json');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

const allowedTagKeys = ['type', 'emotion', 'scene', 'clothing', 'props', 'people_count'];
const editableTagKeys = ['emotion', 'scene', 'clothing', 'props', 'people_count'];
const editableTagLabels = {
  emotion: '情绪风格',
  scene: '场景分类',
  clothing: '服装搭配',
  props: '使用道具',
  people_count: '出镜人数'
};
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `pose-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!imageMimeTypes.has(file.mimetype)) {
      return cb(new Error('只支持 JPG、PNG、WEBP 或 GIF 图片'));
    }
    return cb(null, true);
  }
});

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
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

function collectPoseTags(poses) {
  return editableTagKeys.reduce((acc, key) => {
    const values = new Set();
    poses.forEach((pose) => {
      (pose.tags[key] || []).forEach((tag) => values.add(tag));
    });
    acc[key] = Array.from(values).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    return acc;
  }, {});
}

function toArrayField(body, key) {
  const raw = body[`${key}[]`] ?? body[key];
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .flatMap((value) => String(value || '').split(/[,\n，、]/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseKeyPoints(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueValues(values) {
  return Array.from(new Set(values));
}

function collectEditableFields(body) {
  const tags = {};
  editableTagKeys.forEach((key) => {
    const values = uniqueValues(toArrayField(body, key));
    if (!values.length) {
      throw new Error(`请至少选择或新增一个${editableTagLabels[key]}标签`);
    }
    tags[key] = values;
  });

  const key_points = parseKeyPoints(body.key_points);
  const guide_details = String(body.guide_details || '').trim();

  if (!key_points.length) throw new Error('请至少填写一条姿势要领');
  if (!guide_details) throw new Error('请填写引导详解');

  return { tags, key_points, guide_details };
}

function nextPoseId(poses) {
  const max = poses.reduce((currentMax, pose) => {
    const match = String(pose.id || '').match(/^p(\d+)$/);
    return match ? Math.max(currentMax, Number(match[1])) : currentMax;
  }, 0);
  return `p${String(max + 1).padStart(3, '0')}`;
}

function removeUploadedFile(file) {
  if (!file) return;
  fs.unlink(file.path, () => {});
}

function ok(res, data, message = 'ok') {
  res.json({ success: true, data, message });
}

function fail(res, status, message) {
  res.status(status).json({ success: false, data: null, message });
}

app.get('/api/pose-tags', (req, res) => {
  try {
    const { poses } = loadData();
    return ok(res, collectPoseTags(poses));
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

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

app.get('/api/admin/poses', (req, res) => {
  try {
    const { poses } = loadData();
    return ok(res, poses.map(toPublicPose));
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

app.post('/api/poses', (req, res) => {
  upload.single('image')(req, res, (uploadError) => {
    if (uploadError) {
      return fail(res, 400, uploadError.message);
    }

    try {
      const { poses } = loadData();
      const title = String(req.body.title || '').trim();

      if (!req.file) throw new Error('请上传姿势图片');
      if (!title) throw new Error('请填写姿势标题');
      const { tags, key_points, guide_details } = collectEditableFields(req.body);

      const pose = {
        id: nextPoseId(poses),
        title,
        image_url: `/uploads/${req.file.filename}`,
        icon: '📷',
        tags: { type: ['通用'], ...tags },
        key_points,
        guide_details
      };

      if (!validatePose(pose)) {
        throw new Error('姿势数据结构不合法');
      }

      poses.push(pose);
      writeJson(POSES_PATH, poses);
      return ok(res, toPublicPose(pose), '姿势已添加');
    } catch (error) {
      removeUploadedFile(req.file);
      return fail(res, 400, error.message);
    }
  });
});

app.put('/api/poses/:id', (req, res) => {
  try {
    const { poses } = loadData();
    const index = poses.findIndex((pose) => pose.id === req.params.id);
    if (index === -1) {
      return fail(res, 404, '姿势不存在');
    }

    const current = poses[index];
    const { tags, key_points, guide_details } = collectEditableFields(req.body);
    const updated = {
      ...current,
      tags: {
        ...current.tags,
        ...tags,
        type: current.tags?.type?.length ? current.tags.type : ['通用']
      },
      key_points,
      guide_details
    };

    if (!validatePose(updated)) {
      return fail(res, 400, '姿势数据结构不合法');
    }

    poses[index] = updated;
    writeJson(POSES_PATH, poses);
    return ok(res, toPublicPose(updated), '姿势已更新');
  } catch (error) {
    return fail(res, 400, error.message);
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
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
