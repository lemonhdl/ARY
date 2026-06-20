package controller

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/relay/adaptor/anthropic"
	"github.com/songquanpeng/one-api/relay/model"
)

// POST /v1/convert — 将任意格式请求转换为 OpenAI Chat Completions 格式
//
// 用法：
//
//	POST /v1/convert
//	Content-Type: application/json
//	X-Original-Format: anthropic    （可选，不传则自动检测）
//	{...原始请求体...}
//
// 响应：OpenAI Chat Completions 格式请求体
func Convert(c *gin.Context) {
	body, err := common.GetRequestBody(c)
	if err != nil || len(body) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty request body"})
		return
	}

	format := c.GetHeader("X-Original-Format")
	if format == "" {
		format = detectFormat(body)
	}

	logger.SysLogf("convert: detected format=%s", format)

	var openaiReq *model.GeneralOpenAIRequest

	switch format {
	case "anthropic":
		openaiReq, err = convertAnthropicToOpenAI(body)
	case "openai":
		// 已经是目标格式，直接透传
		var req model.GeneralOpenAIRequest
		if err = json.Unmarshal(body, &req); err == nil {
			openaiReq = &req
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error":          "unsupported format",
			"format":         format,
			"supported":      []string{"anthropic", "openai"},
			"originalBody":   string(body)[:minInt(500, len(body))],
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "conversion failed: " + err.Error(),
			"format":  format,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"format":       "openai",
		"originalFormat": format,
		"request":      openaiReq,
	})
}

func minInt(a, b int) int {
	if a < b { return a }
	return b
}

func detectFormat(body []byte) string {
	var probe map[string]any
	if err := json.Unmarshal(body, &probe); err != nil {
		return "unknown"
	}

	// Anthropic: messages[].content 是数组 [{type, text}]
	if msgs, ok := probe["messages"].([]any); ok && len(msgs) > 0 {
		if msg, ok := msgs[0].(map[string]any); ok {
			if content, ok := msg["content"].([]any); ok && len(content) > 0 {
				if _, ok := content[0].(map[string]any); ok {
					if typ, _ := content[0].(map[string]any)["type"].(string); typ != "" {
						return "anthropic"
					}
				}
			}
		}
	}

	// OpenAI: messages[].role 存在，content 是字符串
	if msgs, ok := probe["messages"].([]any); ok && len(msgs) > 0 {
		if msg, ok := msgs[0].(map[string]any); ok {
			if role, _ := msg["role"].(string); role != "" {
				return "openai"
			}
		}
	}

	return "unknown"
}

func convertAnthropicToOpenAI(body []byte) (*model.GeneralOpenAIRequest, error) {
	var anthropicReq struct {
		Model         string                   `json:"model"`
		Messages      []anthropic.Message      `json:"messages"`
		System        any                      `json:"system"`
		MaxTokens     int                      `json:"max_tokens"`
		StopSequences []string                 `json:"stop_sequences"`
		Temperature   *float64                 `json:"temperature"`
		TopP          *float64                 `json:"top_p"`
		Stream        bool                     `json:"stream"`
		Tools         []anthropic.Tool         `json:"tools"`
	}
	if err := json.Unmarshal(body, &anthropicReq); err != nil {
		return nil, err
	}

	openaiReq := &model.GeneralOpenAIRequest{
		Model:    anthropicReq.Model,
		Stream:   anthropicReq.Stream,
	}

	if anthropicReq.MaxTokens > 0 {
		openaiReq.MaxTokens = anthropicReq.MaxTokens
	}

	// System → messages[0].role=system
	var messages []model.Message
	if sys := anthropicReq.System; sys != nil {
		msg := model.Message{Role: "system"}
		switch s := sys.(type) {
		case string:
			msg.Content = s
		case []any:
			var parts []string
			for _, block := range s {
				if b, ok := block.(map[string]any); ok {
					if t, _ := b["type"].(string); t == "text" {
						if txt, _ := b["text"].(string); txt != "" {
							parts = append(parts, txt)
						}
					}
				}
			}
			msg.Content = strings.Join(parts, "\n")
		}
		messages = append(messages, msg)
	}

	// Messages
	for _, m := range anthropicReq.Messages {
		msg := model.Message{Role: m.Role}

		// Extract text content
		var contentParts []string
		for _, block := range m.Content {
			if block.Type == "text" && block.Text != "" {
				contentParts = append(contentParts, block.Text)
			} else if block.Type == "image" && block.Source != nil {
				contentParts = append(contentParts, "[image: "+block.Source.MediaType+"]")
			}
		}
		if m.Role == "user" {
			msg.Content = strings.Join(contentParts, "")
		} else if m.Role == "assistant" {
			// Assistant messages may have tool_use blocks
			var toolCalls []model.Tool
			for _, block := range m.Content {
				if block.Type == "tool_use" && block.Name != "" {
					tc := model.Tool{
						Id:   block.Id,
						Type: "function",
						Function: model.Function{
							Name:      block.Name,
							Arguments: block.Input,
						},
					}
					toolCalls = append(toolCalls, tc)
				}
			}
			if len(toolCalls) > 0 {
				msg.ToolCalls = toolCalls
				msg.Content = strings.Join(contentParts, "\n")
			} else {
				msg.Content = strings.Join(contentParts, "")
			}
		}
		messages = append(messages, msg)
	}
	openaiReq.Messages = messages

	// Tools
	if len(anthropicReq.Tools) > 0 {
		for _, t := range anthropicReq.Tools {
			tool := model.Tool{
				Type: "function",
				Function: model.Function{
					Name:        t.Name,
					Description: t.Description,
					Parameters:  t.InputSchema,
				},
			}
			openaiReq.Tools = append(openaiReq.Tools, tool)
		}
	}

	return openaiReq, nil
}
