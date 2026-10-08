package main

import (
	"bytes"
	"context"
	"crypto"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type healthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Timestamp string `json:"timestamp"`
}

type analyzeMistakeRequest struct {
	StudentID     string `json:"studentId"`
	Subject       string `json:"subject"`
	QuestionText  string `json:"questionText"`
	StudentAnswer string `json:"studentAnswer"`
	ImagePath     string `json:"imagePath,omitempty"`
}

type analyzeMistakeResponse struct {
	QuestionText          string   `json:"questionText"`
	CorrectAnswer         string   `json:"correctAnswer"`
	MistakeReason         string   `json:"mistakeReason"`
	KnowledgePoints       []string `json:"knowledgePoints"`
	SimilarQuestions      []string `json:"similarQuestions"`
	TeacherReviewRequired bool     `json:"teacherReviewRequired"`
}

type mistakeAnalyzer interface {
	Analyze(ctx context.Context, req analyzeMistakeRequest) (analyzeMistakeResponse, error)
}

type mockAnalyzer struct{}

type openAIAnalyzer struct {
	apiKey  string
	baseURL string
	model   string
	client  *http.Client
}

type openAIResponseRequest struct {
	Model string                 `json:"model"`
	Input []openAIInputMessage   `json:"input"`
	Text  openAITextConfig       `json:"text"`
	Meta  map[string]interface{} `json:"metadata,omitempty"`
}

type openAIInputMessage struct {
	Role    string               `json:"role"`
	Content []openAIInputContent `json:"content"`
}

type openAIInputContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type openAITextConfig struct {
	Format openAITextFormat `json:"format"`
}

type openAITextFormat struct {
	Type        string                 `json:"type"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Strict      bool                   `json:"strict"`
	Schema      map[string]interface{} `json:"schema"`
}

type openAIResponseEnvelope struct {
	OutputText string               `json:"output_text"`
	Output     []openAIOutputObject `json:"output"`
}

type openAIOutputObject struct {
	Type    string                `json:"type"`
	Content []openAIOutputContent `json:"content"`
}

type openAIOutputContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// --- Mobile upload types ---

type uploadResponse struct {
	OK       bool   `json:"ok"`
	Path     string `json:"path,omitempty"`
	Filename string `json:"filename,omitempty"`
	Error    string `json:"error,omitempty"`
}

type wsMessage struct {
	Type     string `json:"type"`
	Path     string `json:"path,omitempty"`
	Filename string `json:"filename,omitempty"`
	Size     int64  `json:"size,omitempty"`
	Time     string `json:"time,omitempty"`
}

type uploadHub struct {
	mu      sync.RWMutex
	clients map[chan []byte]struct{}
}

func newUploadHub() *uploadHub {
	return &uploadHub{clients: make(map[chan []byte]struct{})}
}

func (h *uploadHub) subscribe() chan []byte {
	ch := make(chan []byte, 16)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *uploadHub) unsubscribe(ch chan []byte) {
	h.mu.Lock()
	delete(h.clients, ch)
	h.mu.Unlock()
}

func (h *uploadHub) broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.clients {
		select {
		case ch <- msg:
		default:
		}
	}
}

var uploadsDir string

const maxUploadBytes = 8 << 20 // 8 MB

func main() {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("resolve home dir: %v", err)
	}
	uploadsDir = filepath.Join(homeDir, ".c-teacher", "uploads")
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		log.Fatalf("create uploads dir: %v", err)
	}

	hub := newUploadHub()
	analyzer := analyzerFromEnv()
	mux := newMux(analyzer, hub)
	addr := env("C_TEACHER_API_ADDR", "0.0.0.0:18080")
	server := &http.Server{
		Addr:              addr,
		Handler:           withCORS(withJSON(mux)),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("C-teacher API listening on http://%s", addr)
	log.Printf("  Uploads dir: %s", uploadsDir)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func newMux(analyzer mistakeAnalyzer, hub *uploadHub) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("POST /v1/ai/mistakes/analyze", handleAnalyzeMistake(analyzer))
	mux.HandleFunc("POST /v1/upload/image", handleUploadImage(hub))
	mux.HandleFunc("GET /ws/uploads", handleUploadWebSocket(hub))
	mux.HandleFunc("GET /mobile", handleMobilePage())
	return mux
}

// --- Upload handler ---

func handleUploadImage(hub *uploadHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)

		if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(uploadResponse{OK: false, Error: "图片过大或格式错误（最大 8MB）"})
			return
		}

		file, header, err := r.FormFile("image")
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(uploadResponse{OK: false, Error: "未找到图片字段"})
			return
		}
		defer file.Close()

		ext := strings.ToLower(filepath.Ext(header.Filename))
		allowed := map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".webp": true}
		if !allowed[ext] {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(uploadResponse{OK: false, Error: "仅支持 png/jpg/jpeg/webp 格式"})
			return
		}

		safeName := fmt.Sprintf("mistake_%d%s", time.Now().UnixMilli(), ext)
		destPath := filepath.Join(uploadsDir, safeName)

		dst, err := os.Create(destPath)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(uploadResponse{OK: false, Error: "保存图片失败"})
			return
		}
		defer dst.Close()

		written, err := io.Copy(dst, file)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(uploadResponse{OK: false, Error: "写入图片失败"})
			return
		}

		// Broadcast to WebSocket clients
		msg, _ := json.Marshal(wsMessage{
			Type:     "new_upload",
			Path:     destPath,
			Filename: safeName,
			Size:     written,
			Time:     time.Now().Format(time.RFC3339),
		})
		hub.broadcast(msg)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(uploadResponse{
			OK:       true,
			Path:     destPath,
			Filename: safeName,
		})

		log.Printf("upload received: %s (%d bytes)", safeName, written)
	}
}

// --- WebSocket handler (no external deps) ---

var wsMagicGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

func handleUploadWebSocket(hub *uploadHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := wsUpgrade(w, r)
		if err != nil {
			log.Printf("ws upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		ch := hub.subscribe()
		defer hub.unsubscribe(ch)

		// Send initial connected message
		connected, _ := json.Marshal(wsMessage{Type: "connected", Time: time.Now().Format(time.RFC3339)})
		wsWriteFrame(conn, connected)

		// Write loop — push broadcast messages
		for msg := range ch {
			if err := wsWriteFrame(conn, msg); err != nil {
				return
			}
		}
	}
}

func wsUpgrade(w http.ResponseWriter, r *http.Request) (net.Conn, error) {
	key := r.Header.Get("Sec-WebSocket-Key")
	if key == "" {
		http.Error(w, "missing Sec-WebSocket-Key", http.StatusBadRequest)
		return nil, errors.New("missing key")
	}

	// RFC 6455 规定 WebSocket 握手必须用 SHA-1 计算 Sec-WebSocket-Accept
	hash := crypto.SHA1.New()
	hash.Write([]byte(strings.TrimSpace(key) + wsMagicGUID))
	accept := base64.StdEncoding.EncodeToString(hash.Sum(nil))

	hj, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "server does not support hijacking", http.StatusInternalServerError)
		return nil, errors.New("no hijack")
	}

	conn, bufrw, err := hj.Hijack()
	if err != nil {
		return nil, err
	}

	resp := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + accept + "\r\n" +
		"\r\n"

	if _, err := bufrw.WriteString(resp); err != nil {
		conn.Close()
		return nil, err
	}
	if err := bufrw.Flush(); err != nil {
		conn.Close()
		return nil, err
	}

	return conn, nil
}

func wsWriteFrame(conn net.Conn, payload []byte) error {
	// Text frame, FIN=1, opcode=1, masked=0 (server→client)
	frame := []byte{0x81}
	length := len(payload)
	if length <= 125 {
		frame = append(frame, byte(length))
	} else if length <= 65535 {
		frame = append(frame, 126, byte(length>>8), byte(length))
	} else {
		frame = append(frame, 127,
			byte(length>>56), byte(length>>48), byte(length>>40), byte(length>>32),
			byte(length>>24), byte(length>>16), byte(length>>8), byte(length))
	}
	frame = append(frame, payload...)
	_, err := conn.Write(frame)
	return err
}

// --- Mobile capture page ---

func handleMobilePage() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(mobileCaptureHTML))
	}
}

const mobileCaptureHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>拍照传题 · C-teacher</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f1923;color:#e0e0e0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;padding:16px 16px 32px}
header{text-align:center;margin-bottom:20px}
h1{font-size:22px;color:#fff;margin-bottom:4px}
h1 span{color:#4fc3f7}
.sub{color:#78909c;font-size:13px}
/* Preview area */
.preview{width:100%;max-width:400px;aspect-ratio:4/3;background:#1a2733;border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:20px;border:2px dashed #263238;position:relative}
.preview img{width:100%;height:100%;object-fit:contain}
.preview .empty{color:#455a64;font-size:14px;text-align:center;line-height:1.6}
.preview .empty svg{display:block;margin:0 auto 8px;opacity:.4}
/* Controls */
.controls{width:100%;max-width:400px;display:flex;gap:10px;margin-bottom:14px}
.btn{flex:1;padding:14px 12px;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s}
.btn:active{transform:scale(.97);opacity:.85}
.btn:disabled{opacity:.35;pointer-events:none}
.btn-camera{background:#1565c0;color:#fff}
.btn-upload{background:#263238;color:#b0bec5}
.btn-send{width:100%;max-width:400px;padding:16px;border:none;border-radius:14px;font-size:17px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,#0d47a1,#1565c0);color:#fff;margin-bottom:12px;transition:all .15s}
.btn-send:active{transform:scale(.97)}
.btn-send:disabled{background:#263238;color:#546e7a}
/* Status */
.status{width:100%;max-width:400px;text-align:center;font-size:13px;min-height:20px;padding:6px 0}
.status.ok{color:#66bb6a}
.status.err{color:#ef5350}
.status.info{color:#78909c}
/* Subject picker */
.picker-row{width:100%;max-width:400px;display:flex;gap:8px;margin-bottom:14px}
.picker{flex:1;padding:10px 12px;background:#1a2733;border:1px solid #263238;border-radius:10px;color:#e0e0e0;font-size:14px;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2378909c' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
.picker:focus{outline:none;border-color:#1565c0}
/* Progress bar */
.progress-wrap{width:100%;max-width:400px;height:4px;background:#263238;border-radius:2px;margin-bottom:10px;overflow:hidden;display:none}
.progress-wrap.active{display:block}
.progress-bar{height:100%;width:0;background:#4fc3f7;border-radius:2px;transition:width .3s}
/* Count badge */
.count{position:absolute;top:10px;right:10px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;padding:3px 8px;border-radius:10px;display:none}
#file-input{display:none}

@media (prefers-color-scheme: light) {
  body{background:#f5f5f5;color:#333}
  .preview{background:#fff;border-color:#e0e0e0}
  .preview .empty{color:#999}
  .btn-upload{background:#e0e0e0;color:#666}
  .picker{background:#fff;border-color:#ddd;color:#333}
  .btn-send:disabled{background:#eee;color:#bbb}
  .progress-wrap{background:#eee}
}
</style>
</head>
<body>
<header>
  <h1><span>📸</span> 拍照传题</h1>
  <p class="sub">拍照后发送到 C-teacher 桌面端进行 AI 分析</p>
</header>

<div class="preview" id="preview">
  <div class="empty" id="empty-state">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
    点击下方按钮拍照或选图
  </div>
</div>

<div class="count" id="queue-count">0</div>

<div class="picker-row">
  <select class="picker" id="subject-picker">
    <option value="">科目（可选）</option>
    <option value="数学">数学</option><option value="语文">语文</option><option value="英语">英语</option>
    <option value="物理">物理</option><option value="化学">化学</option><option value="生物">生物</option>
    <option value="历史">历史</option><option value="地理">地理</option><option value="政治">政治</option>
  </select>
</div>

<div class="controls">
  <button class="btn btn-camera" onclick="document.getElementById('camera-input').click()">📷 拍照</button>
  <button class="btn btn-upload" onclick="document.getElementById('gallery-input').click()">🖼️ 选图</button>
</div>
<input type="file" id="camera-input" accept="image/*" capture="environment" onchange="handleFileSelect(this)" style="display:none">
<input type="file" id="gallery-input" accept="image/*" onchange="handleFileSelect(this)" style="display:none">

<button class="btn btn-send" id="send-btn" disabled onclick="uploadImage()">
  📤 发送到桌面端
</button>

<div class="progress-wrap" id="progress-wrap"><div class="progress-bar" id="progress-bar"></div></div>
<div class="status" id="status"></div>

<script>
let selectedFile = null;

function setStatus(msg, cls) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status ' + (cls || 'info');
}

function showPreview(src) {
  document.getElementById('preview').innerHTML = '<img src="' + src + '" alt="preview">';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('send-btn').disabled = false;
}

async function captureFromCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    stream.getTracks().forEach(t => t.stop());

    canvas.toBlob(function(blob) {
      selectedFile = new File([blob], 'camera_' + Date.now() + '.jpg', { type: 'image/jpeg' });
      const reader = new FileReader();
      reader.onload = function(e) { showPreview(e.target.result); };
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.85);

    setStatus('已拍照，点击发送上传', 'ok');
  } catch(e) {
    // Fallback to camera file input
    document.getElementById('camera-input').click();
    setStatus('相机权限未授予，已切换到选图模式', 'info');
  }
}

function handleFileSelect(input) {
  if (input.files && input.files[0]) {
    selectedFile = input.files[0];

    // Compress if > 2MB
    if (selectedFile.size > 2 * 1024 * 1024) {
      compressAndPreview(selectedFile);
    } else {
      const reader = new FileReader();
      reader.onload = function(e) { showPreview(e.target.result); };
      reader.readAsDataURL(selectedFile);
    }
    setStatus('已选择: ' + selectedFile.name, 'ok');
  }
}

function compressAndPreview(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const maxW = 1920;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(function(blob) {
        selectedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
        showPreview(canvas.toDataURL('image/jpeg', 0.85));
        setStatus('已压缩 (原 ' + (file.size/1024/1024).toFixed(1) + 'MB → ' + (blob.size/1024/1024).toFixed(1) + 'MB)', 'info');
      }, 'image/jpeg', 0.85);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function uploadImage() {
  if (!selectedFile) return;
  const btn = document.getElementById('send-btn');
  const progressWrap = document.getElementById('progress-wrap');
  const progressBar = document.getElementById('progress-bar');

  btn.disabled = true;
  btn.textContent = '⏳ 上传中...';
  progressWrap.classList.add('active');
  progressBar.style.width = '30%';
  setStatus('正在上传...', 'info');

  const form = new FormData();
  form.append('image', selectedFile);
  const subject = document.getElementById('subject-picker').value;
  if (subject) form.append('subject', subject);

  try {
    const xhr = new XMLHttpRequest();
    const result = await new Promise(function(resolve, reject) {
      xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
          progressBar.style.width = Math.round(30 + 70 * e.loaded / e.total) + '%';
        }
      });
      xhr.addEventListener('load', function() {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch(e) { reject(new Error('解析响应失败')); }
      });
      xhr.addEventListener('error', function() { reject(new Error('网络错误')); });
      xhr.open('POST', '/v1/upload/image');
      xhr.send(form);
    });

    progressBar.style.width = '100%';

    if (result.ok) {
      setStatus('✅ 发送成功！桌面端已收到: ' + result.filename, 'ok');
      selectedFile = null;
      document.getElementById('camera-input').value = '';
      document.getElementById('gallery-input').value = '';
      document.getElementById('preview').innerHTML = '<div class="empty" id="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>可继续拍照</div>';
    } else {
      throw new Error(result.error || '上传失败');
    }
  } catch(e) {
    setStatus('❌ ' + e.message, 'err');
  } finally {
    btn.disabled = !selectedFile;
    btn.textContent = selectedFile ? '📤 发送到桌面端' : '📤 发送到桌面端';
    setTimeout(function() { progressWrap.classList.remove('active'); progressBar.style.width = '0'; }, 800);
  }
}
</script>
</body>
</html>`

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	_ = json.NewEncoder(w).Encode(healthResponse{
		Status:    "ok",
		Service:   "c-teacher-api",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

func handleAnalyzeMistake(analyzer mistakeAnalyzer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req analyzeMistakeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json body", http.StatusBadRequest)
			return
		}
		if req.StudentID == "" || req.Subject == "" {
			http.Error(w, "studentId and subject are required", http.StatusBadRequest)
			return
		}

		result, err := analyzer.Analyze(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		_ = json.NewEncoder(w).Encode(result)
	}
}

func (mockAnalyzer) Analyze(_ context.Context, req analyzeMistakeRequest) (analyzeMistakeResponse, error) {
	return analyzeMistakeResponse{
		QuestionText:          fallback(req.QuestionText, fallback(imageQuestionText(req.ImagePath), "待识别题干")),
		CorrectAnswer:         "待教师确认的参考答案",
		MistakeReason:         "AI 初步判断：概念理解基本到位，但关键条件抽取不稳定。",
		KnowledgePoints:       []string{req.Subject + "核心概念", "题干条件抽取"},
		SimilarQuestions:      []string{"同知识点基础题 1", "同题型变式题 1", "综合应用题 1"},
		TeacherReviewRequired: true,
	}, nil
}

func (analyzer openAIAnalyzer) Analyze(ctx context.Context, req analyzeMistakeRequest) (analyzeMistakeResponse, error) {
	payload, err := json.Marshal(openAIResponseRequest{
		Model: analyzer.model,
		Input: []openAIInputMessage{
			{
				Role: "system",
				Content: []openAIInputContent{{
					Type: "input_text",
					Text: "你是教师的错题分析助手。只输出符合 JSON Schema 的结果，所有结论都标记为需要教师确认，不直接替代教师判断。",
				}},
			},
			{
				Role: "user",
				Content: []openAIInputContent{{
					Type: "input_text",
					Text: buildMistakePrompt(req),
				}},
			},
		},
		Text: openAITextConfig{
			Format: openAITextFormat{
				Type:        "json_schema",
				Name:        "mistake_analysis",
				Description: "C-teacher 错题分析结果",
				Strict:      true,
				Schema:      mistakeAnalysisSchema(),
			},
		},
		Meta: map[string]interface{}{
			"feature":   "mistake_analysis",
			"studentId": req.StudentID,
			"subject":   req.Subject,
		},
	})
	if err != nil {
		return analyzeMistakeResponse{}, fmt.Errorf("encode openai request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(analyzer.baseURL, "/")+"/responses", bytes.NewReader(payload))
	if err != nil {
		return analyzeMistakeResponse{}, fmt.Errorf("create openai request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+analyzer.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	httpClient := analyzer.client
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 45 * time.Second}
	}
	response, err := httpClient.Do(httpReq)
	if err != nil {
		return analyzeMistakeResponse{}, fmt.Errorf("call openai responses api: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return analyzeMistakeResponse{}, fmt.Errorf("read openai response: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return analyzeMistakeResponse{}, fmt.Errorf("openai responses api returned %d: %s", response.StatusCode, string(body))
	}

	var envelope openAIResponseEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return analyzeMistakeResponse{}, fmt.Errorf("decode openai response: %w", err)
	}
	text := extractResponseText(envelope)
	if text == "" {
		return analyzeMistakeResponse{}, errors.New("openai response did not include output text")
	}

	var result analyzeMistakeResponse
	if err := json.Unmarshal([]byte(text), &result); err != nil {
		return analyzeMistakeResponse{}, fmt.Errorf("decode openai structured output: %w", err)
	}
	if result.QuestionText == "" {
		result.QuestionText = fallback(req.QuestionText, fallback(imageQuestionText(req.ImagePath), "待识别题干"))
	}
	result.TeacherReviewRequired = true
	return result, nil
}

func analyzerFromEnv() mistakeAnalyzer {
	provider := strings.ToLower(env("C_TEACHER_AI_PROVIDER", "mock"))
	if provider != "openai" {
		return mockAnalyzer{}
	}
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		log.Println("C_TEACHER_AI_PROVIDER=openai but OPENAI_API_KEY is missing; falling back to mock analyzer")
		return mockAnalyzer{}
	}
	return openAIAnalyzer{
		apiKey:  apiKey,
		baseURL: env("C_TEACHER_OPENAI_BASE_URL", "https://api.openai.com/v1"),
		model:   env("C_TEACHER_OPENAI_MODEL", "gpt-5.2"),
		client:  &http.Client{Timeout: 45 * time.Second},
	}
}

func buildMistakePrompt(req analyzeMistakeRequest) string {
	return fmt.Sprintf(`请分析下面这道错题，输出:
- questionText: 原题或题干摘要
- correctAnswer: 参考答案，必须提醒教师确认
- mistakeReason: 错因分析
- knowledgePoints: 相关知识点
- similarQuestions: 可继续练习的类似题型
- teacherReviewRequired: 必须为 true

学生 ID: %s
科目: %s
题目: %s
错题图片路径: %s
学生答案: %s`, req.StudentID, req.Subject, fallback(req.QuestionText, fallback(imageQuestionText(req.ImagePath), "待识别题干")), fallback(req.ImagePath, "未提供"), fallback(req.StudentAnswer, "待补充"))
}

func imageQuestionText(imagePath string) string {
	if strings.TrimSpace(imagePath) == "" {
		return ""
	}
	parts := strings.FieldsFunc(imagePath, func(r rune) bool {
		return r == '/' || r == '\\'
	})
	if len(parts) == 0 {
		return "图片错题"
	}
	return "图片错题：" + parts[len(parts)-1]
}

func mistakeAnalysisSchema() map[string]interface{} {
	return map[string]interface{}{
		"type":                 "object",
		"additionalProperties": false,
		"required": []string{
			"questionText",
			"correctAnswer",
			"mistakeReason",
			"knowledgePoints",
			"similarQuestions",
			"teacherReviewRequired",
		},
		"properties": map[string]interface{}{
			"questionText":  map[string]interface{}{"type": "string"},
			"correctAnswer": map[string]interface{}{"type": "string"},
			"mistakeReason": map[string]interface{}{"type": "string"},
			"knowledgePoints": map[string]interface{}{
				"type":  "array",
				"items": map[string]interface{}{"type": "string"},
			},
			"similarQuestions": map[string]interface{}{
				"type":  "array",
				"items": map[string]interface{}{"type": "string"},
			},
			"teacherReviewRequired": map[string]interface{}{"type": "boolean"},
		},
	}
}

func extractResponseText(envelope openAIResponseEnvelope) string {
	if envelope.OutputText != "" {
		return envelope.OutputText
	}
	for _, output := range envelope.Output {
		for _, content := range output.Content {
			if content.Text != "" {
				return content.Text
			}
		}
	}
	return ""
}

func withJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		next.ServeHTTP(w, r)
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:1420")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func env(key string, fallbackValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallbackValue
	}
	return value
}

func fallback(value string, fallbackValue string) string {
	if value == "" {
		return fallbackValue
	}
	return value
}
