package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
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

func main() {
	mux := newMux(analyzerFromEnv())
	addr := env("C_TEACHER_API_ADDR", "127.0.0.1:18080")
	server := &http.Server{
		Addr:              addr,
		Handler:           withCORS(withJSON(mux)),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("C-teacher API listening on http://%s", addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func newMux(analyzer mistakeAnalyzer) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("POST /v1/ai/mistakes/analyze", handleAnalyzeMistake(analyzer))
	return mux
}

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
