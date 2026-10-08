package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestHandleHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	handleHealth(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var body healthResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "ok" || body.Service != "c-teacher-api" {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestHandleAnalyzeMistake(t *testing.T) {
	payload := []byte(`{"studentId":"chen","subject":"数学","questionText":"函数图像平移","studentAnswer":"向左"}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/ai/mistakes/analyze", bytes.NewReader(payload))
	rec := httptest.NewRecorder()

	handleAnalyzeMistake(mockAnalyzer{})(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body analyzeMistakeResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !body.TeacherReviewRequired {
		t.Fatal("expected teacher review to be required")
	}
	if body.QuestionText != "函数图像平移" {
		t.Fatalf("unexpected question text: %s", body.QuestionText)
	}
}

func TestHandleAnalyzeMistakeWithImagePath(t *testing.T) {
	payload := []byte(`{"studentId":"chen","subject":"数学","questionText":"","studentAnswer":"向左","imagePath":"/tmp/mistake.jpg"}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/ai/mistakes/analyze", bytes.NewReader(payload))
	rec := httptest.NewRecorder()

	handleAnalyzeMistake(mockAnalyzer{})(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body analyzeMistakeResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !strings.Contains(body.QuestionText, "mistake.jpg") {
		t.Fatalf("expected image file in question text, got: %s", body.QuestionText)
	}
}

func TestHandleAnalyzeMistakeRequiresStudentAndSubject(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/ai/mistakes/analyze", bytes.NewReader([]byte(`{"studentId":"chen"}`)))
	rec := httptest.NewRecorder()

	handleAnalyzeMistake(mockAnalyzer{})(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}
}

func TestOpenAIAnalyzerUsesResponsesAPI(t *testing.T) {
	stubKey := os.Getenv("TEST_OPENAI_API_KEY")
	var received map[string]interface{}
	client := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.String() != "https://example.test/v1/responses" {
				t.Fatalf("unexpected url: %s", r.URL.String())
			}
			if r.Header.Get("Authorization") != "Bearer "+stubKey {
				t.Fatalf("missing auth header")
			}
			if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
				t.Fatalf("decode request: %v", err)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body: io.NopCloser(strings.NewReader(
					`{"output_text":"{\"questionText\":\"函数图像平移\",\"correctAnswer\":\"参考答案，需教师确认\",\"mistakeReason\":\"条件抽取不稳定\",\"knowledgePoints\":[\"函数图像\"],\"similarQuestions\":[\"同类题 1\"],\"teacherReviewRequired\":true}"}`,
				)),
			}, nil
		}),
	}

	analyzer := openAIAnalyzer{
		apiKey:  stubKey,
		baseURL: "https://example.test/v1",
		model:   "gpt-test",
		client:  client,
	}

	result, err := analyzer.Analyze(context.Background(), analyzeMistakeRequest{
		StudentID:     "chen",
		Subject:       "数学",
		QuestionText:  "函数图像平移",
		StudentAnswer: "向左",
		ImagePath:     "/tmp/mistake.jpg",
	})
	if err != nil {
		t.Fatalf("analyze: %v", err)
	}

	if received["model"] != "gpt-test" {
		t.Fatalf("unexpected model: %+v", received["model"])
	}
	input := received["input"].([]interface{})
	userMessage := input[1].(map[string]interface{})
	content := userMessage["content"].([]interface{})
	userText := content[0].(map[string]interface{})["text"].(string)
	if !strings.Contains(userText, "/tmp/mistake.jpg") {
		t.Fatalf("expected image path in prompt, got: %s", userText)
	}
	if result.MistakeReason != "条件抽取不稳定" {
		t.Fatalf("unexpected result: %+v", result)
	}
	if !result.TeacherReviewRequired {
		t.Fatal("expected teacher review to be required")
	}
}
