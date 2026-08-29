package mcp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// defaultFirecrawlAPIKey 内置 Firecrawl 远端 MCP 的出厂默认 Key, 用户可在 MCP 服务器设置里覆盖。
const defaultFirecrawlAPIKey = "fc-40a5b7cda0174a26bd1501f2e0e5fa47"

// EmbeddedServerSettings 内置 MCP 服务器的用户可配置项。
// 与外置 mcp_servers.json 分离: 内置服务器本身只读, 这里只存少量可调参数。
type EmbeddedServerSettings struct {
	FirecrawlAPIKey string `json:"firecrawlApiKey,omitempty"`
}

func EmbeddedServerSettingsPath(configDir string) string {
	return filepath.Join(configDir, "mcp_embedded_settings.json")
}

func NormalizeEmbeddedServerSettings(settings EmbeddedServerSettings) EmbeddedServerSettings {
	settings.FirecrawlAPIKey = strings.TrimSpace(settings.FirecrawlAPIKey)
	if settings.FirecrawlAPIKey == "" {
		settings.FirecrawlAPIKey = defaultFirecrawlAPIKey
	}
	return settings
}

func LoadEmbeddedServerConfigSettings(configDir string) EmbeddedServerSettings {
	settings := EmbeddedServerSettings{}
	if strings.TrimSpace(configDir) == "" {
		return NormalizeEmbeddedServerSettings(settings)
	}
	data, err := os.ReadFile(EmbeddedServerSettingsPath(configDir))
	if err != nil {
		return NormalizeEmbeddedServerSettings(settings)
	}
	_ = json.Unmarshal(data, &settings)
	return NormalizeEmbeddedServerSettings(settings)
}

func SaveEmbeddedServerConfigSettings(configDir string, settings EmbeddedServerSettings) error {
	if strings.TrimSpace(configDir) == "" {
		return nil
	}
	normalized := NormalizeEmbeddedServerSettings(settings)
	data, err := json.MarshalIndent(normalized, "", "  ")
	if err != nil {
		return err
	}
	return atomicWriteFile(EmbeddedServerSettingsPath(configDir), data, 0600)
}